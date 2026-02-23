import { useRef, useMemo, type CSSProperties } from 'react'
import { NodeType } from '../../types/ast'
import type { GongwenAST } from '../../types/ast'
import { useDocumentConfig } from '../../contexts/DocumentConfigContext'
import { cmToPagePercent, CHARS_PER_LINE } from '../../types/documentConfig'
import { usePagination } from '../../hooks/usePagination'
import { A4Page, NODE_CLASS_MAP, renderHeading1, renderHeading2, renderBoldFirstSentence } from './A4Page'
import './A4Page.css'
import './Preview.css'

interface PreviewProps {
  ast: GongwenAST
}

export function Preview({ ast }: PreviewProps) {
  const measurerRef = useRef<HTMLDivElement>(null)
  const { config } = useDocumentConfig()
  const pages = usePagination(ast.title, ast.body, measurerRef)

  /** 将 config 转换为 CSS 自定义属性 */
  const cssVars = useMemo((): CSSProperties => {
    // 计算字符间距，使每行恰好容纳 28 字 (GB/T 9704)
    // 预览以 72dpi 渲染，1pt = 1px，页面宽度 595px
    const pageWidthPx = 595
    const marginLeftPct = config.margins.left * 10 / 210
    const marginRightPct = config.margins.right * 10 / 210
    const availablePx = pageWidthPx * (1 - marginLeftPct - marginRightPct)
    const charSpacingPx = availablePx / CHARS_PER_LINE - config.body.fontSize

    return {
      '--margin-top': `${cmToPagePercent(config.margins.top, 'x')}%`,
      '--margin-bottom': `${cmToPagePercent(config.margins.bottom, 'x')}%`,
      '--margin-left': `${cmToPagePercent(config.margins.left, 'x')}%`,
      '--margin-right': `${cmToPagePercent(config.margins.right, 'x')}%`,
      '--title-font': config.title.fontFamily,
      '--title-size': `${config.title.fontSize}px`,
      '--title-line-height': `${config.title.lineSpacing}px`,
      '--body-font': config.body.fontFamily,
      '--body-size': `${config.body.fontSize}px`,
      '--body-line-height': `${config.body.lineSpacing}px`,
      '--body-indent': `${config.body.firstLineIndent}em`,
      '--char-spacing': `${charSpacingPx.toFixed(4)}px`,
      '--h1-font': config.headings.h1.fontFamily,
      '--h1-size': `${config.headings.h1.fontSize}px`,
      '--h2-font': config.headings.h2.fontFamily,
      '--h2-size': `${config.headings.h2.fontSize}px`,
      '--h3-font': config.advanced.h3.fontFamily,
      '--page-number-font': config.specialOptions.pageNumberFont,
    } as CSSProperties
  }, [config])

  const boldFirst = config.specialOptions.boldFirstSentence

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
            {ast.title && (
              <p className={NODE_CLASS_MAP[ast.title.type]}>{ast.title.content}</p>
            )}
            {ast.body.map((node) => (
              <p
                key={node.lineNumber}
                className={
                  node.type === NodeType.HEADING_1 ? 'a4-h1'
                  : node.type === NodeType.HEADING_2 ? 'a4-h2'
                  : NODE_CLASS_MAP[node.type]
                }
              >
                {node.type === NodeType.HEADING_1
                  ? renderHeading1(node.content)
                  : node.type === NodeType.HEADING_2
                    ? renderHeading2(node.content)
                    : (boldFirst && node.type === NodeType.PARAGRAPH)
                      ? renderBoldFirstSentence(node.content)
                      : node.content}
              </p>
            ))}
          </div>
        </div>

        {/* 渲染分页后的多个 A4 页面（每页渲染完整内容流，通过 offsetY 裁剪） */}
        {pages.map((slice, index) => (
          <A4Page
            key={index}
            title={ast.title}
            body={ast.body}
            pageNumber={index + 1}
            totalPages={pages.length}
            offsetY={slice.offsetY}
            clipHeight={slice.clipHeight}
            showPageNumber={config.specialOptions.showPageNumber}
            boldFirstSentence={boldFirst}
            headerConfig={config.header}
            footerNoteConfig={config.footerNote}
            isFirstPage={index === 0}
            isLastPage={index === pages.length - 1}
          />
        ))}
      </div>
    </div>
  )
}
