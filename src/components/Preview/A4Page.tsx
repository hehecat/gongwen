import React, { type CSSProperties } from 'react'
import { NodeType } from '../../types/ast'
import type { DocumentNode, AttachmentNode, RichTextRun } from '../../types/ast'
import type { HeaderConfig, FooterNoteConfig, SpecialOptionsConfig } from '../../types/documentConfig'
import './A4Page.css'

const TITLE_DATE_RE = /^[（(]?\d{4}年\d{1,2}月\d{1,2}日[）)]?$/

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
  [NodeType.SIGNATURE]: 'a4-signature',
  [NodeType.DATE]: 'a4-date',
}

/**
 * 计算文本的实际宽度（以汉字宽度为单位）
 * - 中文字符（含年月日）：宽度 = 1 个汉字宽度
 * - 阿拉伯数字、英文字母：宽度约为汉字的 0.69 倍
 * - 其他 ASCII 字符：宽度约为汉字的 0.69 倍
 */
function calculateTextWidthEm(text: string): number {
  let width = 0
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
      width += 1
    } else {
      width += 0.69
    }
  }
  return width
}

/**
 * 计算发文机关署名的右缩进值（em 单位）
 * 公式：基础右空字数 + (成文日期宽度 - 署名宽度) / 2
 * - 有印章（hasStamp = true）：基础右空四字
 * - 无印章（hasStamp = false）：基础右空二字
 * 注意：居中偏移可能为负数（署名比日期长时），只需保证最终右缩进 >= 0
 */
export function calculateSignatureIndentEm(
  signatureContent: string,
  dateContent: string,
  hasStamp: boolean
): number {
  const baseIndent = hasStamp ? 4 : 2
  const signatureWidth = calculateTextWidthEm(signatureContent)
  const dateWidth = calculateTextWidthEm(dateContent)
  const centerOffset = (dateWidth - signatureWidth) / 2
  return Math.max(0, baseIndent + centerOffset)
}

function isTitleDateNode(node: DocumentNode, index: number, title: DocumentNode | null): boolean {
  return title !== null && index === 0 && TITLE_DATE_RE.test(node.content.trim())
}

function hasRichStyleOverrides(runs?: RichTextRun[]): boolean {
  return !!runs?.some((run) => run.bold || run.italic || run.underline || run.fontFamily || run.fontSize)
}

function renderRichRuns(runs: RichTextRun[]) {
  return runs.map((run, index) => (
    <span
      key={`${index}-${run.text}`}
      style={{
        fontFamily: run.fontFamily,
        fontSize: run.fontSize ? `${run.fontSize}px` : undefined,
        fontWeight: run.bold ? 'bold' : undefined,
        fontStyle: run.italic ? 'italic' : undefined,
        textDecoration: run.underline ? 'underline' : undefined,
      }}
    >
      {run.text}
    </span>
  ))
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
 * 渲染三级标题：首句（到第一个"。"）用仿宋加粗，其余用仿宋正文样式
 */
export function renderHeading3(content: string) {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return <span className="a4-h3-inline">{content}</span>
  }
  return (
    <>
      <span className="a4-h3-inline">{content.slice(0, idx + 1)}</span>
      <span className="a4-paragraph-inline">{content.slice(idx + 1)}</span>
    </>
  )
}

/**
 * 渲染四级标题：首句（到第一个"。"）用仿宋，其余用仿宋正文样式
 * 四级标题本身与正文同字体，但保持拆分逻辑一致性
 */
