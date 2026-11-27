import { NodeType } from '../types/ast'
import type { HeaderConfig } from '../types/documentConfig'
import { parseSigners, resolveHeaderRenderPlan } from './typography'

export interface MeasuredLine {
  top: number
  bottom: number
  nodeIndex: number
  nodeType: NodeType
  isSpacer: boolean
  pageBreakBefore: boolean
}

export interface PaginateMeasuredResult {
  breakOffsets: number[]
  totalContentHeight: number
  pageNodeTypes: NodeType[][]
}

export interface OrphanLineSpacingSuggestion {
  lineSpacing: number
  direction: 'tighten' | 'loosen'
}

export interface SolveOrphanLineSpacingInput {
  lines: MeasuredLine[]
  firstPageAvailable: number
  fullAvailable: number
  footerNoteHeight: number
  currentLineSpacing: number
  minFontSize: number
  headerBodyLineMultiples: number
}

/** 判断末页是否仅剩落款 / 成文日期 / 附注（另页单印落款 §7.3.5.5） */
export function isOrphanSignaturePages(pageNodeTypes: NodeType[][]): boolean {
  if (pageNodeTypes.length <= 1) return false
  const lastTypes = pageNodeTypes[pageNodeTypes.length - 1]
  return (
    lastTypes.length > 0
    && lastTypes.every(
      (t) =>
        t === NodeType.SIGNATURE
        || t === NodeType.DATE
        || t === NodeType.POSTSCRIPT,
    )
  )
}

function firstPageHasBody(pageNodeTypes: NodeType[][]): boolean {
  if (pageNodeTypes.length === 0) return false
  return pageNodeTypes[0].some(
    (t) => t !== NodeType.DOCUMENT_TITLE && t !== NodeType.ADDRESSEE,
  )
}

/** 根据精确测量行位置执行分页切片（Phase 1 分页 + Phase 2 末页版记预留） */
export function paginateMeasuredLines(
  lines: MeasuredLine[],
  firstPageAvailable: number,
  fullAvailable: number,
  footerNoteHeight: number,
): PaginateMeasuredResult {
  const totalContentHeight = lines.length > 0 ? lines[lines.length - 1].bottom : 0

  const breakOffsets: number[] = [0]
  let pageStart = 0
  let currentAvailable = firstPageAvailable

  for (const line of lines) {
    const forceBreak = line.pageBreakBefore && line.top - pageStart > 0.5
    const overflowBreak = line.bottom - pageStart > currentAvailable && line.top - pageStart > 0.5
    if (forceBreak || overflowBreak) {
      pageStart = line.top
      breakOffsets.push(pageStart)
      currentAvailable = fullAvailable
    }
  }

  if (footerNoteHeight > 0) {
    let maxIterations = 10
    let stable = false
    while (!stable && maxIterations-- > 0) {
      stable = true
      const lastIdx = breakOffsets.length - 1
      const lastStart = breakOffsets[lastIdx]
      const isAlsoFirstPage = lastIdx === 0
      const lastPageBase = isAlsoFirstPage ? firstPageAvailable : fullAvailable
      const lastPageAvailable = Math.max(40, lastPageBase - footerNoteHeight)
      const lastPageContent = totalContentHeight - lastStart

      if (lastPageContent > lastPageAvailable + 0.5) {
        for (const line of lines) {
          if (line.top < lastStart + 0.5) continue
          if (line.bottom - lastStart > lastPageAvailable && line.top - lastStart > 0.5) {
            breakOffsets.push(line.top)
            stable = false
            break
          }
        }
      }
    }
  }

  const pageNodeTypes: NodeType[][] = breakOffsets.map((offset, pageIndex) => {
    const nextOffset = pageIndex < breakOffsets.length - 1
      ? breakOffsets[pageIndex + 1]
      : totalContentHeight
    const types: NodeType[] = []

    for (const line of lines) {
      if (line.bottom > offset + 0.5 && line.top < nextOffset - 0.5) {
        if (!line.isSpacer && !types.includes(line.nodeType)) {
          types.push(line.nodeType)
        }
      }
    }

    return types
  })

  return {
    breakOffsets,
    totalContentHeight,
    pageNodeTypes,
  }
}

