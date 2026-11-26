import React, { memo, type CSSProperties } from 'react'
import { NodeType } from '../../types/ast'
import type { AttachmentNode, DocumentNode, GongwenAST } from '../../types/ast'
import { calculateSignatureLayout } from '../../layout/typography'
import {
  NODE_CLASS_MAP,
  renderAttachment,
  renderBoldFirstSentence,
  renderHeading1,
  renderHeading2,
  renderHeading3,
  renderHeading4,
  renderMinutesAttendance,
} from './previewRenderers'

interface DocumentFlowProps {
  title: GongwenAST['title']
  body: GongwenAST['body']
  boldFirstSentence: boolean
  boldHeading2: boolean
  boldHeading3: boolean
  hasStamp: boolean
  signerTitle?: string
  signerStampName?: string
  showPlaceholder?: boolean
  /** 节点切片起止索引（-1 表示 title，0..N-1 表示 body） */
  startNodeIndex?: number
  endNodeIndex?: number
  /** 跨页续接页：首节点去掉段前距，使 sliceOffsetY 与内容流精确对齐 */
  isContinuation?: boolean
  onSelectLine?: (lineNumber: number) => void
}

function getNodeStyle(
  node: DocumentNode,
  index: number,
  body: DocumentNode[],
  hasStamp: boolean,
  suppressTopMargin: boolean,
): CSSProperties | undefined {
  const base: CSSProperties = {}

  if (suppressTopMargin) {
    base.marginTop = 0
  }

  if (node.type === NodeType.SIGNATURE) {
    const nextNode = body[index + 1]
    const layout = calculateSignatureLayout(
      node.content,
      nextNode?.type === NodeType.DATE ? nextNode.content : null,
      hasStamp,
    )
    base.paddingRight = `${layout.signatureRightIndentEm}em`
    return base
  }

  if (node.type === NodeType.DATE) {
    const prevNode = index > 0 ? body[index - 1] : undefined
    const layout = calculateSignatureLayout(
      prevNode?.type === NodeType.SIGNATURE ? prevNode.content : null,
      node.content,
      hasStamp,
    )
    base.paddingRight = `${layout.dateRightIndentEm}em`
    return base
  }

  return Object.keys(base).length > 0 ? base : undefined
}

