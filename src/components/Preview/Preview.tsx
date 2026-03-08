import React, { useRef, useMemo, type CSSProperties } from 'react'
import { NodeType } from '../../types/ast'
import type { GongwenAST, DocumentNode, AttachmentNode } from '../../types/ast'
import { useDocumentConfig } from '../../contexts/DocumentConfigContext'
import { cmToPagePercent, CHARS_PER_LINE } from '../../types/documentConfig'
import { usePagination } from '../../hooks/usePagination'
import { A4Page, NODE_CLASS_MAP, renderHeading1, renderHeading2, renderHeading3, renderHeading4, renderBoldFirstSentence, renderAttachment, calculateSignatureIndentEm } from './A4Page'
import './A4Page.css'
import './Preview.css'

interface PreviewProps {
  ast: GongwenAST
}

/**
 * 计算节点的动态样式（用于 measurer）
 * - SIGNATURE: 以成文日期为基准居中
 * - DATE: 根据 hasStamp 右空四字或二字
 */
function getNodeStyle(
  node: DocumentNode,
  index: number,
  body: DocumentNode[],
  hasStamp: boolean
): CSSProperties | undefined {
  if (node.type === NodeType.SIGNATURE) {
    const nextNode = body[index + 1]
    if (nextNode && nextNode.type === NodeType.DATE) {
      const indent = calculateSignatureIndentEm(node.content, nextNode.content, hasStamp)
      return { paddingRight: `${indent}em` }
    }
    return { paddingRight: `${hasStamp ? 4 : 2}em` }
  }
  if (node.type === NodeType.DATE) {
    return { paddingRight: `${hasStamp ? 4 : 2}em` }
  }
  return undefined
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
      // 版记绝对定位使用 y 轴百分比（相对页面高度 297mm，而非宽度 210mm）
      '--margin-bottom-y': `${cmToPagePercent(config.margins.bottom, 'y')}%`,
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
      // 表格配置
      '--table-font': config.table.fontFamily,
      '--table-size': `${config.table.fontSize}px`,
      '--table-line-height': `${config.table.lineSpacing}px`,
      '--table-bold-header': config.table.boldHeader ? 'bold' : 'normal',
    } as CSSProperties
  }, [config])

  const boldFirst = config.specialOptions.boldFirstSentence

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="preview-label">预览（浏览器样式仅供参考，请导出 Word 确认）</span>
        <span className="preview-hint">共 {pages.length} 页</span>
      </div>
      <div className="preview-scroll" style={cssVars}>
        {/* 隐藏度量容器：渲染全部节点用于高度测量（与 A4Page 使用相同的 CSS 类和渲染逻辑） */}
        <div ref={measurerRef} className="a4-measurer" aria-hidden="true">
          <div className="a4-measurer-content">
            {/* 渲染多段标题 */}
            {ast.title.length > 0 && ast.title.map((titleNode, titleIndex) => (
              <p key={`title-${titleIndex}`} className={NODE_CLASS_MAP[titleNode.type]}>
                {titleNode.content}
              </p>
            ))}
            {/* 标题后添加一个固定行距的空行 */}
            {ast.title.length > 0 && (
              <p className="a4-empty-line">{'\u200B'}</p>
            )}
            {ast.body.flatMap((node, index) => {
              const elements: React.ReactNode[] = []
              
              // 发文机关署名前插入 2 个空行
              if (node.type === NodeType.SIGNATURE) {
                for (let j = 0; j < 2; j++) {
                  elements.push(
                    <p key={`empty-${node.lineNumber}-${j}`} className="a4-empty-line">{'\u200B'}</p>
                  )
                }
              }
              
              if (node.type === NodeType.ATTACHMENT) {
                elements.push(
                  <React.Fragment key={node.lineNumber}>
                    {renderAttachment(node as AttachmentNode)}
                  </React.Fragment>
                )
              } else {
                elements.push(
                  <p
                    key={node.lineNumber}
                    className={
                      node.type === NodeType.HEADING_1 ? 'a4-h1'
                      : node.type === NodeType.HEADING_2 ? 'a4-h2'
                      : NODE_CLASS_MAP[node.type]
                    }
                    style={getNodeStyle(node, index, ast.body, config.specialOptions.hasStamp)}
                  >
                    {node.type === NodeType.HEADING_1
                      ? renderHeading1(node.content)
                      : node.type === NodeType.HEADING_2
                        ? renderHeading2(node.content)
                        : node.type === NodeType.HEADING_3
                          ? renderHeading3(node.content)
                          : node.type === NodeType.HEADING_4
                            ? renderHeading4(node.content)
                            : (boldFirst && node.type === NodeType.PARAGRAPH)
                              ? renderBoldFirstSentence(node.content)
                              : node.content}
                  </p>
                )
              }
              
              return elements
            })}
          </div>
          {/* 隐藏版记：用于度量版记高度，始终渲染以便在分页计算时获取高度 */}
          {config.footerNote.enabled && (
            <div className="a4-footer-note a4-footer-note--measurer">
              <div className="a4-footer-note-line-top"></div>
              {config.footerNote.cc && (
                <div className="a4-footer-note-cc">抄送：{config.footerNote.cc}</div>
              )}
              {(config.footerNote.printer || config.footerNote.printDate) && (
                <div className="a4-footer-note-printer">
                  <span>{config.footerNote.printer}</span>
                  <span>{config.footerNote.printDate}{config.footerNote.printDate && '印发'}</span>
                </div>
              )}
              <div className="a4-footer-note-line-bottom"></div>
            </div>
          )}
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
            hasStamp={config.specialOptions.hasStamp}
          />
        ))}
      </div>
    </div>
  )
}
