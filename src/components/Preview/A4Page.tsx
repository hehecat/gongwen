import React, { type CSSProperties } from 'react'
import { NodeType } from '../../types/ast'
import type { DocumentNode, AttachmentNode } from '../../types/ast'
import type { HeaderConfig, FooterNoteConfig } from '../../types/documentConfig'
import {
  NODE_CLASS_MAP,
  calculateSignatureIndentEm,
  renderAttachment,
  renderBoldFirstSentence,
  renderHeading1,
  renderHeading2,
  renderHeading3,
  renderHeading4,
} from './previewRenderers'
import './A4Page.css'

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
  /**
   * 是否加盖印章
   * - true: 成文日期右空四字 (GB/T 9704 7.3.5.1)
   * - false: 成文日期右空二字 (GB/T 9704 7.3.5.2)
   */
  hasStamp: boolean
}

export function A4Page({
  title,
  body,
  pageNumber,
  offsetY,
  clipHeight,
  showPageNumber,
  boldFirstSentence,
  headerConfig,
  footerNoteConfig,
  isFirstPage,
  isLastPage,
  hasStamp,
}: A4PageProps) {
  /**
   * 计算节点的动态样式
   * - SIGNATURE: 以成文日期为基准居中
   * - DATE: 根据 hasStamp 右空四字或二字
   */
  function getNodeStyle(node: DocumentNode, index: number): CSSProperties | undefined {
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
              <p className={NODE_CLASS_MAP[title.type]}>{title.content}</p>
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
                      node.type === NodeType.HEADING_1 ? 'a4-h1'
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
      {showPageNumber && (
        <div className={`a4-footer ${pageNumber % 2 === 0 ? 'a4-footer-even' : 'a4-footer-odd'}`}>
          — {pageNumber} —
        </div>
      )}
    </div>
  )
}
