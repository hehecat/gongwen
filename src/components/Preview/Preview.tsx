import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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
  layoutMode: ViewLayoutMode
  onChangeLayoutMode: (mode: ViewLayoutMode) => void
  onSelectLine?: (lineNumber: number) => void
  onPagesChange?: (pages: PageSlice[]) => void
}

const LARGE_DOCUMENT_PREVIEW_THRESHOLD = 20000
const LARGE_DOCUMENT_SAMPLE_SIZE = 500
const MEASURE_SAMPLE_CHAR = '测'
const PREVIEW_LINE_FIT_TOLERANCE_PX = 1

const ZOOM_OPTIONS: { label: string; value: 'fit' | number }[] = [
  { label: '适应宽度', value: 'fit' },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1 },
  { label: '125%', value: 1.25 },
]

interface CharacterMeasure {
  textWidth: number
  letterSpacingUnits: number
}

export function Preview({
  ast,
  layoutMode,
  onChangeLayoutMode,
  onSelectLine,
  onPagesChange,
}: PreviewProps) {
  const measurerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const [containerWidthPx, setContainerWidthPx] = useState(A4_CANVAS_WIDTH_PX)
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit')
  const [activePageJump, setActivePageJump] = useState(1)
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

  const boldFirst = deferredConfig.specialOptions.boldFirstSentence
  const boldHeading2 = deferredConfig.specialOptions.boldHeading2
  const boldHeading3 = deferredConfig.specialOptions.boldHeading3

  function handleJumpToPage(pageNum: number) {
    setActivePageJump(pageNum)
    const target = pageRefs.current.get(pageNum)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <div className="preview-header-main">
          <span className="preview-label">A4 版式预览</span>
          <span className="preview-hint">
            {isSamplePreview
              ? `抽样 ${pages.length} 页`
              : `共 ${pages.length} 页`}
          </span>
        </div>

        <div className="preview-controls">
          {pages.length > 1 && (
            <label className="preview-control-group" title="快速跳转到指定页">
              <span className="preview-control-label">页码</span>
              <select
                className="preview-select"
                value={Math.min(activePageJump, pages.length)}
                onChange={(e) => handleJumpToPage(Number(e.target.value))}
              >
                {pages.map((_, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    第 {idx + 1} 页
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="preview-zoom-bar" role="group" aria-label="缩放比例">
            {ZOOM_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                className={`preview-chip-btn ${zoomMode === opt.value ? 'preview-chip-btn--active' : ''}`}
                onClick={() => setZoomMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="preview-layout-bar" role="group" aria-label="视图布局">
            <button
              type="button"
              className={`preview-chip-btn ${layoutMode === 'split' ? 'preview-chip-btn--active' : ''}`}
              onClick={() => onChangeLayoutMode('split')}
              title="双栏对照"
            >
              双栏
            </button>
            <button
              type="button"
              className={`preview-chip-btn ${layoutMode === 'preview' ? 'preview-chip-btn--active' : ''}`}
              onClick={() => onChangeLayoutMode(layoutMode === 'preview' ? 'split' : 'preview')}
              title="全屏预览"
            >
              {layoutMode === 'preview' ? '退出全屏' : '专注预览'}
            </button>
          </div>
        </div>

        {isLargeDocument && (
          <div className="preview-actions">
            <span className="preview-mode-note">
              {isSamplePreview
                ? `超大文档：预览前 ${LARGE_DOCUMENT_SAMPLE_SIZE} 段（共 ${ast.body.length} 段），导出全量不受影响`
                : `完整预览中：共 ${ast.body.length} 段`}
            </span>
            <button
              type="button"
              className="preview-action-btn"
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
      </div>

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
    </div>
  )
}
