import { useEffect, useState, type RefObject } from 'react'
import { NodeType, type DocumentNode } from '../types/ast'
import type { DocumentFormat, HeaderOrgAlign, HeaderSeparatorStyle } from '../types/documentConfig'
import { A4_CANVAS_HEIGHT_PX, A4_CANVAS_WIDTH_PX, cmToPx } from '../layout/constants'
import {
  computeHeaderBodyLineMultiples,
  isOrphanSignaturePages,
  paginateMeasuredLines,
  solveOrphanSignatureLineSpacing,
  type MeasuredLine,
} from '../layout/paginationSolver'

/** 单页裁剪信息 */
export interface PageSlice {
  /** 内容在完整流中的起始偏移(px) */
  offsetY: number
  /** 在切片子树中的起始偏移(px) */
  sliceOffsetY: number
  /** 该页应显示的内容高度(px)，精确到行边界 */
  clipHeight: number
  /** 该页起始节点索引 (-1 表示包含 title) */
  startNodeIndex: number
  /** 该页结束节点索引 (-1 表示仅 title) */
  endNodeIndex: number
  /** 是否为跨页续接切片（非第一页） */
  isContinuation: boolean
  /** 该页包含的非空行节点类型 */
  nodeTypes: NodeType[]
  /** 求解器针对孤行落款给出的精准目标行距 */
  suggestedLineSpacing?: number
  /** 求解器建议方向（收紧并入上页 / 放宽带入末行正文） */
  suggestedLineSpacingDirection?: 'tighten' | 'loosen'
  /** 是否已由分页求解器检验过孤行修复可行性 */
  orphanFixChecked?: boolean
}

export interface PaginationConfig {
  margins: {
    top: number
    bottom: number
    left: number
    right: number
  }
  header: {
    enabled: boolean
    format: DocumentFormat
    copyNumber: string
    secretLevel: string
    urgency: string
    orgName: string
    orgNameSuffix: string
    orgNameFontFamily: string
    orgNameFontSize: number
    orgNameAlign: HeaderOrgAlign
    orgNameLetterSpacing: number
    docNumber: string
    signer: string
    separatorStyle: HeaderSeparatorStyle
    customImageDataUrl: string
    customImageHeightMm: number
  }
  footerNote: {
    enabled: boolean
    mainRecipient: string
    cc: string
    printer: string
    printDate: string
  }
  title: {
    fontFamily: string
    fontSize: number
    lineSpacing: number
  }
  body: {
    fontFamily: string
    asciiFontFamily: string
    fontSize: number
    lineSpacing: number
    firstLineIndent: number
  }
  advanced: {
    h1: { fontFamily: string; asciiFontFamily: string; fontSize: number }
    h2: { fontFamily: string; asciiFontFamily: string; fontSize: number }
    h3: { fontFamily: string; asciiFontFamily: string; fontSize: number }
  }
  specialOptions: {
    boldFirstSentence: boolean
    boldHeading2: boolean
    boldHeading3: boolean
    hasStamp: boolean
    signerTitle: string
    signerStampName: string
  }
}

function arePagesEqual(prev: PageSlice[], next: PageSlice[]): boolean {
  if (prev.length !== next.length) return false

  for (let i = 0; i < prev.length; i++) {
    const a = prev[i]
    const b = next[i]
    if (
      Math.abs(a.offsetY - b.offsetY) > 0.5
      || Math.abs(a.sliceOffsetY - b.sliceOffsetY) > 0.5
      || Math.abs(a.clipHeight - b.clipHeight) > 0.5
      || a.startNodeIndex !== b.startNodeIndex
      || a.endNodeIndex !== b.endNodeIndex
      || a.isContinuation !== b.isContinuation
      || a.suggestedLineSpacing !== b.suggestedLineSpacing
      || a.suggestedLineSpacingDirection !== b.suggestedLineSpacingDirection
      || a.orphanFixChecked !== b.orphanFixChecked
      || a.nodeTypes.length !== b.nodeTypes.length
    ) {
      return false
    }
    for (let j = 0; j < a.nodeTypes.length; j++) {
      if (a.nodeTypes[j] !== b.nodeTypes[j]) return false
    }
  }

  return true
}

function createEmptySlice(clipHeight: number): PageSlice {
  return {
    offsetY: 0,
    sliceOffsetY: 0,
    clipHeight,
    startNodeIndex: 0,
    endNodeIndex: -1,
    isContinuation: false,
    nodeTypes: [],
  }
}

/**
 * DOM 度量分页 hook（O(N) 节点切片 + 固定 A4 画布精确度量 + 孤行落款行距求解）
 */
