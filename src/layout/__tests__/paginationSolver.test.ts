import { describe, expect, it } from 'vitest'
import { NodeType, type AttachmentNode, type DocumentNode } from '../../types/ast'
import type { DocumentConfig } from '../../types/documentConfig'
import { A4_CANVAS_HEIGHT_PX, cmToPx } from '../../layout/constants'
import { CHARS_PER_LINE, DEFAULT_CONFIG } from '../../types/documentConfig'
import { parseGongwen } from '../../parser'
import { checkGongwen } from '../../checker'
import { BUILTIN_TEMPLATES } from '../../utils/builtinTemplates'
import { SAMPLE_DOCUMENTS } from '../../utils/sampleDocuments'
import { sanitizeText } from '../../utils/sanitize'
import {
  computeHeaderBodyLineMultiples,
  isOrphanSignaturePages,
  paginateMeasuredLines,
  solveOrphanSignatureLineSpacing,
  type MeasuredLine,
} from '../paginationSolver'
import { calculateSignatureLayout, resolveHeaderRenderPlan } from '../typography'

function estimateSampleLayout(
  title: DocumentNode | null,
  body: DocumentNode[],
  config: DocumentConfig,
): {
  lines: MeasuredLine[]
  firstPageAvailable: number
  fullAvailable: number
  footerNoteHeight: number
} {
  const L = config.body.lineSpacing
  const fullAvailable = Math.max(
    40,
    A4_CANVAS_HEIGHT_PX - cmToPx(config.margins.top) - cmToPx(config.margins.bottom),
  )

  const plan = resolveHeaderRenderPlan(config.header)
  let headerHeight = 0
  if (plan.shouldRender) {
    const orgLinesCount = Math.max(1, config.header.orgName.split('\n').filter((l) => l.trim()).length)
    const orgHeight = orgLinesCount * config.header.orgNameFontSize * 1.35
    if (config.header.format === 'letter') {
      const metaHeight = (plan.hasTopLeftMeta || config.header.docNumber.trim()) ? L + 14 : 0
      headerHeight = orgHeight + 11.34 + 4 + metaHeight + L * 2
    } else if (config.header.format === 'minutes') {
      const numHeight = config.header.docNumber.trim() ? L * 2 : 0
      headerHeight = orgHeight + numHeight + 13 + L * 2
    } else {
      headerHeight = orgHeight + computeHeaderBodyLineMultiples(config.header) * L + 14
    }
  }

  let footerNoteHeight = 0
  if (config.footerNote.enabled) {
    const rows =
      (config.footerNote.mainRecipient.trim() ? 1 : 0)
      + (config.footerNote.cc.trim() ? 1 : 0)
      + (config.footerNote.printer.trim() || config.footerNote.printDate.trim() ? 1 : 0)
    footerNoteHeight = Math.max(1, rows) * 28 + 4
  }

  const lines: MeasuredLine[] = []
  let y = 0

  const pushLines = (
    count: number,
    lineHeight: number,
    nodeIndex: number,
    nodeType: NodeType,
    isSpacer = false,
    pageBreakBefore = false,
  ) => {
    for (let i = 0; i < count; i++) {
      lines.push({
        top: y,
        bottom: y + lineHeight,
        nodeIndex,
        nodeType,
        isSpacer,
        pageBreakBefore: i === 0 ? pageBreakBefore : false,
      })
      y += lineHeight
    }
  }

  if (title) {
    const titleLines = title.content.split('\n')
    pushLines(titleLines.length, config.title.lineSpacing, -1, NodeType.DOCUMENT_TITLE)
    // .a4-title margin-bottom = L
    y += L
  }

  for (let i = 0; i < body.length; i++) {
    const node = body[i]
    const prevNode = i > 0 ? body[i - 1] : undefined
    const nextNode = i + 1 < body.length ? body[i + 1] : undefined

    if (node.type === NodeType.SIGNATURE) {
      const layout = calculateSignatureLayout(
        node.content,
        nextNode?.type === NodeType.DATE ? nextNode.content : null,
        config.specialOptions.hasStamp,
      )
      pushLines(layout.emptyLinesBefore, L, i, NodeType.SIGNATURE, true)
    } else if (node.type === NodeType.DATE && prevNode?.type !== NodeType.SIGNATURE) {
      const layout = calculateSignatureLayout(null, node.content, config.specialOptions.hasStamp)
      pushLines(layout.emptyLinesBefore, L, i, NodeType.DATE, true)
    }

    if (
      node.type === NodeType.ADDRESSEE
      || node.type === NodeType.ATTACHMENT
      || (node.type === NodeType.MINUTES_ATTENDANCE && prevNode?.type !== NodeType.MINUTES_ATTENDANCE)
    ) {
      y += L
    }

    if (node.type === NodeType.ATTACHMENT) {
      const att = node as AttachmentNode
      const charPerAttLine = Math.max(18, CHARS_PER_LINE - 5)
      let visualLines = 0
      for (const item of att.items) {
        const displayLen = (item.index > 0 ? `${item.index}.` : '') + item.name
        visualLines += Math.max(1, Math.ceil(displayLen.length / charPerAttLine))
      }
      pushLines(visualLines, L, i, NodeType.ATTACHMENT)
      continue
    }

    const effectiveCharsPerLine = node.type === NodeType.MINUTES_ATTENDANCE
      ? CHARS_PER_LINE - 5
      : CHARS_PER_LINE
    const extraPrefix = node.type === NodeType.ADDRESSEE ? 0 : config.body.firstLineIndent
    const lineCount = Math.max(1, Math.ceil((node.content.length + extraPrefix) / effectiveCharsPerLine))
    pushLines(
      lineCount,
      L,
      i,
      node.type,
      false,
      node.type === NodeType.ATTACHMENT_PAGE_HEADER,
    )
  }

  return {
    lines,
    firstPageAvailable: Math.max(40, fullAvailable - headerHeight),
    fullAvailable,
    footerNoteHeight,
  }
}

