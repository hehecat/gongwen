import { Document, Paragraph, TextRun, Footer, PageNumber, AlignmentType } from 'docx'
import type { IRunOptions } from 'docx'
import type { GongwenAST, DocumentNode } from '../types/ast'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { cmToTwip } from '../types/documentConfig'
import { getParagraphStyle, getRunStyle } from './styleFactory'

// ---- 页码样式 ----

/** 构建页码段落 (— X — 格式) */
function pageNumberParagraph(
  alignment: typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT,
  pageNumFont: Record<string, string>,
  pageNumSize: number,
): Paragraph {
  return new Paragraph({
    alignment,
    children: [
      new TextRun({ font: pageNumFont, size: pageNumSize, children: ['— '] }),
      new TextRun({ font: pageNumFont, size: pageNumSize, children: [PageNumber.CURRENT] }),
      new TextRun({ font: pageNumFont, size: pageNumSize, children: [' —'] }),
    ],
  })
}

/**
 * 拆分标题首句：首句（到第一个"。"）用标题字体，其余用仿宋正文字体
 * 适用于一级标题(黑体+仿宋)和二级标题(楷体+仿宋)
 */
function splitHeadingSentence(content: string, headingStyle: Partial<IRunOptions>, config: DocumentConfig): TextRun[] {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return [new TextRun({ ...headingStyle, text: content })]
  }

  const headingText = content.slice(0, idx + 1)
  const bodyText = content.slice(idx + 1)
  const bodyStyle = getRunStyle(NodeType.PARAGRAPH, config)

  return [
    new TextRun({ ...headingStyle, text: headingText }),
    new TextRun({ ...bodyStyle, text: bodyText }),
  ]
}

/**
 * 拆分正文首句加粗：首句（到第一个"。"）加粗
 */
function splitBoldFirstSentence(content: string, runStyle: Partial<IRunOptions>): TextRun[] {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return [new TextRun({ ...runStyle, text: content, bold: true })]
  }

  const firstSentence = content.slice(0, idx + 1)
  const rest = content.slice(idx + 1)

  return [
    new TextRun({ ...runStyle, text: firstSentence, bold: true }),
    new TextRun({ ...runStyle, text: rest }),
  ]
}

/** 将单个 AST 节点转换为 docx Paragraph */
function nodeToParagraph(node: DocumentNode, config: DocumentConfig): Paragraph {
  const paragraphStyle = getParagraphStyle(node.type, config)
  const runStyle = getRunStyle(node.type, config)

  if (node.type === NodeType.HEADING_1 || node.type === NodeType.HEADING_2) {
    return new Paragraph({
      ...paragraphStyle,
      children: splitHeadingSentence(node.content, runStyle, config),
    })
  }

  // 正文首句加粗
  if (node.type === NodeType.PARAGRAPH && config.specialOptions.boldFirstSentence) {
    return new Paragraph({
      ...paragraphStyle,
      children: splitBoldFirstSentence(node.content, runStyle),
    })
  }

  return new Paragraph({
    ...paragraphStyle,
    children: [
      new TextRun({
        ...runStyle,
        text: node.content,
      }),
    ],
  })
}

/** 将完整 GongwenAST 转换为 docx Document */
export function buildDocument(ast: GongwenAST, config: DocumentConfig): Document {
  const children: Paragraph[] = []

  if (ast.title) {
    children.push(nodeToParagraph(ast.title, config))
  }

  for (const node of ast.body) {
    children.push(nodeToParagraph(node, config))
  }

  // 页码字体
  const pageNumFont = {
    ascii: 'Times New Roman',
    eastAsia: config.specialOptions.pageNumberFont,
    hAnsi: 'Times New Roman',
    cs: 'Times New Roman',
  }
  // 4号 = 14pt = 28 half-point
  const pageNumSize = 28

  // 页脚配置（条件渲染）
  const footers = config.specialOptions.showPageNumber
    ? {
        default: new Footer({
          children: [pageNumberParagraph(AlignmentType.RIGHT, pageNumFont, pageNumSize)],
        }),
        even: new Footer({
          children: [pageNumberParagraph(AlignmentType.LEFT, pageNumFont, pageNumSize)],
        }),
      }
    : undefined

  return new Document({
    // 启用奇偶页不同页脚（单页码居右，双页码居左）
    evenAndOddHeaderAndFooters: config.specialOptions.showPageNumber,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4: 210mm
              height: 16838, // A4: 297mm
            },
            margin: {
              top: cmToTwip(config.margins.top),
              bottom: cmToTwip(config.margins.bottom),
              left: cmToTwip(config.margins.left),
              right: cmToTwip(config.margins.right),
            },
          },
        },
        footers,
        children,
      },
    ],
  })
}