export function usePagination(
  title: DocumentNode | null,
  body: DocumentNode[],
  measurerRef: RefObject<HTMLDivElement | null>,
  config: PaginationConfig,
): PageSlice[] {
  const [pages, setPages] = useState<PageSlice[]>(() => [createEmptySlice(0)])

  useEffect(() => {
    const measurer = measurerRef.current
    if (!measurer) return
    let frameId = 0

    function calculate() {
      const el = measurerRef.current
      if (!el) {
        setPages([createEmptySlice(0)])
        return
      }

      const scrollContainer = el.parentElement
      if (!scrollContainer) {
        setPages([createEmptySlice(0)])
        return
      }

      // 固定 A4 72dpi 画布宽度 (595.28px)，避免窗口窄化导致文本重新折行
      el.style.width = `${A4_CANVAS_WIDTH_PX}px`

      const fullAvailable = Math.max(
        40,
        A4_CANVAS_HEIGHT_PX - cmToPx(config.margins.top) - cmToPx(config.margins.bottom),
      )

      // 度量第一页版头高度（在固定画布内渲染的真实版头）
      let headerHeight = 0
      const headerSection = scrollContainer.querySelector('.a4-header-section') as HTMLElement | null
      if (headerSection) {
        const hs = getComputedStyle(headerSection)
        headerHeight = headerSection.offsetHeight
          + parseFloat(hs.marginTop) + parseFloat(hs.marginBottom)
      }

      // 度量末页版记高度
      let footerNoteHeight = 0
      const footerNote = scrollContainer.querySelector('.a4-footer-note') as HTMLElement | null
      if (footerNote) {
        footerNoteHeight = footerNote.offsetHeight
      }

      const firstPageAvailable = Math.max(40, fullAvailable - headerHeight)

      const contentEl = el.querySelector('.a4-measurer-content')
      if (!contentEl) {
        setPages([createEmptySlice(firstPageAvailable)])
        return
      }

      const paragraphs = contentEl.querySelectorAll<HTMLParagraphElement>(':scope > p')
      if (paragraphs.length === 0) {
        setPages([createEmptySlice(firstPageAvailable)])
        return
      }

      const lines: MeasuredLine[] = []
      const nodeFirstTop = new Map<number, number>()
      const contentRect = contentEl.getBoundingClientRect()

      for (const p of paragraphs) {
        const idxAttr = p.getAttribute('data-node-idx')
        const nodeIndex = idxAttr !== null ? Number(idxAttr) : 0
        const nodeType = (p.getAttribute('data-node-type') as NodeType) || NodeType.PARAGRAPH
        const isSpacer = p.getAttribute('data-spacer') === 'true'
        const pageBreakBefore = p.getAttribute('data-page-break-before') === 'true'

        const pRect = p.getBoundingClientRect()
        const pTop = pRect.top - contentRect.top
        const pHeight = pRect.height

        if (!nodeFirstTop.has(nodeIndex)) {
          nodeFirstTop.set(nodeIndex, pTop)
        }

        const computedStyle = getComputedStyle(p)
        const lineHeight = parseFloat(computedStyle.lineHeight)

        if (isNaN(lineHeight) || lineHeight <= 0 || pHeight <= lineHeight * 1.5) {
          lines.push({
            top: pTop,
            bottom: pTop + pHeight,
            nodeIndex,
            nodeType,
            isSpacer,
            pageBreakBefore,
          })
        } else {
          const lineCount = Math.max(1, Math.round(pHeight / lineHeight))
          for (let i = 0; i < lineCount; i++) {
            lines.push({
              top: pTop + i * lineHeight,
              bottom: i < lineCount - 1 ? pTop + (i + 1) * lineHeight : pTop + pHeight,
              nodeIndex,
              nodeType,
              isSpacer,
              pageBreakBefore: i === 0 ? pageBreakBefore : false,
            })
          }
        }
      }

      const {
        breakOffsets,
        totalContentHeight,
        pageNodeTypes,
      } = paginateMeasuredLines(lines, firstPageAvailable, fullAvailable, footerNoteHeight)

      // Phase 3: 构建每页的节点切片区间
      const result: PageSlice[] = breakOffsets.map((offset, pageIndex) => {
        const nextOffset = pageIndex < breakOffsets.length - 1
          ? breakOffsets[pageIndex + 1]
          : totalContentHeight
        const clipHeight = Math.max(0, nextOffset - offset)

        const pageLines = lines.filter(
          (line) => line.bottom > offset + 0.5 && line.top < nextOffset - 0.5,
        )

        if (pageLines.length === 0) {
          return createEmptySlice(clipHeight)
        }

        let startNodeIndex = pageLines[0].nodeIndex
        let endNodeIndex = pageLines[0].nodeIndex

        for (const line of pageLines) {
          if (line.nodeIndex < startNodeIndex) startNodeIndex = line.nodeIndex
          if (line.nodeIndex > endNodeIndex) endNodeIndex = line.nodeIndex
        }

        const isContinuation = pageIndex > 0
        const firstNodeTop = nodeFirstTop.get(startNodeIndex) ?? offset
        const sliceOffsetY = isContinuation
          ? Math.max(0, offset - firstNodeTop)
          : 0

        return {
          offsetY: offset,
          sliceOffsetY,
          clipHeight,
          startNodeIndex,
          endNodeIndex,
          isContinuation,
          nodeTypes: pageNodeTypes[pageIndex] ?? [],
        }
      })

      if (isOrphanSignaturePages(pageNodeTypes) && result.length > 0) {
        const minFontSize = Math.max(
          config.body.fontSize,
          config.advanced.h1.fontSize,
          config.advanced.h2.fontSize,
          config.advanced.h3.fontSize,
        )
        const suggestion = solveOrphanSignatureLineSpacing({
          lines,
          firstPageAvailable,
          fullAvailable,
          footerNoteHeight,
          currentLineSpacing: config.body.lineSpacing,
          minFontSize,
          headerBodyLineMultiples: computeHeaderBodyLineMultiples(config.header),
        })
        const lastSlice = result[result.length - 1]
        lastSlice.orphanFixChecked = true
        if (suggestion) {
          lastSlice.suggestedLineSpacing = suggestion.lineSpacing
          lastSlice.suggestedLineSpacingDirection = suggestion.direction
        }
      }

      setPages((prev) => (arePagesEqual(prev, result) ? prev : result))
    }

    function scheduleCalculate() {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        frameId = 0
        calculate()
      })
    }

    scheduleCalculate()

    const observer = new ResizeObserver(() => scheduleCalculate())
    observer.observe(measurer)
    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [title, body, measurerRef, config])

  return pages
}