function buildSyntheticOrphanLines(params: {
  bodyLinesBeforeSig: number
  lineSpacing: number
  titleLines?: number
}): MeasuredLine[] {
  const L = params.lineSpacing
  const lines: MeasuredLine[] = []
  let y = 0

  if (params.titleLines) {
    for (let i = 0; i < params.titleLines; i++) {
      lines.push({
        top: y,
        bottom: y + 28.9,
        nodeIndex: -1,
        nodeType: NodeType.DOCUMENT_TITLE,
        isSpacer: false,
        pageBreakBefore: false,
      })
      y += 28.9
    }
    y += L
  }

  for (let i = 0; i < params.bodyLinesBeforeSig; i++) {
    lines.push({
      top: y,
      bottom: y + L,
      nodeIndex: i,
      nodeType: NodeType.PARAGRAPH,
      isSpacer: false,
      pageBreakBefore: false,
    })
    y += L
  }

  const sigIdx = params.bodyLinesBeforeSig
  // 2 行空行 + 署名 + 日期
  for (let s = 0; s < 2; s++) {
    lines.push({
      top: y,
      bottom: y + L,
      nodeIndex: sigIdx,
      nodeType: NodeType.SIGNATURE,
      isSpacer: true,
      pageBreakBefore: false,
    })
    y += L
  }
  lines.push({
    top: y,
    bottom: y + L,
    nodeIndex: sigIdx,
    nodeType: NodeType.SIGNATURE,
    isSpacer: false,
    pageBreakBefore: false,
  })
  y += L
  lines.push({
    top: y,
    bottom: y + L,
    nodeIndex: sigIdx + 1,
    nodeType: NodeType.DATE,
    isSpacer: false,
    pageBreakBefore: false,
  })

  return lines
}

function applyScaleToSyntheticLines(
  lines: MeasuredLine[],
  fromL: number,
  toL: number,
): MeasuredLine[] {
  const scale = toL / fromL
  const next: MeasuredLine[] = []
  let prevOrigBottom = 0
  let prevSimBottom = 0

  for (const line of lines) {
    const gapBefore = Math.max(0, line.top - prevOrigBottom)
    const top = prevSimBottom + gapBefore * scale
    const h = line.nodeType === NodeType.DOCUMENT_TITLE ? (line.bottom - line.top) : (line.bottom - line.top) * scale
    next.push({ ...line, top, bottom: top + h })
    prevOrigBottom = line.bottom
    prevSimBottom = top + h
  }
  return next
}

