import { useDeferredValue, useRef, useMemo, type CSSProperties } from 'react'
import type { GongwenAST } from '../../types/ast'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { cmToPagePercent, CHARS_PER_LINE } from '../../types/documentConfig'
import { usePagination } from '../../hooks/usePagination'
import { A4Page } from './A4Page'
import { DocumentFlow } from './DocumentFlow'
import './A4Page.css'
import './Preview.css'

interface PreviewProps {
  ast: GongwenAST
}

export function Preview({ ast }: PreviewProps) {
  const measurerRef = useRef<HTMLDivElement>(null)
  const { config } = useDocumentConfig()
  const deferredConfig = useDeferredValue(config)
  const paginationConfig = useMemo(() => ({
    margins: {
      top: deferredConfig.margins.top,
      bottom: deferredConfig.margins.bottom,
      left: deferredConfig.margins.left,
      right: deferredConfig.margins.right,
    },
    header: {
      enabled: deferredConfig.header.enabled,
      orgName: deferredConfig.header.orgName,
      docNumber: deferredConfig.header.docNumber,
      signer: deferredConfig.header.signer,
    },
    footerNote: {
      enabled: deferredConfig.footerNote.enabled,
      cc: deferredConfig.footerNote.cc,
      printer: deferredConfig.footerNote.printer,
      printDate: deferredConfig.footerNote.printDate,
    },
    title: {
      fontFamily: deferredConfig.title.fontFamily,
      fontSize: deferredConfig.title.fontSize,
      lineSpacing: deferredConfig.title.lineSpacing,
    },
    body: {
      fontFamily: deferredConfig.body.fontFamily,
      fontSize: deferredConfig.body.fontSize,
      lineSpacing: deferredConfig.body.lineSpacing,
      firstLineIndent: deferredConfig.body.firstLineIndent,
    },
    headings: {
      h1: {
        fontFamily: deferredConfig.headings.h1.fontFamily,
        fontSize: deferredConfig.headings.h1.fontSize,
      },
      h2: {
        fontFamily: deferredConfig.headings.h2.fontFamily,
        fontSize: deferredConfig.headings.h2.fontSize,
      },
      h3FontFamily: deferredConfig.advanced.h3.fontFamily,
    },
    specialOptions: {
      boldFirstSentence: deferredConfig.specialOptions.boldFirstSentence,
      boldHeading3: deferredConfig.specialOptions.boldHeading3,
      hasStamp: deferredConfig.specialOptions.hasStamp,
    },
  }), [
    deferredConfig.margins.top,
    deferredConfig.margins.bottom,
    deferredConfig.margins.left,
    deferredConfig.margins.right,
    deferredConfig.header.enabled,
    deferredConfig.header.orgName,
    deferredConfig.header.docNumber,
    deferredConfig.header.signer,
    deferredConfig.footerNote.enabled,
    deferredConfig.footerNote.cc,
    deferredConfig.footerNote.printer,
    deferredConfig.footerNote.printDate,
    deferredConfig.title.fontFamily,
    deferredConfig.title.fontSize,
    deferredConfig.title.lineSpacing,
    deferredConfig.body.fontFamily,
    deferredConfig.body.fontSize,
    deferredConfig.body.lineSpacing,
    deferredConfig.body.firstLineIndent,
    deferredConfig.headings.h1.fontFamily,
    deferredConfig.headings.h1.fontSize,
    deferredConfig.headings.h2.fontFamily,
    deferredConfig.headings.h2.fontSize,
    deferredConfig.advanced.h3.fontFamily,
    deferredConfig.specialOptions.boldFirstSentence,
    deferredConfig.specialOptions.boldHeading3,
    deferredConfig.specialOptions.hasStamp,
  ])
  const pages = usePagination(ast.title, ast.body, measurerRef, paginationConfig)

  /** 将 config 转换为 CSS 自定义属性 */
  const cssVars = useMemo((): CSSProperties => {
    // 计算字符间距，使每行恰好容纳 28 字 (GB/T 9704)
    // 预览以 72dpi 渲染，1pt = 1px，页面宽度 595px
    const pageWidthPx = 595
    const marginLeftPct = deferredConfig.margins.left * 10 / 210
    const marginRightPct = deferredConfig.margins.right * 10 / 210
    const availablePx = pageWidthPx * (1 - marginLeftPct - marginRightPct)
    const charSpacingPx = availablePx / CHARS_PER_LINE - deferredConfig.body.fontSize

    return {
      '--margin-top': `${cmToPagePercent(deferredConfig.margins.top, 'x')}%`,
      '--margin-bottom': `${cmToPagePercent(deferredConfig.margins.bottom, 'x')}%`,
      '--margin-left': `${cmToPagePercent(deferredConfig.margins.left, 'x')}%`,
      '--margin-right': `${cmToPagePercent(deferredConfig.margins.right, 'x')}%`,
      // 版记绝对定位使用 y 轴百分比（相对页面高度 297mm，而非宽度 210mm）
      '--margin-bottom-y': `${cmToPagePercent(deferredConfig.margins.bottom, 'y')}%`,
      '--title-font': deferredConfig.title.fontFamily,
      '--title-size': `${deferredConfig.title.fontSize}px`,
      '--title-line-height': `${deferredConfig.title.lineSpacing}px`,
      '--body-font': deferredConfig.body.fontFamily,
      '--body-size': `${deferredConfig.body.fontSize}px`,
      '--body-line-height': `${deferredConfig.body.lineSpacing}px`,
      '--body-indent': `${deferredConfig.body.firstLineIndent}em`,
      '--char-spacing': `${charSpacingPx.toFixed(4)}px`,
      '--h1-font': deferredConfig.headings.h1.fontFamily,
      '--h1-size': `${deferredConfig.headings.h1.fontSize}px`,
      '--h2-font': deferredConfig.headings.h2.fontFamily,
      '--h2-size': `${deferredConfig.headings.h2.fontSize}px`,
      '--h3-font': deferredConfig.advanced.h3.fontFamily,
      '--page-number-font': deferredConfig.specialOptions.pageNumberFont,
    } as CSSProperties
  }, [deferredConfig])

  const boldFirst = deferredConfig.specialOptions.boldFirstSentence
  const boldHeading3 = deferredConfig.specialOptions.boldHeading3

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="preview-label">预览</span>
        <span className="preview-hint">共 {pages.length} 页</span>
      </div>
      <div className="preview-scroll" style={cssVars}>
        {/* 隐藏度量容器：渲染全部节点用于高度测量（与 A4Page 使用相同的 CSS 类和渲染逻辑） */}
        <div ref={measurerRef} className="a4-measurer" aria-hidden="true">
          <div className="a4-measurer-content">
            <DocumentFlow
              title={ast.title}
              body={ast.body}
              boldFirstSentence={boldFirst}
              boldHeading3={boldHeading3}
              hasStamp={deferredConfig.specialOptions.hasStamp}
            />
          </div>
        </div>

        {/* 渲染分页后的多个 A4 页面（每页渲染完整内容流，通过 offsetY 裁剪） */}
        {pages.map((slice, index) => (
          <A4Page
            key={index}
            title={ast.title}
            body={ast.body}
            pageNumber={index + 1}
            offsetY={slice.offsetY}
            clipHeight={slice.clipHeight}
            showPageNumber={deferredConfig.specialOptions.showPageNumber}
            boldFirstSentence={boldFirst}
            boldHeading3={boldHeading3}
            headerConfig={deferredConfig.header}
            footerNoteConfig={deferredConfig.footerNote}
            isFirstPage={index === 0}
            isLastPage={index === pages.length - 1}
            hasStamp={deferredConfig.specialOptions.hasStamp}
          />
        ))}
      </div>
    </div>
  )
}
