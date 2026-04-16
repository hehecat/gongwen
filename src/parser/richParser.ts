import type { GongwenAST, ParagraphAlignment, RichTextRun } from '../types/ast'
import { parseParsedLines } from './parser'

interface ParsedRichLine {
  text: string
  lineNumber: number
  runs: RichTextRun[]
  alignment?: ParagraphAlignment
  noIndent?: boolean
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'])

function mergeAdjacentRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = []

  for (const run of runs) {
    if (!run.text) continue
    const previous = merged[merged.length - 1]
    if (
      previous &&
      previous.bold === run.bold &&
      previous.italic === run.italic &&
      previous.underline === run.underline &&
      previous.fontFamily === run.fontFamily &&
      previous.fontSize === run.fontSize
    ) {
      previous.text += run.text
    } else {
      merged.push({ ...run })
    }
  }

  return merged
}

function parseFontSize(raw: string): number | undefined {
  const matched = raw.match(/(\d+(?:\.\d+)?)px/)
  if (matched) return Math.round(Number(matched[1]) * 72 / 96)
  const ptMatched = raw.match(/(\d+(?:\.\d+)?)pt/)
  if (ptMatched) return Number(ptMatched[1])
  return undefined
}

function parseTextAlign(raw: string | null): ParagraphAlignment | undefined {
  if (!raw) return undefined
  switch (raw) {
    case 'left':
    case 'center':
    case 'right':
    case 'justify':
      return raw
    default:
      return undefined
  }
}

function extractRuns(node: Node, inherited: Omit<RichTextRun, 'text'> = {}): RichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ text: node.textContent?.replace(/\u00a0/g, ' ') ?? '', ...inherited }]
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return []

  const element = node as HTMLElement
  const nextStyle: Omit<RichTextRun, 'text'> = { ...inherited }
  const tagName = element.tagName

  if (tagName === 'B' || tagName === 'STRONG') nextStyle.bold = true
  if (tagName === 'I' || tagName === 'EM') nextStyle.italic = true
  if (tagName === 'U') nextStyle.underline = true

  const inlineStyle = element.style
  if (inlineStyle.fontWeight && Number(inlineStyle.fontWeight) >= 600) nextStyle.bold = true
  if (inlineStyle.fontWeight === 'bold') nextStyle.bold = true
  if (inlineStyle.fontStyle === 'italic') nextStyle.italic = true
  if (inlineStyle.textDecoration.includes('underline')) nextStyle.underline = true
  if (inlineStyle.fontFamily) nextStyle.fontFamily = inlineStyle.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  if (inlineStyle.fontSize) nextStyle.fontSize = parseFontSize(inlineStyle.fontSize)

  if (tagName === 'FONT') {
    const face = element.getAttribute('face')
    if (face) nextStyle.fontFamily = face
  }

  if (tagName === 'BR') return [{ text: '', ...nextStyle }]

  return mergeAdjacentRuns(
    Array.from(element.childNodes).flatMap((child) => extractRuns(child, nextStyle)),
  )
}

function extractBlocks(root: HTMLElement): ParsedRichLine[] {
  const blocks: ParsedRichLine[] = []
  let lineNumber = 1

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as Element).tagName)) {
      const element = child as HTMLElement
      const runs = mergeAdjacentRuns(extractRuns(element))
      blocks.push({
        text: runs.map((run) => run.text).join(''),
        lineNumber,
        runs,
        alignment: parseTextAlign(element.style.textAlign || element.getAttribute('align')),
        noIndent: element.dataset.noIndent === 'true',
      })
      lineNumber++
      continue
    }

    if (child.nodeType === Node.TEXT_NODE) {
      blocks.push({
        text: child.textContent?.replace(/\u00a0/g, ' ') ?? '',
        lineNumber,
        runs: [{ text: child.textContent?.replace(/\u00a0/g, ' ') ?? '' }],
      })
      lineNumber++
    }
  }

  return blocks
}

export function parseRichGongwen(html: string): GongwenAST {
  if (typeof DOMParser === 'undefined') {
    return parseParsedLines(
      html.split('\n').map((line, index) => ({
        text: line,
        lineNumber: index + 1,
        runs: [{ text: line }],
      })),
    )
  }

  const doc = new DOMParser().parseFromString(`<div data-editor-root="true">${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return { title: null, body: [] }
  return parseParsedLines(extractBlocks(root))
}
