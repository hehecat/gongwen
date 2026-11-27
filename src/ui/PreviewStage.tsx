import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { A4Page } from '../components/Preview/A4Page'
import { DocumentFlow } from '../components/Preview/DocumentFlow'
import '../components/Preview/A4Page.css'
import { usePagination, type PageSlice, type PaginationConfig } from '../hooks/usePagination'
import { A4_CANVAS_HEIGHT_PX, A4_CANVAS_WIDTH_PX, cmToPx } from '../layout/constants'
import type { GongwenAST } from '../types/ast'
import {
  CHARS_PER_LINE,
  cmToPagePercent,
  type DocumentConfig,
} from '../types/documentConfig'
import {
  getPreviewFontFamily,
  getPreviewMixedFontFamily,
} from '../utils/fontAliases'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
} from './icons'

const LARGE_DOC_THRESHOLD = 20000
const LARGE_DOC_PREVIEW_LIMIT = 500
const STAGE_HORIZONTAL_PADDING = 56
const PAGE_GAP_PX = 18

let probeSpan: HTMLSpanElement | null = null

function measure28CharSpacingPx(
  bodyFontFamily: string,
  bodyFontSizePx: number,
  leftMarginCm: number,
  rightMarginCm: number,
): number {
  const availablePx =
    A4_CANVAS_WIDTH_PX - cmToPx(leftMarginCm) - cmToPx(rightMarginCm)

  if (typeof document === 'undefined') {
    return (availablePx - CHARS_PER_LINE * bodyFontSizePx - 1) / CHARS_PER_LINE
  }

  if (!probeSpan || !probeSpan.isConnected) {
    probeSpan = document.createElement('span')
    probeSpan.setAttribute('aria-hidden', 'true')
    probeSpan.style.position = 'fixed'
    probeSpan.style.top = '-9999px'
    probeSpan.style.left = '-9999px'
    probeSpan.style.visibility = 'hidden'
    probeSpan.style.pointerEvents = 'none'
    probeSpan.style.whiteSpace = 'nowrap'
    probeSpan.textContent = '测'.repeat(CHARS_PER_LINE)
    document.body.appendChild(probeSpan)
  }

  probeSpan.style.fontFamily = `${bodyFontFamily}, 'FangSong_GB2312', 'FangSong', 'STFangsong', serif`
  probeSpan.style.fontSize = `${bodyFontSizePx}px`
  probeSpan.style.letterSpacing = '0px'
  const textWidth = probeSpan.getBoundingClientRect().width

  probeSpan.style.letterSpacing = '1px'
  const widthPlusOne = probeSpan.getBoundingClientRect().width

  if (textWidth <= 0) {
    return (availablePx - CHARS_PER_LINE * bodyFontSizePx - 1) / CHARS_PER_LINE
  }

  const measuredUnits = widthPlusOne - textWidth
  const letterSpacingUnits = measuredUnits > 0.5 ? measuredUnits : CHARS_PER_LINE

  return (availablePx - textWidth - 1) / letterSpacingUnits
}

interface PreviewStageProps {
  ast: GongwenAST
  config: DocumentConfig
  draftId: string
  hiddenOnScreen?: boolean
  onSelectLine: (lineNumber: number) => void
  onPagesChange: (pages: PageSlice[]) => void
}