describe('paginationSolver', () => {
  it('孤行落款（轻微溢出）：一次求解收紧行距即可合并至上一页', () => {
    const L = 28.9
    const fullAvailable = 637.8
    const firstPageAvailable = 440
    const footerNoteHeight = 60
    // 第 1 页放 15 行（433.5px <= 440px）；第 2 页无版记可放 22 行（635.8px <= 637.8px），若第 2 页变为末页需预留 60px 版记只能放 19 行（549.1px）
    // 设正文 33 行：15 行在第 1 页，剩余 18 行正文 + 4 行落款 = 第 2 页共 22 行（Phase 2 发现 22*28.9=635.8 > 577.8，将最后 3 行落款切到第 3 页；仅需把行距收到 ~26.2 即可并入第 2 页）
    const lines = buildSyntheticOrphanLines({
      bodyLinesBeforeSig: 33,
      lineSpacing: L,
    })

    const baseline = paginateMeasuredLines(lines, firstPageAvailable, fullAvailable, footerNoteHeight)
    expect(baseline.breakOffsets.length).toBe(3)
    expect(isOrphanSignaturePages(baseline.pageNodeTypes)).toBe(true)

    const suggestion = solveOrphanSignatureLineSpacing({
      lines,
      firstPageAvailable,
      fullAvailable,
      footerNoteHeight,
      currentLineSpacing: L,
      minFontSize: 16,
      headerBodyLineMultiples: 4,
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion!.direction).toBe('tighten')
    expect(suggestion!.lineSpacing).toBeLessThan(L)

    const fixedLines = applyScaleToSyntheticLines(lines, L, suggestion!.lineSpacing)
    const fixedFirstAvail = firstPageAvailable - (suggestion!.lineSpacing - L) * 4
    const after = paginateMeasuredLines(fixedLines, fixedFirstAvail, fullAvailable, footerNoteHeight)

    expect(isOrphanSignaturePages(after.pageNodeTypes)).toBe(false)
    expect(after.breakOffsets.length).toBe(2)
  })

  it('孤行落款（压缩空间不足时）：自动改为放宽行距带入末行正文，一次消除告警', () => {
    const L = 28.9
    const fullAvailable = 637.8
    // 首页剩余空间较小，但落款在单页满溢（需要压缩 > 3pt 才能塞回，改走放宽把末行正文顺下同页）
    const firstPageAvailable = 520
    const footerNoteHeight = 60
    // 1 页放 15 行（433.5px + 60 = 493.5 <= 520），4 行落款溢到第 2 页
    // 要全部并回第 1 页需 19*L <= 460 -> L <= 24.2 (< 25.5 下限)，因此应选择放宽行距把第 15 行推下第 2 页
    const lines = buildSyntheticOrphanLines({
      bodyLinesBeforeSig: 15,
      lineSpacing: L,
    })

    const baseline = paginateMeasuredLines(lines, firstPageAvailable, fullAvailable, footerNoteHeight)
    expect(baseline.breakOffsets.length).toBe(2)
    expect(isOrphanSignaturePages(baseline.pageNodeTypes)).toBe(true)

    const suggestion = solveOrphanSignatureLineSpacing({
      lines,
      firstPageAvailable,
      fullAvailable,
      footerNoteHeight,
      currentLineSpacing: L,
      minFontSize: 16,
      headerBodyLineMultiples: 0,
    })

    expect(suggestion).not.toBeNull()
    expect(suggestion!.direction).toBe('loosen')
    expect(suggestion!.lineSpacing).toBeGreaterThan(L)

    const fixedLines = applyScaleToSyntheticLines(lines, L, suggestion!.lineSpacing)
    const after = paginateMeasuredLines(fixedLines, firstPageAvailable, fullAvailable, footerNoteHeight)

    expect(isOrphanSignaturePages(after.pageNodeTypes)).toBe(false)
    expect(after.breakOffsets.length).toBe(2)
    expect(after.pageNodeTypes[1]).toContain(NodeType.PARAGRAPH)
  })

  it('内置 4 套示例公文全部 0 校对告警（含孤行落款模拟分页校验）', () => {
    for (const sample of SAMPLE_DOCUMENTS) {
      const template = BUILTIN_TEMPLATES.find((t) => t.id === sample.builtinTemplateId)
      expect(template, `未找到示例 ${sample.id} 对应模板`).toBeDefined()

      const config = template?.config ?? DEFAULT_CONFIG
      const sanitized = sanitizeText(sample.text, config.sanitize).text
      const ast = parseGongwen(sanitized, { parserConfig: config.parser })
      const layout = estimateSampleLayout(ast.title, ast.body, config)
      const paginated = paginateMeasuredLines(
        layout.lines,
        layout.firstPageAvailable,
        layout.fullAvailable,
        layout.footerNoteHeight,
      )

      expect(isOrphanSignaturePages(paginated.pageNodeTypes), `示例 ${sample.id} 仍出现孤行落款`).toBe(false)

      const issues = checkGongwen({
        ast,
        rawText: sanitized,
        config,
        pages: paginated.pageNodeTypes.map((nodeTypes) => ({ nodeTypes })),
      })

      expect(issues, `示例 ${sample.id} 存在校对问题: ${JSON.stringify(issues)}`).toHaveLength(0)
    }
  })
})
