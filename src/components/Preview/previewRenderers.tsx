import React from 'react'
import { NodeType } from '../../types/ast'
import type { AttachmentNode } from '../../types/ast'
import { splitFirstSentence, splitMinutesAttendance } from '../../layout/typography'

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
  [NodeType.POSTSCRIPT]: 'a4-postscript',
  [NodeType.MINUTES_ATTENDANCE]: 'a4-minutes-attendance',
  [NodeType.ATTACHMENT_PAGE_HEADER]: 'a4-attachment-page-header',
}

export function renderHeading1(content: string) {
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return <span className="a4-h1-inline">{lead}</span>
  }
  return (
    <>
      <span className="a4-h1-inline">{lead}</span>
      <span className="a4-paragraph-inline">{rest}</span>
    </>
  )
}

export function renderHeading2(content: string, bold = false) {
  const headingClassName = bold ? 'a4-h2-inline a4-h2-inline--bold' : 'a4-h2-inline'
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return <span className={headingClassName}>{lead}</span>
  }
  return (
    <>
      <span className={headingClassName}>{lead}</span>
      <span className="a4-paragraph-inline">{rest}</span>
    </>
  )
}

export function renderHeading3(content: string, bold = true) {
  const headingClassName = bold ? 'a4-h3-inline a4-h3-inline--bold' : 'a4-h3-inline'
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return <span className={headingClassName}>{lead}</span>
  }
  return (
    <>
      <span className={headingClassName}>{lead}</span>
      <span className="a4-paragraph-inline">{rest}</span>
    </>
  )
}

export function renderHeading4(content: string) {
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return <span className="a4-h4-inline">{lead}</span>
  }
  return (
    <>
      <span className="a4-h4-inline">{lead}</span>
      <span className="a4-paragraph-inline">{rest}</span>
    </>
  )
}

export function renderBoldFirstSentence(content: string) {
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return <span className="a4-bold-first">{lead}</span>
  }
  return (
    <>
      <span className="a4-bold-first">{lead}</span>
      <span>{rest}</span>
    </>
  )
}

export function renderMinutesAttendance(content: string) {
  const parsed = splitMinutesAttendance(content)
  if (!parsed) return content
  return (
    <>
      <span className="a4-h1-inline">{parsed.label}</span>
      <span className="a4-paragraph-inline">{parsed.names}</span>
    </>
  )
}

export function renderAttachment(
  node: AttachmentNode,
  nodeIndex: number,
  suppressTopMargin: boolean,
  onSelectLine?: (lineNumber: number) => void,
): React.ReactNode {
  const firstStyle = suppressTopMargin ? { marginTop: 0 } : undefined
  const handleClick = onSelectLine ? () => onSelectLine(node.lineNumber) : undefined

  if (!node.isMultiple) {
    return (
      <p
        className="a4-attachment a4-attachment--single a4-clickable-node"
        style={firstStyle}
        data-node-idx={nodeIndex}
        data-node-type={NodeType.ATTACHMENT}
        data-line-number={node.lineNumber}
        onClick={handleClick}
      >
        附件：{node.items[0].name}
      </p>
    )
  }

  const elements: React.ReactNode[] = []
  const firstItem = node.items[0]
  elements.push(
    <p
      key="first"
      className="a4-attachment a4-attachment--multi-first a4-clickable-node"
      style={firstStyle}
      data-node-idx={nodeIndex}
      data-node-type={NodeType.ATTACHMENT}
      data-line-number={node.lineNumber}
      onClick={handleClick}
    >
      附件：{firstItem.index}.{firstItem.name}
    </p>,
  )

  for (let i = 1; i < node.items.length; i++) {
    const item = node.items[i]
    elements.push(
      <p
        key={i}
        className="a4-attachment-item a4-attachment-item--multi a4-clickable-node"
        data-node-idx={nodeIndex}
        data-node-type={NodeType.ATTACHMENT}
        data-line-number={node.lineNumber}
        onClick={handleClick}
      >
        {item.index}.{item.name}
      </p>,
    )
  }

  return <>{elements}</>
}
