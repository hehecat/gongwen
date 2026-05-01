import type { GongwenAST, DocumentNode, AttachmentNode } from '../types/ast'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import type { AutoFixResult, TextFixOptions } from './sanitize'
import { autoFixDocumentText } from './sanitize'

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

function wrapHtml(html: string): string {
  return `<div data-editor-root="true">${html}</div>`
}

function createDocument(html: string): Document | null {
  if (typeof DOMParser === 'undefined') return null
  return new DOMParser().parseFromString(wrapHtml(html), 'text/html')
}

function getRoot(doc: Document | null): HTMLElement | null {
  return doc?.body.firstElementChild as HTMLElement | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function plainTextToEditorHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, '\n')
  const lines = normalized.split('\n')

  if (lines.length === 1 && lines[0] === '') {
    return '<p><br></p>'
  }

  return lines
    .map((line) => (line.length === 0 ? '<p><br></p>' : `<p>${escapeHtml(line)}</p>`))
    .join('')
}

export function normalizeEditorHtml(html: string): string {
  if (!html.trim()) return '<p><br></p>'

  const doc = createDocument(html)
  const root = getRoot(doc)
  if (!root) return plainTextToEditorHtml(html)

  const directBlockChildren = Array.from(root.childNodes).some((node) => (
    node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as Element).tagName)
  ))

  if (!directBlockChildren) {
    const text = root.textContent ?? ''
    return plainTextToEditorHtml(text)
  }

  if (root.innerHTML.trim() === '') return '<p><br></p>'
  return root.innerHTML
}

export function editorHtmlToPlainText(html: string): string {
  const doc = createDocument(html)
  const root = getRoot(doc)
  if (!root) return html

  const lines: string[] = []
  const children = Array.from(root.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as Element).tagName)) {
      const text = (child.textContent ?? '').replace(/\u00a0/g, ' ')
      lines.push(text)
    } else if (child.nodeType === Node.TEXT_NODE) {
      lines.push((child.textContent ?? '').replace(/\u00a0/g, ' '))
    }
  }

  return lines.join('\n')
}

export function editorHtmlHasContent(html: string): boolean {
  return editorHtmlToPlainText(html).trim().length > 0
}

