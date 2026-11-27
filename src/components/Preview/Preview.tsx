import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { GongwenAST } from '../../types/ast'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { cmToPagePercent, CHARS_PER_LINE } from '../../types/documentConfig'
import {
  A4_CANVAS_HEIGHT_PX,
  A4_CANVAS_WIDTH_PX,
  cmToPx,
} from '../../layout/constants'
import { usePagination, type PageSlice } from '../../hooks/usePagination'
import { getPreviewFontFamily, getPreviewMixedFontFamily } from '../../utils/fontAliases'
import { A4Page } from './A4Page'
import { DocumentFlow } from './DocumentFlow'
import './A4Page.css'
import './Preview.css'

export type ViewLayoutMode = 'split' | 'editor' | 'preview'

interface PreviewProps {
  ast: GongwenAST
  onSelectLine?: (lineNumber: number) => void
  onPagesChange?: (pages: PageSlice[]) => void
}

const LARGE_DOCUMENT_PREVIEW_THRESHOLD = 20000
const LARGE_DOCUMENT_SAMPLE_SIZE = 500
const MEASURE_SAMPLE_CHAR = '测'
const PREVIEW_LINE_FIT_TOLERANCE_PX = 1

const ZOOM_STEPS: number[] = [0.65, 0.75, 0.9, 1, 1.15, 1.25]
const ZOOM_SELECT_OPTIONS: { label: string; value: string }[] = [
  { label: '适应', value: 'fit' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
  { label: '125%', value: '1.25' },
]

interface CharacterMeasure {
  textWidth: number
  letterSpacingUnits: number
}

export function Preview({
  ast,
  onSelectLine,
  onPagesChange,
}: PreviewProps) {
  const measurerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const visiblePageRef = useRef(1)

  const [containerWidthPx, setContainerWidthPx] = useState(A4_CANVAS_WIDTH_PX)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const [visiblePage, setVisiblePage] = useState(1)
  const [characterMeasure, setCharacterMeasure] = useState<CharacterMeasure | null>(null)

  const { config } = useDocumentConfig()
  const deferredConfig = useDeferredValue(config)

  const bodyPreviewFontFamily = useMemo(
    () => getPreviewMixedFontFamily(
      deferredConfig.body.fontFamily,
      deferredConfig.body.asciiFontFamily,
    ),
    [deferredConfig.body.fontFamily, deferredConfig.body.asciiFontFamily],
  )
  const h1PreviewFontFamily = useMemo(
    () => getPreviewMixedFontFamily(
      deferredConfig.advanced.h1.fontFamily,
      deferredConfig.advanced.h1.asciiFontFamily,
    ),
    [deferredConfig.advanced.h1.fontFamily, deferredConfig.advanced.h1.asciiFontFamily],
  )
  const h2PreviewFontFamily = useMemo(
    () => getPreviewMixedFontFamily(
      deferredConfig.advanced.h2.fontFamily,
      deferredConfig.advanced.h2.asciiFontFamily,
    ),
    [deferredConfig.advanced.h2.fontFamily, deferredConfig.advanced.h2.asciiFontFamily],
  )
  const h3PreviewFontFamily = useMemo(
    () => getPreviewMixedFontFamily(
      deferredConfig.advanced.h3.fontFamily,
      deferredConfig.advanced.h3.asciiFontFamily,
    ),
    [deferredConfig.advanced.h3.fontFamily, deferredConfig.advanced.h3.asciiFontFamily],
  )

  const isLargeDocument = ast.body.length > LARGE_DOCUMENT_PREVIEW_THRESHOLD
  const previewDocKey = `${ast.title?.content ?? ''}:${ast.body.length}:${ast.body[0]?.content ?? ''}`
  const [fullPreviewDocKey, setFullPreviewDocKey] = useState<string | null>(null)
  const isFullPreview = isLargeDocument && fullPreviewDocKey === previewDocKey
  const isSamplePreview = isLargeDocument && !isFullPreview
  const previewBody = useMemo(
    () => (isSamplePreview ? ast.body.slice(0, LARGE_DOCUMENT_SAMPLE_SIZE) : ast.body),
    [ast.body, isSamplePreview],
  )

  const paginationConfig = useMemo(() => ({
    margins: deferredConfig.margins,
    header: deferredConfig.header,
    footerNote: deferredConfig.footerNote,
    title: deferredConfig.title,
    body: deferredConfig.body,
    advanced: deferredConfig.advanced,
    specialOptions: {
      boldFirstSentence: deferredConfig.specialOptions.boldFirstSentence,
      boldHeading2: deferredConfig.specialOptions.boldHeading2,
      boldHeading3: deferredConfig.specialOptions.boldHeading3,
      hasStamp: deferredConfig.specialOptions.hasStamp,
      signerTitle: deferredConfig.specialOptions.signerTitle,
      signerStampName: deferredConfig.specialOptions.signerStampName,
    },
  }), [deferredConfig])

  const pages = usePagination(ast.title, previewBody, measurerRef, paginationConfig)

  useEffect(() => {
    onPagesChange?.(pages)
  }, [onPagesChange, pages])

  // 监测滚动容器可用宽度用于等比缩放
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return

    function syncContainerWidth() {
      const current = scrollRef.current
      if (!current) return
      const style = getComputedStyle(current)
      const innerWidth = current.clientWidth
        - parseFloat(style.paddingLeft)
        - parseFloat(style.paddingRight)
      const safeWidth = Math.max(240, innerWidth)
      setContainerWidthPx((prev) => (Math.abs(prev - safeWidth) > 0.5 ? safeWidth : prev))
    }

    syncContainerWidth()
    const observer = new ResizeObserver(syncContainerWidth)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [])

  // 追踪当前视口主页面号（通过 rAF 节流）
  const syncVisiblePage = useCallback(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl || pages.length <= 1) {
      if (visiblePageRef.current !== 1) {
        visiblePageRef.current = 1
        setVisiblePage(1)
      }
      return
    }

    const scrollRect = scrollEl.getBoundingClientRect()
    const anchorY = scrollRect.top + scrollRect.height * 0.35
    let bestPage = 1
    let bestDist = Infinity

    for (let i = 1; i <= pages.length; i++) {
      const el = pageRefs.current.get(i)
      if (!el) continue
      const rect = el.getBoundingClientRect()
      const dist = Math.abs(rect.top + rect.height * 0.35 - anchorY)
      if (dist < bestDist) {
        bestDist = dist
        bestPage = i
      }
    }

    if (visiblePageRef.current !== bestPage) {
      visiblePageRef.current = bestPage
      setVisiblePage(bestPage)
    }
  }, [pages.length])

  useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    let rafId = 0

    const handleScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        syncVisiblePage()
      })
    }

    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll)
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [syncVisiblePage])

  // 度量标准 28 字行宽（固定 595.28px 画布下不受窗口大小影响）
  useEffect(() => {
    let cancelled = false

    function measureCharacterWidth() {
      if (cancelled) return
      const text = MEASURE_SAMPLE_CHAR.repeat(CHARS_PER_LINE)
      const probe = document.createElement('span')
      probe.textContent = text
      probe.style.position = 'absolute'
      probe.style.left = '-9999px'
      probe.style.top = '-9999px'
      probe.style.visibility = 'hidden'
      probe.style.whiteSpace = 'nowrap'
      probe.style.fontFamily = bodyPreviewFontFamily
      probe.style.fontSize = `${deferredConfig.body.fontSize}px`
      probe.style.fontWeight = 'normal'
      probe.style.fontStyle = 'normal'
      probe.style.lineHeight = 'normal'
      probe.style.letterSpacing = '0'
      document.body.appendChild(probe)

      const textWidth = probe.getBoundingClientRect().width
      probe.style.letterSpacing = '1px'
      const textWidthWithSpacing = probe.getBoundingClientRect().width
      document.body.removeChild(probe)

      const letterSpacingUnits = Math.max(1, textWidthWithSpacing - textWidth)
      setCharacterMeasure((prev) => {
        if (
          prev
          && Math.abs(prev.textWidth - textWidth) <= 0.01
          && Math.abs(prev.letterSpacingUnits - letterSpacingUnits) <= 0.01
        ) {
          return prev
        }
        return { textWidth, letterSpacingUnits }
      })
    }

    measureCharacterWidth()
    document.fonts?.ready.then(measureCharacterWidth)

    return () => {
      cancelled = true
    }
  }, [bodyPreviewFontFamily, deferredConfig.body.fontSize])

  const cssVars = useMemo((): CSSProperties => {
    const availablePx = A4_CANVAS_WIDTH_PX
      - cmToPx(deferredConfig.margins.left)
      - cmToPx(deferredConfig.margins.right)
    const fallbackTextWidth = deferredConfig.body.fontSize * CHARS_PER_LINE
    const textWidth = characterMeasure?.textWidth ?? fallbackTextWidth
    const letterSpacingUnits = characterMeasure?.letterSpacingUnits ?? Math.max(1, CHARS_PER_LINE - 1)
    const charSpacingPx = (availablePx - textWidth - PREVIEW_LINE_FIT_TOLERANCE_PX) / letterSpacingUnits

    return {
      '--margin-top': `${cmToPagePercent(deferredConfig.margins.top, 'x')}%`,
      '--margin-bottom': `${cmToPagePercent(deferredConfig.margins.bottom, 'x')}%`,
      '--margin-left': `${cmToPagePercent(deferredConfig.margins.left, 'x')}%`,
      '--margin-right': `${cmToPagePercent(deferredConfig.margins.right, 'x')}%`,
      '--margin-bottom-y': `${cmToPagePercent(deferredConfig.margins.bottom, 'y')}%`,
      '--header-org-font': getPreviewFontFamily(deferredConfig.header.orgNameFontFamily),
      '--title-font': getPreviewFontFamily(deferredConfig.title.fontFamily),
      '--title-size': `${deferredConfig.title.fontSize}px`,
      '--title-line-height': `${deferredConfig.title.lineSpacing}px`,
      '--body-font': bodyPreviewFontFamily,
      '--body-size': `${deferredConfig.body.fontSize}px`,
      '--body-line-height': `${deferredConfig.body.lineSpacing}px`,
      '--body-indent': `${deferredConfig.body.firstLineIndent}em`,
      '--char-spacing': `${charSpacingPx.toFixed(4)}px`,
      '--h1-font': h1PreviewFontFamily,
      '--h1-size': `${deferredConfig.advanced.h1.fontSize}px`,
      '--h2-font': h2PreviewFontFamily,
      '--h2-size': `${deferredConfig.advanced.h2.fontSize}px`,
      '--h3-font': h3PreviewFontFamily,
      '--h3-size': `${deferredConfig.advanced.h3.fontSize}px`,
      '--page-number-font': getPreviewFontFamily(deferredConfig.specialOptions.pageNumberFont),
    } as CSSProperties
  }, [
    bodyPreviewFontFamily,
    characterMeasure,
    deferredConfig,
    h1PreviewFontFamily,
    h2PreviewFontFamily,
    h3PreviewFontFamily,
  ])

  const fitScale = Math.min(1, containerWidthPx / A4_CANVAS_WIDTH_PX)
  const zoomScale = zoomMode === 'fit' ? fitScale : zoomMode
  const clampedPage = Math.max(1, Math.min(visiblePage, Math.max(1, pages.length)))

  const boldFirst = deferredConfig.specialOptions.boldFirstSentence
  const boldHeading2 = deferredConfig.specialOptions.boldHeading2
  const boldHeading3 = deferredConfig.specialOptions.boldHeading3

  function handleJumpToPage(pageNum: number) {
    const safePage = Math.max(1, Math.min(pageNum, pages.length))
    visiblePageRef.current = safePage
    setVisiblePage(safePage)
    const target = pageRefs.current.get(safePage)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function stepZoom(direction: -1 | 1) {
    const current = zoomMode === 'fit' ? fitScale : zoomMode
    if (direction < 0) {
      const lower = [...ZOOM_STEPS].reverse().find((s) => s < current - 0.03)
      setZoomMode(lower ?? ZOOM_STEPS[0])
      return
    }
    const higher = ZOOM_STEPS.find((s) => s > current + 0.03)
    setZoomMode(higher ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
  }

  const selectZoomValue = zoomMode === 'fit'
    ? 'fit'
    : ZOOM_SELECT_OPTIONS.some((o) => Number(o.value) === zoomMode)
      ? String(zoomMode)
      : 'custom'

  return (
    <div className="preview-container">
      {isLargeDocument && (
        <div className="preview-large-banner">
          <span className="preview-large-note">
            {isSamplePreview
              ? `超大文档：预览前 ${LARGE_DOCUMENT_SAMPLE_SIZE} 段（共 ${ast.body.length} 段），导出全量不受影响`
              : `完整预览中：共 ${ast.body.length} 段`}
          </span>
          <button
            type="button"
            className="preview-large-btn"
            onClick={() => {
              startTransition(() => {
                setFullPreviewDocKey((prev) => (prev === previewDocKey ? null : previewDocKey))
              })
            }}
          >
            {isSamplePreview ? '展开全文预览' : '恢复快速预览'}
          </button>
        </div>
      )}

      <div ref={scrollRef} className="preview-scroll" style={cssVars}>
        {/* 隐藏度量容器：固定 595.28px */}
        <div ref={measurerRef} className="a4-measurer" aria-hidden="true">
          <div className="a4-measurer-content">
            <DocumentFlow
              title={ast.title}
              body={previewBody}
              boldFirstSentence={boldFirst}
              boldHeading2={boldHeading2}
              boldHeading3={boldHeading3}
              hasStamp={deferredConfig.specialOptions.hasStamp}
              signerTitle={deferredConfig.specialOptions.signerTitle}
              signerStampName={deferredConfig.specialOptions.signerStampName}
            />
          </div>
        </div>

        {pages.map((slice, index) => (
          <div
            key={index}
            ref={(el) => {
              if (el) pageRefs.current.set(index + 1, el)
              else pageRefs.current.delete(index + 1)
            }}
            className="a4-page-slot"
            style={{
              width: `${A4_CANVAS_WIDTH_PX * zoomScale}px`,
              height: `${A4_CANVAS_HEIGHT_PX * zoomScale}px`,
            }}
          >
            <div
              className="a4-page-scaler"
              style={{ transform: `scale(${zoomScale})` }}
            >
              <A4Page
                title={ast.title}
                body={previewBody}
                pageNumber={index + 1}
                sliceOffsetY={slice.sliceOffsetY}
                clipHeight={slice.clipHeight}
                startNodeIndex={slice.startNodeIndex}
                endNodeIndex={slice.endNodeIndex}
                isContinuation={slice.isContinuation}
                showPageNumber={deferredConfig.specialOptions.showPageNumber}
                pageNumberStyle={deferredConfig.specialOptions.pageNumberStyle}
                boldFirstSentence={boldFirst}
                boldHeading2={boldHeading2}
                boldHeading3={boldHeading3}
                headerConfig={deferredConfig.header}
                footerNoteConfig={deferredConfig.footerNote}
                isFirstPage={index === 0}
                isLastPage={index === pages.length - 1}
                hasStamp={deferredConfig.specialOptions.hasStamp}
                signerTitle={deferredConfig.specialOptions.signerTitle}
                signerStampName={deferredConfig.specialOptions.signerStampName}
                onSelectLine={onSelectLine}
              />
            </div>
          </div>
        ))}
      </div>

      {/* A4 纸面底部悬浮控制胶囊 */}
      <div className="preview-floating-pill" role="toolbar" aria-label="页面导航与缩放">
        <button
          type="button"
          className="preview-pill-icon"
          disabled={clampedPage <= 1}
          onClick={() => handleJumpToPage(clampedPage - 1)}
          aria-label="上一页"
          title="上一页"
        >
          ‹
        </button>

        {pages.length > 1 ? (
          <label className="preview-pill-page-select-wrap" title="选择并跳转到指定页">
            <select
              className="preview-pill-select preview-pill-select--page"
              aria-label="跳转页码"
              value={clampedPage}
              onChange={(e) => handleJumpToPage(Number(e.target.value))}
            >
              {pages.map((_, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  第 {idx + 1} / {pages.length} 页
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="preview-pill-text">第 1 / 1 页</span>
        )}

        <button
          type="button"
          className="preview-pill-icon"
          disabled={clampedPage >= pages.length}
          onClick={() => handleJumpToPage(clampedPage + 1)}
          aria-label="下一页"
          title="下一页"
        >
          ›
        </button>

        <span className="preview-pill-divider" aria-hidden="true" />

        <button
          type="button"
          className="preview-pill-icon"
          onClick={() => stepZoom(-1)}
          aria-label="缩小预览"
          title="缩小"
        >
          −
        </button>

        <select
          className="preview-pill-select"
          aria-label="缩放比例"
          value={selectZoomValue}
          onChange={(e) => {
            const val = e.target.value
            if (val === 'fit') setZoomMode('fit')
            else if (val !== 'custom') setZoomMode(Number(val))
          }}
        >
          {ZOOM_SELECT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value === 'fit' ? `适应 (${Math.round(fitScale * 100)}%)` : opt.label}
            </option>
          ))}
          {selectZoomValue === 'custom' && (
            <option value="custom">{Math.round(zoomScale * 100)}%</option>
          )}
        </select>

        <button
          type="button"
          className="preview-pill-icon"
          onClick={() => stepZoom(1)}
          aria-label="放大预览"
          title="放大"
        >
          +
        </button>
      </div>
    </div>
  )
}
