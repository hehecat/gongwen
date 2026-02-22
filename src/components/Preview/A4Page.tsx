import { NodeType } from '../../types/ast'
import type { DocumentNode } from '../../types/ast'
import './A4Page.css'

/** 节点类型 → CSS 类名映射 */
export const NODE_CLASS_MAP: Record<NodeType, string> = {
  [NodeType.DOCUMENT_TITLE]: 'a4-title',
  [NodeType.HEADING_1]: 'a4-h1',
  [NodeType.HEADING_2]: 'a4-h2',
  [NodeType.HEADING_3]: 'a4-h3',
  [NodeType.HEADING_4]: 'a4-h4',
  [NodeType.PARAGRAPH]: 'a4-paragraph',
  [NodeType.ADDRESSEE]: 'a4-addressee',
  [NodeType.ATTACHMENT]: 'a4-attachment',
  [NodeType.DATE]: 'a4-date',
}

/**
 * 渲染一级标题：首句（到第一个"。"）用黑体，其余用仿宋正文样式
 */
export function renderHeading1(content: string) {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return <span className="a4-h1-inline">{content}</span>
  }
  return (
    <>
      <span className="a4-h1-inline">{content.slice(0, idx + 1)}</span>
      <span className="a4-paragraph-inline">{content.slice(idx + 1)}</span>
    </>
  )
}

/**
 * 渲染二级标题：首句（到第一个"。"）用楷体，其余用仿宋正文样式
 */
export function renderHeading2(content: string) {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return <span className="a4-h2-inline">{content}</span>
  }
  return (
    <>
      <span className="a4-h2-inline">{content.slice(0, idx + 1)}</span>
      <span className="a4-paragraph-inline">{content.slice(idx + 1)}</span>
    </>
  )
}

/**
 * 渲染正文首句加粗：首句（到第一个"。"）加粗，其余正常
 */
export function renderBoldFirstSentence(content: string) {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return <span className="a4-bold-first">{content}</span>
  }
  return (
    <>
      <span className="a4-bold-first">{content.slice(0, idx + 1)}</span>
      <span>{content.slice(idx + 1)}</span>
    </>
  )
}

interface A4PageProps {
  title: DocumentNode | null
  body: DocumentNode[]
  pageNumber: number
  totalPages: number
  /** 内容流偏移量(px)，用于视窗裁剪定位 */
  offsetY: number
  /** 该页应显示的内容高度(px)，精确到行边界 */
  clipHeight: number
  /** 是否显示页码 */
  showPageNumber: boolean
  /** 是否对正文首句加粗 */
  boldFirstSentence: boolean
}

export function A4Page({
  title,
  body,
  pageNumber,
  totalPages: _totalPages,
  offsetY,
  clipHeight,
  showPageNumber,
  boldFirstSentence,
}: A4PageProps) {
  return (
    <div className="a4-page">
      <div className="a4-content">
        <div className="a4-content-viewport" style={{ height: `${clipHeight}px` }}>
          <div style={{ transform: `translateY(-${offsetY}px)` }}>
            {title && (
              <p className={NODE_CLASS_MAP[title.type]}>{title.content}</p>
            )}
            {body.map((node) => (
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
                    : (boldFirstSentence && node.type === NodeType.PARAGRAPH)
                      ? renderBoldFirstSentence(node.content)
                      : node.content}
              </p>
            ))}
            {!title && body.length === 0 && (
              <p className="a4-placeholder">预览区域</p>
            )}
          </div>
        </div>
      </div>
      {showPageNumber && (
        <div className={`a4-footer ${pageNumber % 2 === 0 ? 'a4-footer-even' : 'a4-footer-odd'}`}>
          — {pageNumber} —
        </div>
      )}
    </div>
  )
}