export function autoFixEditorHtml(html: string, options: TextFixOptions): AutoFixResult {
  const doc = createDocument(html)
  const root = getRoot(doc)
  if (!root) return autoFixDocumentText(html, options)

  let punctuationCount = 0
  let whitespaceCount = 0

  const walker = doc!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentNode = walker.nextNode()

  while (currentNode) {
    const original = currentNode.textContent ?? ''
    if (original.length > 0) {
      const fixed = autoFixDocumentText(original, options)
      currentNode.textContent = fixed.text
      punctuationCount += fixed.punctuationCount
      whitespaceCount += fixed.whitespaceCount
    }
    currentNode = walker.nextNode()
  }

  return {
    text: normalizeEditorHtml(root.innerHTML),
    punctuationCount,
    whitespaceCount,
    count: punctuationCount + whitespaceCount,
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/"/g, '&quot;')
}

function renderBoldFirstSentence(text: string): string {
  const idx = text.indexOf('。')
  if (idx === -1 || idx === text.length - 1) {
    return `<strong>${escapeHtml(text)}</strong>`
  }

  const firstSentence = text.slice(0, idx + 1)
  const rest = text.slice(idx + 1)
  return `<strong>${escapeHtml(firstSentence)}</strong>${escapeHtml(rest)}`
}

function paragraphHtml(node: DocumentNode, className: string, boldFirstSentence = false): string {
  const alignmentStyle = node.alignment ? ` style="text-align:${escapeAttribute(node.alignment)}"` : ''
  const noIndentAttr = node.noIndent ? ' data-no-indent="true"' : ''
  if (node.runs && node.runs.length > 0) {
    const runHtml = node.runs.map((run) => {
      const styles: string[] = []
      if (run.fontFamily) styles.push(`font-family:${run.fontFamily}`)
      if (run.fontSize) styles.push(`font-size:${run.fontSize}pt`)
      if (run.bold) styles.push('font-weight:bold')
      if (run.italic) styles.push('font-style:italic')
      if (run.underline) styles.push('text-decoration:underline')
      return `<span${styles.length > 0 ? ` style="${escapeAttribute(styles.join(';'))}"` : ''}>${escapeHtml(run.text)}</span>`
    }).join('')
    return `<p class="${className}"${alignmentStyle}${noIndentAttr}>${runHtml || '<br>'}</p>`
  }

  const content = node.content
    ? (boldFirstSentence ? renderBoldFirstSentence(node.content) : escapeHtml(node.content))
    : '<br>'
  return `<p class="${className}"${alignmentStyle}${noIndentAttr}>${content}</p>`
}

function attachmentHtml(node: AttachmentNode): string {
  if (!node.isMultiple) {
    return `<p class="a4-attachment a4-attachment--single">附件：${escapeHtml(node.items[0]?.name ?? '')}</p>`
  }

  const [first, ...rest] = node.items
  return [
    `<p class="a4-attachment a4-attachment--multi-first">附件：${first.index}.${escapeHtml(first.name)}</p>`,
    ...rest.map((item) => `<p class="a4-attachment-item a4-attachment-item--multi">${item.index}.${escapeHtml(item.name)}</p>`),
  ].join('')
}

const TITLE_DATE_RE = /^[（(]?\d{4}年\d{1,2}月\d{1,2}日[）)]?$/
const TITLE_NAME_RE = /^[\u4e00-\u9fff]{2,4}$/

function isTitleDateNode(ast: GongwenAST, index: number): boolean {
  if (!ast.title) return false
  if (index === 0 && TITLE_DATE_RE.test(ast.body[index].content.trim())) return true
  return index === 1 && TITLE_NAME_RE.test(ast.body[0]?.content.trim() ?? '') && TITLE_DATE_RE.test(ast.body[1]?.content.trim() ?? '')
}

function isTitleNameNode(ast: GongwenAST, index: number): boolean {
  if (!ast.title || index !== 0) return false
  return TITLE_NAME_RE.test(ast.body[0]?.content.trim() ?? '') && TITLE_DATE_RE.test(ast.body[1]?.content.trim() ?? '')
}

function findFirstBodyParagraphIndex(ast: GongwenAST): number {
  return ast.body.findIndex((node, index) => (
    node.type === NodeType.PARAGRAPH &&
    !isTitleNameNode(ast, index) &&
    !isTitleDateNode(ast, index)
  ))
}

export function astToStyledHtml(ast: GongwenAST, config: DocumentConfig): string {
  const html: string[] = []
  const firstBodyParagraphIndex = findFirstBodyParagraphIndex(ast)

  if (ast.title) {
    html.push(paragraphHtml(ast.title, 'a4-title'))
  }

  ast.body.forEach((node, index) => {
    if (node.type === NodeType.ATTACHMENT) {
      html.push(attachmentHtml(node as AttachmentNode))
      return
    }

    if (isTitleNameNode(ast, index)) {
      html.push(paragraphHtml(node, 'a4-title-secondary'))
      return
    }

    if (isTitleDateNode(ast, index)) {
      html.push(paragraphHtml(node, 'a4-title-date'))
      return
    }

    const className = {
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
    }[node.type]

    const shouldNoIndent = node.noIndent || (
      config.specialOptions.firstParagraphNoIndent &&
      node.type === NodeType.PARAGRAPH &&
      index === firstBodyParagraphIndex
    )
    const shouldBoldFirstSentence = (
      config.specialOptions.boldFirstSentence &&
      node.type === NodeType.PARAGRAPH
    )
    html.push(paragraphHtml({ ...node, noIndent: shouldNoIndent }, className, shouldBoldFirstSentence))
  })

  return html.join('') || '<p><br></p>'
}