export const DocumentFlow = memo(function DocumentFlow({
  title,
  body,
  boldFirstSentence,
  boldHeading2,
  boldHeading3,
  hasStamp,
  signerTitle = '',
  signerStampName = '',
  showPlaceholder = false,
  startNodeIndex = -1,
  endNodeIndex,
  isContinuation = false,
  onSelectLine,
}: DocumentFlowProps) {
  const resolvedEnd = endNodeIndex ?? body.length - 1
  const includeTitle = Boolean(title && startNodeIndex <= -1)
  const sliceStart = Math.max(0, startNodeIndex)
  const sliceEnd = Math.min(body.length - 1, resolvedEnd)
  const hasSignerStamp = Boolean(signerTitle.trim() || signerStampName.trim())

  const renderNodeContent = (node: DocumentNode) => {
    switch (node.type) {
      case NodeType.HEADING_1:
        return renderHeading1(node.content)
      case NodeType.HEADING_2:
        return renderHeading2(node.content, boldHeading2)
      case NodeType.HEADING_3:
        return renderHeading3(node.content, boldHeading3)
      case NodeType.HEADING_4:
        return renderHeading4(node.content)
      case NodeType.MINUTES_ATTENDANCE:
        return renderMinutesAttendance(node.content)
      case NodeType.PARAGRAPH:
        return boldFirstSentence ? renderBoldFirstSentence(node.content) : node.content
      default:
        return node.content
    }
  }

  let bodyNodes: React.ReactNode[] = []
  if (sliceStart <= sliceEnd && body.length > 0) {
    const elements: React.ReactNode[] = []

    for (let index = sliceStart; index <= sliceEnd; index++) {
      const node = body[index]
      const isSliceFirstNode = isContinuation && index === sliceStart
      const prevNode = index > 0 ? body[index - 1] : undefined
      const nextNode = index + 1 < body.length ? body[index + 1] : undefined

      // 插入署名前空行，或孤立日期前的签名章 / 空行
      if (node.type === NodeType.SIGNATURE) {
        const layout = calculateSignatureLayout(
          node.content,
          nextNode?.type === NodeType.DATE ? nextNode.content : null,
          hasStamp,
        )
        for (let j = 0; j < layout.emptyLinesBefore; j++) {
          elements.push(
            <p
              key={`empty-sig-${node.lineNumber}-${j}`}
              className="a4-empty-line"
              data-node-idx={index}
              data-node-type={NodeType.SIGNATURE}
              data-spacer="true"
            >
              {'\u200B'}
            </p>,
          )
        }
      } else if (node.type === NodeType.DATE && prevNode?.type !== NodeType.SIGNATURE) {
        if (hasSignerStamp) {
          for (let j = 0; j < 2; j++) {
            elements.push(
              <p
                key={`empty-stamp-${node.lineNumber}-${j}`}
                className="a4-empty-line"
                data-node-idx={index}
                data-node-type={NodeType.DATE}
                data-spacer="true"
              >
                {'\u200B'}
              </p>,
            )
          }
          elements.push(
            <p
              key={`stamp-${node.lineNumber}`}
              className="a4-signer-stamp"
              data-node-idx={index}
              data-node-type={NodeType.DATE}
              data-spacer="true"
            >
              {signerTitle.trim() && (
                <span className="a4-signer-stamp-title">{`${signerTitle.trim()}\u3000\u3000`}</span>
              )}
              {signerStampName.trim() && (
                <span className="a4-signer-stamp-name">{signerStampName.trim()}</span>
              )}
            </p>,
          )
          elements.push(
            <p
              key={`empty-stamp-after-${node.lineNumber}`}
              className="a4-empty-line"
              data-node-idx={index}
              data-node-type={NodeType.DATE}
              data-spacer="true"
            >
              {'\u200B'}
            </p>,
          )
        } else {
          const layout = calculateSignatureLayout(null, node.content, hasStamp)
          for (let j = 0; j < layout.emptyLinesBefore; j++) {
            elements.push(
              <p
                key={`empty-date-${node.lineNumber}-${j}`}
                className="a4-empty-line"
                data-node-idx={index}
                data-node-type={NodeType.DATE}
                data-spacer="true"
              >
                {'\u200B'}
              </p>,
            )
          }
        }
      }

      if (node.type === NodeType.ATTACHMENT) {
        elements.push(
          <React.Fragment key={`att-${node.lineNumber}-${index}`}>
            {renderAttachment(node as AttachmentNode, index, isSliceFirstNode, onSelectLine)}
          </React.Fragment>,
        )
        continue
      }

      elements.push(
        <p
          key={`${node.lineNumber}-${index}`}
          className={`${NODE_CLASS_MAP[node.type]} a4-clickable-node`}
          style={getNodeStyle(node, index, body, hasStamp, isSliceFirstNode)}
          data-node-idx={index}
          data-node-type={node.type}
          data-line-number={node.lineNumber}
          data-page-break-before={node.type === NodeType.ATTACHMENT_PAGE_HEADER ? 'true' : undefined}
          onClick={onSelectLine ? () => onSelectLine(node.lineNumber) : undefined}
        >
          {renderNodeContent(node)}
        </p>,
      )
    }

    bodyNodes = elements
  }

  return (
    <>
      {includeTitle && title && title.content.split('\n').map((line, idx, arr) => (
        <p
          key={`title-${title.lineNumber}-${idx}`}
          className={`${NODE_CLASS_MAP[title.type]} a4-clickable-node`}
          style={idx < arr.length - 1 ? { marginBottom: 0 } : undefined}
          data-node-idx={-1}
          data-node-type={NodeType.DOCUMENT_TITLE}
          data-line-number={title.lineNumber + idx}
          onClick={onSelectLine ? () => onSelectLine(title.lineNumber + idx) : undefined}
        >
          {line}
        </p>
      ))}
      {bodyNodes}
      {showPlaceholder && !title && body.length === 0 && (
        <p className="a4-placeholder">请在左侧粘贴或导入公文内容，即可在此实时查看 GB/T 9704 版式预览</p>
      )}
    </>
  )
})