/** 计算首页版头中随 `--body-line-height` 线性变化的倍数 */
export function computeHeaderBodyLineMultiples(headerConfig: HeaderConfig): number {
  const plan = resolveHeaderRenderPlan(headerConfig)
  if (!plan.shouldRender) return 0

  // .a4-header-section margin-bottom: 2 * bodyLineHeight
  let multiples = 2
  const securityLines =
    (headerConfig.copyNumber.trim() ? 1 : 0)
    + (headerConfig.secretLevel.trim() ? 1 : 0)
    + (headerConfig.urgency.trim() ? 1 : 0)

  if (headerConfig.format === 'standard') {
    multiples += securityLines
    if (plan.hasMetaRow) {
      const signerRows = parseSigners(headerConfig.signer)
      multiples += 2 + Math.max(1, signerRows.length)
    }
  } else if (headerConfig.format === 'letter') {
    if (plan.hasTopLeftMeta || headerConfig.docNumber.trim()) {
      multiples += Math.max(1, securityLines)
    }
  } else if (headerConfig.format === 'command') {
    if (headerConfig.docNumber.trim()) {
      multiples += 3
    }
  } else if (headerConfig.format === 'minutes') {
    if (headerConfig.docNumber.trim()) {
      multiples += 2
    }
  }

  return multiples
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** 双向搜索一次性消除「末页孤行落款」的精准正文行距 */
export function solveOrphanSignatureLineSpacing({
  lines,
  firstPageAvailable,
  fullAvailable,
  footerNoteHeight,
  currentLineSpacing,
  minFontSize,
  headerBodyLineMultiples,
}: SolveOrphanLineSpacingInput): OrphanLineSpacingSuggestion | null {
  if (lines.length === 0 || currentLineSpacing <= 0) return null

  const baseline = paginateMeasuredLines(lines, firstPageAvailable, fullAvailable, footerNoteHeight)
  if (!isOrphanSignaturePages(baseline.pageNodeTypes)) return null

  const origPages = baseline.breakOffsets.length
  const origFirstHasBody = firstPageHasBody(baseline.pageNodeTypes)

  const simulate = (candidateL: number): PaginateMeasuredResult | null => {
    const scale = candidateL / currentLineSpacing
    const simLines: MeasuredLine[] = []
    let prevOrigBottom = 0
    let prevSimBottom = 0

    for (const line of lines) {
      const gapBefore = Math.max(0, line.top - prevOrigBottom)
      const simTop = prevSimBottom + gapBefore * scale
      const lineHeight = line.bottom - line.top
      const simHeight = line.nodeType === NodeType.DOCUMENT_TITLE
        ? lineHeight
        : lineHeight * scale
      const simBottom = simTop + simHeight

      simLines.push({
        ...line,
        top: simTop,
        bottom: simBottom,
      })

      prevOrigBottom = line.bottom
      prevSimBottom = simBottom
    }

    const simFirstPageAvailable = Math.max(
      40,
      firstPageAvailable - (candidateL - currentLineSpacing) * headerBodyLineMultiples,
    )
    const result = paginateMeasuredLines(
      simLines,
      simFirstPageAvailable,
      fullAvailable,
      footerNoteHeight,
    )

    if (isOrphanSignaturePages(result.pageNodeTypes)) return null
    if (origFirstHasBody && !firstPageHasBody(result.pageNodeTypes)) return null
    return result
  }

  // 1. 搜索「收紧并入上页」(tighten)
  const minTighten = roundToTenth(Math.max(minFontSize, 24.5))
  let tightenSolution: number | null = null
  const startTightenTenths = Math.round(currentLineSpacing * 10) - 1
  const minTightenTenths = Math.round(minTighten * 10)

  for (let tenths = startTightenTenths; tenths >= minTightenTenths; tenths--) {
    const candidate = tenths / 10
    const res = simulate(candidate)
    if (res && res.breakOffsets.length < origPages) {
      // 尝试追加 -0.2pt / -0.1pt 安全余量以抵消跨平台渲染子像素误差
      const safe2 = roundToTenth(candidate - 0.2)
      const safe1 = roundToTenth(candidate - 0.1)
      if (safe2 >= minTighten) {
        const res2 = simulate(safe2)
        if (res2 && res2.breakOffsets.length < origPages) {
          tightenSolution = safe2
          break
        }
      }
      if (safe1 >= minTighten) {
        const res1 = simulate(safe1)
        if (res1 && res1.breakOffsets.length < origPages) {
          tightenSolution = safe1
          break
        }
      }
      tightenSolution = candidate
      break
    }
  }

  // 2. 搜索「放宽带入末行正文」(loosen)
  const maxLoosen = roundToTenth(Math.min(36.0, currentLineSpacing + 6.0))
  let loosenSolution: number | null = null
  const startLoosenTenths = Math.round(currentLineSpacing * 10) + 1
  const maxLoosenTenths = Math.round(maxLoosen * 10)

  for (let tenths = startLoosenTenths; tenths <= maxLoosenTenths; tenths++) {
    const candidate = tenths / 10
    const res = simulate(candidate)
    if (res && res.breakOffsets.length === origPages) {
      const safe2 = roundToTenth(candidate + 0.2)
      const safe1 = roundToTenth(candidate + 0.1)
      if (safe2 <= maxLoosen) {
        const res2 = simulate(safe2)
        if (res2 && res2.breakOffsets.length === origPages) {
          loosenSolution = safe2
          break
        }
      }
      if (safe1 <= maxLoosen) {
        const res1 = simulate(safe1)
        if (res1 && res1.breakOffsets.length === origPages) {
          loosenSolution = safe1
          break
        }
      }
      loosenSolution = candidate
      break
    }
  }

  // 3. 择优返回
  if (
    tightenSolution !== null
    && currentLineSpacing - tightenSolution <= 2.8 + 1e-6
    && tightenSolution >= 25.5 - 1e-6
  ) {
    return { lineSpacing: tightenSolution, direction: 'tighten' }
  }

  if (
    loosenSolution !== null
    && loosenSolution - currentLineSpacing <= 3.5 + 1e-6
  ) {
    return { lineSpacing: loosenSolution, direction: 'loosen' }
  }

  if (tightenSolution !== null && loosenSolution !== null) {
    const tightenDelta = Math.abs(currentLineSpacing - tightenSolution)
    const loosenDelta = Math.abs(loosenSolution - currentLineSpacing)
    return tightenDelta <= loosenDelta
      ? { lineSpacing: tightenSolution, direction: 'tighten' }
      : { lineSpacing: loosenSolution, direction: 'loosen' }
  }

  if (tightenSolution !== null) {
    return { lineSpacing: tightenSolution, direction: 'tighten' }
  }

  if (loosenSolution !== null) {
    return { lineSpacing: loosenSolution, direction: 'loosen' }
  }

  return null
}
