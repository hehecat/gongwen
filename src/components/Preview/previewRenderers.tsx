import React from 'react'
import { NodeType } from '../../types/ast'
import type { AttachmentNode } from '../../types/ast'

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

export function renderHeading3(content: string, bold = true) {
  const headingClassName = bold ? 'a4-h3-inline a4-h3-inline--bold' : 'a4-h3-inline'
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return <span className={headingClassName}>{content}</span>
  }
  return (
    <>
      <span className={headingClassName}>{content.slice(0, idx + 1)}</span>
      <span className="a4-paragraph-inline">{content.slice(idx + 1)}</span>
    </>
  )
}

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

export function renderAttachment(node: AttachmentNode): React.ReactNode {
  if (!node.isMultiple) {
    return (
      <p className="a4-attachment a4-attachment--single">
        附件：{node.items[0].name}
      </p>
    )
  }

  const elements: React.ReactNode[] = []
  const firstItem = node.items[0]
  elements.push(
    <p key="first" className="a4-attachment a4-attachment--multi-first">
      附件：{firstItem.index}.{firstItem.name}
    </p>
  )

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
