import React, { memo, type CSSProperties } from 'react'
import { NodeType } from '../../types/ast'
import type { AttachmentNode, DocumentNode, GongwenAST } from '../../types/ast'
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

interface DocumentFlowProps {
  title: GongwenAST['title']
  body: GongwenAST['body']
  boldFirstSentence: boolean
  boldHeading3: boolean
  hasStamp: boolean
  showPlaceholder?: boolean
}

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

export const DocumentFlow = memo(function DocumentFlow({
  title,
  body,
  boldFirstSentence,
  boldHeading3,
  hasStamp,
  showPlaceholder = false,
}: DocumentFlowProps) {
  return (
    <>
      {title && (
        <p className={NODE_CLASS_MAP[title.type]}>{title.content}</p>
      )}
      {body.flatMap((node, index) => {
        const elements: React.ReactNode[] = []

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
              style={getNodeStyle(node, index, body, hasStamp)}
            >
              {node.type === NodeType.HEADING_1
                ? renderHeading1(node.content)
                : node.type === NodeType.HEADING_2
                  ? renderHeading2(node.content)
                  : node.type === NodeType.HEADING_3
                    ? renderHeading3(node.content, boldHeading3)
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
      {showPlaceholder && !title && body.length === 0 && (
        <p className="a4-placeholder">预览区域</p>
      )}
    </>
  )
})
