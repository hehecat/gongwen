import { NodeType } from '../../types/ast'
import type { DocumentNode } from '../../types/ast'
import type { HeaderConfig, FooterNoteConfig } from '../../types/documentConfig'
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
  /** 版头配置 */
  headerConfig: HeaderConfig
  /** 版记配置 */
  footerNoteConfig: FooterNoteConfig
  /** 是否为第一页 */
  isFirstPage: boolean
  /** 是否为最后一页 */
  isLastPage: boolean
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
  headerConfig,
  footerNoteConfig,
  isFirstPage,
  isLastPage,
}: A4PageProps) {
  return (
    <div className="a4-page">
      <div className="a4-content">
        {/* 版头：仅在第一页且启用时渲染 */}
        {isFirstPage && headerConfig.enabled && headerConfig.orgName && (
          <div className="a4-header-section">
            <div className="a4-header-org">{headerConfig.orgName}</div>
            <div className={`a4-header-meta${headerConfig.signer ? ' a4-header-meta--with-signer' : ''}`}>
              <span>{headerConfig.docNumber}</span>
              {headerConfig.signer && (
                <span>
                  <span className="a4-header-signer-label">签发人：</span>
                  <span className="a4-header-signer-name">{headerConfig.signer}</span>
                </span>
              )}
            </div>
            <div className="a4-header-separator"></div>
          </div>
        )}
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
        {/* 版记：仅在最后一页且启用时渲染 */}
        {isLastPage && footerNoteConfig.enabled && (
          <div className="a4-footer-note">
            <div className="a4-footer-note-line-top"></div>
            {footerNoteConfig.cc && (
              <div className="a4-footer-note-cc">抄送：{footerNoteConfig.cc}</div>
            )}
            {(footerNoteConfig.printer || footerNoteConfig.printDate) && (
              <div className="a4-footer-note-printer">
                <span>{footerNoteConfig.printer}</span>
                <span>{footerNoteConfig.printDate}{footerNoteConfig.printDate && '印发'}</span>
              </div>
            )}
            <div className="a4-footer-note-line-bottom"></div>
          </div>
        )}
      </div>
      {showPageNumber && (
        <div className={`a4-footer ${pageNumber % 2 === 0 ? 'a4-footer-even' : 'a4-footer-odd'}`}>
          — {pageNumber} —
        </div>
      )}
    </div>
  )
}