export function PreviewStage({
  ast,
  config,
  draftId,
  hiddenOnScreen = false,
  onSelectLine,
  onPagesChange,
}: PreviewStageProps) {
  const deferredConfig = useDeferredValue(config)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const measurerRef = useRef<HTMLDivElement | null>(null)

  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit')
  const [manualZoom, setManualZoom] = useState<number>(1)
  const [fitScale, setFitScale] = useState<number>(0.88)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [fullPreviewDraftId, setFullPreviewDraftId] = useState<string | null>(null)

  const isLargeDoc = ast.body.length > LARGE_DOC_THRESHOLD
  const showFullLargeDoc = fullPreviewDraftId === draftId
  const previewBody = useMemo(
    () =>
      isLargeDoc && !showFullLargeDoc
        ? ast.body.slice(0, LARGE_DOC_PREVIEW_LIMIT)
        : ast.body,
    [ast.body, isLargeDoc, showFullLargeDoc],
  )

  // Compute fit-to-width scale reactively via ResizeObserver
  useEffect(() => {
    const scroller = scrollContainerRef.current
    if (!scroller) return

    const updateFit = () => {
      const w = scroller.clientWidth
      if (w <= 80) return
      const horizontalPadding = w <= 640 ? 20 : STAGE_HORIZONTAL_PADDING
      const target = (w - horizontalPadding) / A4_CANVAS_WIDTH_PX
      const clamped = Math.min(1.18, Math.max(0.38, Number(target.toFixed(3))))
      setFitScale(clamped)
    }

    updateFit()
    const observer = new ResizeObserver(updateFit)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  const zoomScale = zoomMode === 'fit' ? fitScale : manualZoom

  // Build stable PaginationConfig for usePagination
  const paginationConfig = useMemo<PaginationConfig>(
    () => ({
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
    }),
    [
      deferredConfig.advanced,
      deferredConfig.body,
      deferredConfig.footerNote,
      deferredConfig.header,
      deferredConfig.margins,
      deferredConfig.specialOptions.boldFirstSentence,
      deferredConfig.specialOptions.boldHeading2,
      deferredConfig.specialOptions.boldHeading3,
      deferredConfig.specialOptions.hasStamp,
      deferredConfig.specialOptions.signerStampName,
      deferredConfig.specialOptions.signerTitle,
      deferredConfig.title,
    ],
  )

  const pages = usePagination(ast.title, previewBody, measurerRef, paginationConfig)

  useEffect(() => {
    onPagesChange(pages)
  }, [onPagesChange, pages])

  // Compute all 21 required GB/T 9704 CSS Custom Properties on shared parent container
  const cssVars = useMemo<CSSProperties>(() => {
    const { margins, header, title, body, advanced, specialOptions } = deferredConfig
    const bodyPreviewFontFamily = getPreviewMixedFontFamily(
      body.fontFamily,
      body.asciiFontFamily,
    )
    const charSpacingPx = measure28CharSpacingPx(
      bodyPreviewFontFamily,
      body.fontSize,
      margins.left,
      margins.right,
    )

    return {
      '--margin-top': `${cmToPagePercent(margins.top, 'x')}%`,
      '--margin-bottom': `${cmToPagePercent(margins.bottom, 'x')}%`,
      '--margin-left': `${cmToPagePercent(margins.left, 'x')}%`,
      '--margin-right': `${cmToPagePercent(margins.right, 'x')}%`,
      '--margin-bottom-y': `${cmToPagePercent(margins.bottom, 'y')}%`,
      '--header-org-font': getPreviewFontFamily(header.orgNameFontFamily),
      '--title-font': getPreviewFontFamily(title.fontFamily),
      '--title-size': `${title.fontSize}px`,
      '--title-line-height': `${title.lineSpacing}px`,
      '--body-font': bodyPreviewFontFamily,
      '--body-size': `${body.fontSize}px`,
      '--body-line-height': `${body.lineSpacing}px`,
      '--body-indent': `${body.firstLineIndent}em`,
      '--char-spacing': `${charSpacingPx.toFixed(4)}px`,
      '--h1-font': getPreviewMixedFontFamily(
        advanced.h1.fontFamily,
        advanced.h1.asciiFontFamily,
      ),
      '--h1-size': `${advanced.h1.fontSize}px`,
      '--h2-font': getPreviewMixedFontFamily(
        advanced.h2.fontFamily,
        advanced.h2.asciiFontFamily,
      ),
      '--h2-size': `${advanced.h2.fontSize}px`,
      '--h3-font': getPreviewMixedFontFamily(
        advanced.h3.fontFamily,
        advanced.h3.asciiFontFamily,
      ),
      '--h3-size': `${advanced.h3.fontSize}px`,
      '--page-number-font': getPreviewFontFamily(specialOptions.pageNumberFont),
    } as CSSProperties
  }, [deferredConfig])

  // Track visible page index on scroll
  const handleScroll = useCallback(() => {
    const scroller = scrollContainerRef.current
    if (!scroller) return
    const scaledPageStride = A4_CANVAS_HEIGHT_PX * zoomScale + PAGE_GAP_PX
    if (scaledPageStride <= 0) return
    const centerY = scroller.scrollTop + scroller.clientHeight * 0.35
    const idx = Math.floor(centerY / scaledPageStride) + 1
    const clamped = Math.max(1, Math.min(pages.length, idx))
    setCurrentPage(clamped)
  }, [pages.length, zoomScale])

  const safeCurrentPage = Math.min(currentPage, Math.max(1, pages.length))

  const jumpToPage = (targetPage: number) => {
    const scroller = scrollContainerRef.current
    if (!scroller) return
    const clamped = Math.max(1, Math.min(pages.length, targetPage))
    const slots = scroller.querySelectorAll<HTMLElement>('.a4-page-slot')
    const targetEl = slots[clamped - 1]
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setCurrentPage(clamped)
  }

  const adjustZoom = (delta: number) => {
    const base = zoomMode === 'fit' ? fitScale : manualZoom
    const next = Math.min(1.6, Math.max(0.5, Number((base + delta).toFixed(2))))
    setZoomMode('manual')
    setManualZoom(next)
  }

  const zoomPercent = Math.round(zoomScale * 100)

  return (
    <section
      className={`cb-stage-pane${hiddenOnScreen ? ' is-hidden-screen' : ''}`}
      aria-label="GB/T 9704 A4 实时纸张预览"
    >
      {/* Large Document Performance Guard Banner */}
      {isLargeDoc && !showFullLargeDoc && (
        <div className="cb-large-doc-banner cb-no-print">
          <span>
            当前文稿共 {ast.body.length.toLocaleString()} 段，为保持流畅编辑已仅渲染前{' '}
            {LARGE_DOC_PREVIEW_LIMIT} 段预览（导出 Word 仍包含全文）。
          </span>
          <button
            type="button"
            className="cb-btn-inline-primary"
            onClick={() => setFullPreviewDraftId(draftId)}
          >
            加载完整预览
          </button>
        </div>
      )}

      {/* Scrollable Tactile Stationery Canvas */}
      <div
        ref={scrollContainerRef}
        className="cb-stage-scroll"
        onScroll={handleScroll}
      >
        <div className="cb-stage-inner">
          {/* CRITICAL CONTRACT: Shared relative parent holding BOTH .a4-measurer and .a4-page-slot items */}
          <div className="cb-a4-host" style={cssVars}>
            <div ref={measurerRef} className="a4-measurer" aria-hidden="true">
              <div className="a4-measurer-content">
                <DocumentFlow
                  title={ast.title}
                  body={previewBody}
                  boldFirstSentence={deferredConfig.specialOptions.boldFirstSentence}
                  boldHeading2={deferredConfig.specialOptions.boldHeading2}
                  boldHeading3={deferredConfig.specialOptions.boldHeading3}
                  hasStamp={deferredConfig.specialOptions.hasStamp}
                  signerTitle={deferredConfig.specialOptions.signerTitle}
                  signerStampName={deferredConfig.specialOptions.signerStampName}
                />
              </div>
            </div>

            {pages.map((slice, idx) => (
              <div
                key={idx}
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
                    pageNumber={idx + 1}
                    sliceOffsetY={slice.sliceOffsetY}
                    clipHeight={slice.clipHeight}
                    startNodeIndex={slice.startNodeIndex}
                    endNodeIndex={slice.endNodeIndex}
                    isContinuation={slice.isContinuation}
                    showPageNumber={deferredConfig.specialOptions.showPageNumber}
                    pageNumberStyle={deferredConfig.specialOptions.pageNumberStyle}
                    boldFirstSentence={deferredConfig.specialOptions.boldFirstSentence}
                    boldHeading2={deferredConfig.specialOptions.boldHeading2}
                    boldHeading3={deferredConfig.specialOptions.boldHeading3}
                    headerConfig={deferredConfig.header}
                    footerNoteConfig={deferredConfig.footerNote}
                    isFirstPage={idx === 0}
                    isLastPage={idx === pages.length - 1}
                    hasStamp={deferredConfig.specialOptions.hasStamp}
                    signerTitle={deferredConfig.specialOptions.signerTitle}
                    signerStampName={deferredConfig.specialOptions.signerStampName}
                    onSelectLine={onSelectLine}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Precision Canvas HUD */}
      <div className="cb-stage-hud cb-no-print cb-tabular">
        {pages.length > 1 && (
          <>
            <div className="cb-hud-group">
              <button
                type="button"
                className="cb-hud-btn"
                aria-label="上一页"
                disabled={safeCurrentPage <= 1}
                onClick={() => jumpToPage(safeCurrentPage - 1)}
              >
                <ChevronLeftIcon size={14} />
              </button>
              <span className="cb-hud-page">
                第 {safeCurrentPage} / {pages.length} 页
              </span>
              <button
                type="button"
                className="cb-hud-btn"
                aria-label="下一页"
                disabled={safeCurrentPage >= pages.length}
                onClick={() => jumpToPage(safeCurrentPage + 1)}
              >
                <ChevronRightIcon size={14} />
              </button>
            </div>
            <span className="cb-hud-sep" aria-hidden="true" />
          </>
        )}

        {/* Zoom Controls */}
        <div className="cb-hud-group">
          <button
            type="button"
            className="cb-hud-btn"
            aria-label="缩小预览"
            disabled={zoomScale <= 0.5}
            onClick={() => adjustZoom(-0.1)}
          >
            <MinusIcon size={13} />
          </button>
          <button
            type="button"
            className={`cb-hud-zoom-pill${zoomMode === 'fit' ? ' is-fit' : ''}`}
            title={zoomMode === 'fit' ? '点击切换为 100% 原始比例' : '点击恢复自动适应窗口宽度'}
            onClick={() => {
              if (zoomMode === 'fit') {
                setZoomMode('manual')
                setManualZoom(1)
              } else {
                setZoomMode('fit')
              }
            }}
          >
            {zoomMode === 'fit' ? `适应 ${zoomPercent}%` : `${zoomPercent}%`}
          </button>
          <button
            type="button"
            className="cb-hud-btn"
            aria-label="放大预览"
            disabled={zoomScale >= 1.6}
            onClick={() => adjustZoom(0.1)}
          >
            <PlusIcon size={13} />
          </button>
        </div>
      </div>
    </section>
  )
}