export function renderHeading4(content: string) {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return <span className="a4-h4-inline">{content}</span>
  }
  return (
    <>
      <span className="a4-h4-inline">{content.slice(0, idx + 1)}</span>
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

/**
 * 渲染附件说明
 *
 * 单附件模式：附件：xxx
 * 多附件模式：附件：1.xxx
 *                   2.xxx
 *                   3.xxx
 */
export function renderAttachment(node: AttachmentNode): React.ReactNode {
  if (!node.isMultiple) {
    // 单附件模式
    return (
      <p className="a4-attachment a4-attachment--single">
        附件：{node.items[0].name}
      </p>
    )
  }

  // 多附件模式
  const elements: React.ReactNode[] = []

  // 第一个附件紧跟在 "附件：" 后
  const firstItem = node.items[0]
  elements.push(
    <p key="first" className="a4-attachment a4-attachment--multi-first">
      附件：{firstItem.index}.{firstItem.name}
    </p>
  )

  // 从第二个附件开始，每项单独一行
  for (let i = 1; i < node.items.length; i++) {
    const item = node.items[i]
    elements.push(
      <p key={i} className="a4-attachment-item a4-attachment-item--multi">
        {item.index}.{item.name}
      </p>
    )
  }

  return <>{elements}</>
}

interface A4PageProps {
  title: DocumentNode | null
  body: DocumentNode[]
  pageNumber: number
  /** 内容流偏移量(px)，用于视窗裁剪定位 */
  offsetY: number
  /** 该页应显示的内容高度(px)，精确到行边界 */
  clipHeight: number
  /** 是否显示页码 */
  showPageNumber: boolean
  /** 页码样式 */
  pageNumberStyle: PageNumberStyle
  /** 是否对正文首句加粗 */
  boldFirstSentence: boolean
  /** 是否对三级标题加粗 */
  boldHeading3: boolean
  /** 版头配置 */
  headerConfig: HeaderConfig
  /** 版记配置 */
  footerNoteConfig: FooterNoteConfig
  /** 是否为第一页 */
  isFirstPage: boolean
  /** 是否为最后一页 */
  isLastPage: boolean
  /** 页码布局 */
  pageNumberLayout: SpecialOptionsConfig['pageNumberLayout']
  /**
   * 是否加盖印章
   * - true: 成文日期右空四字 (GB/T 9704 7.3.5.1)
   * - false: 成文日期右空二字 (GB/T 9704 7.3.5.2)
   */
  hasStamp: boolean
}

function ensureChinesePeriod(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`
}

export const A4Page = memo(function A4Page({
  title,
  body,
  pageNumber,
  offsetY,
  clipHeight,
  showPageNumber,
  pageNumberStyle,
  boldFirstSentence,
  boldHeading3,
  headerConfig,
  footerNoteConfig,
  isFirstPage,
  isLastPage,
  pageNumberLayout,
  hasStamp,
}: A4PageProps) {
  /**
   * 计算节点的动态样式
   * - SIGNATURE: 以成文日期为基准居中
   * - DATE: 根据 hasStamp 右空四字或二字
   */
  function getNodeStyle(node: DocumentNode, index: number): CSSProperties | undefined {
    if (isTitleDateNode(node, index, title)) return undefined
    if (node.type === NodeType.SIGNATURE) {
      // 查找下一个节点是否为 DATE
      const nextNode = body[index + 1]
      if (nextNode && nextNode.type === NodeType.DATE) {
        const indent = calculateSignatureIndentEm(node.content, nextNode.content, hasStamp)
        return { paddingRight: `${indent}em` }
      }
      // 降级处理：使用基础右空字数
      return { paddingRight: `${hasStamp ? 4 : 2}em` }
    }
    if (node.type === NodeType.DATE) {
      return { paddingRight: `${hasStamp ? 4 : 2}em` }
    }
    return undefined
  }

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
              <p className={NODE_CLASS_MAP[title.type]}>
                {hasRichStyleOverrides(title.runs) ? renderRichRuns(title.runs ?? []) : title.content}
              </p>
            )}
            {body.flatMap((node, index) => {
              const elements: React.ReactNode[] = []
              
              // 发文机关署名前插入 2 个空行
              if (node.type === NodeType.SIGNATURE) {
                for (let j = 0; j < 2; j++) {
                  elements.push(
                    <p key={`empty-${node.lineNumber}-${j}`} className="a4-empty-line">{'\u200B'}</p>
                  )
                }
              }
              
              // 附件说明特殊渲染
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
                      isTitleDateNode(node, index, title)
                        ? 'a4-title-date'
                        : node.type === NodeType.HEADING_1 ? 'a4-h1'
                        : node.type === NodeType.HEADING_2 ? 'a4-h2'
                        : NODE_CLASS_MAP[node.type]
                    }
                    style={getNodeStyle(node, index)}
                  >
                    {node.type === NodeType.HEADING_1
                      ? renderHeading1(node.content)
                      : node.type === NodeType.HEADING_2
                        ? renderHeading2(node.content)
                        : node.type === NodeType.HEADING_3
                          ? renderHeading3(node.content)
                          : node.type === NodeType.HEADING_4
                            ? renderHeading4(node.content)
                            : (boldFirstSentence && node.type === NodeType.PARAGRAPH)
                              ? renderBoldFirstSentence(node.content)
                              : hasRichStyleOverrides(node.runs)
                                ? renderRichRuns(node.runs ?? [])
                                : node.content}
                  </p>
                )
              }
              
              return elements
            })}
            {!title && body.length === 0 && (
              <p className="a4-placeholder">预览区域</p>
            )}
          </div>
        </div>
      </div>
      {/* 版记：绝对定位到最后一页底部，末条线与版心下边缘重合 */}
      {isLastPage && footerNoteConfig.enabled && (
        <div className="a4-footer-note">
          <div className="a4-footer-note-line-top"></div>
          {footerNoteConfig.cc && (
            <div className="a4-footer-note-cc">
              <span className="a4-footer-note-cc-label">抄送：</span>
              <span className="a4-footer-note-cc-text">{ensureChinesePeriod(footerNoteConfig.cc)}</span>
            </div>
          )}
          {footerNoteConfig.cc && (footerNoteConfig.printer || footerNoteConfig.printDate) && (
            <div className="a4-footer-note-line-middle"></div>
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
      {showPageNumber && (
        <div
          className={
            `a4-footer ${
              pageNumberLayout === 'center'
                ? 'a4-footer-center'
                : pageNumber % 2 === 0
                  ? 'a4-footer-even'
                  : 'a4-footer-odd'
            }`
          }
        >
          — {pageNumber} —
        </div>
      )}
    </div>
  )
})
