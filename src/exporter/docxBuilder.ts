import {
  Document, Paragraph, TextRun, Footer, PageNumber,
  AlignmentType, BorderStyle, LineRuleType,
  Table, TableRow, TableCell, WidthType,
} from 'docx'
import type { IRunOptions, IBorderOptions } from 'docx'
import type { GongwenAST, DocumentNode } from '../types/ast'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { cmToTwip, ptToTwip } from '../types/documentConfig'
import { getParagraphStyle, getRunStyle } from './styleFactory'

// ---- 无边框定义（用于版头表格） ----

const NO_BORDER: IBorderOptions = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
}

const TABLE_NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

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
  const children: (Paragraph | Table)[] = []

  // ---- 版头段落 ----
  if (config.header.enabled && config.header.orgName) {
    const headerFont = {
      ascii: 'Times New Roman',
      eastAsia: config.body.fontFamily,
      hAnsi: 'Times New Roman',
      cs: 'Times New Roman',
    }
    const headerFontSize = config.body.fontSize * 2
    // "空一字"缩进量 = 1 个字号宽度（使用数字 twips，在表格单元格内最可靠）
    const oneCharIndent = ptToTwip(config.body.fontSize)

    // 1. 发文机关标志：红色居中大字
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: config.header.orgName,
        font: { ascii: 'Times New Roman', eastAsia: '方正小标宋_GBK', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
        size: 60, // 30pt
        color: 'E00000',
      })],
    }))

    // 2. 发文字号 / 签发人（位于红线之上）
    if (config.header.signer) {
      // 有签发人：无边框表格 — 字号居左空一字，签发人居右空一字
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                children: [new Paragraph({
                  alignment: AlignmentType.LEFT,
                  indent: { left: oneCharIndent },
                  children: [new TextRun({
                    text: config.header.docNumber,
                    font: headerFont,
                    size: headerFontSize,
                  })],
                })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  indent: { right: oneCharIndent },
                  children: [
                    // "签发人："三字用三号仿宋体
                    new TextRun({
                      text: '签发人：',
                      font: headerFont,
                      size: headerFontSize,
                    }),
                    // 签发人姓名用三号楷体
                    new TextRun({
                      text: config.header.signer,
                      font: { ...headerFont, eastAsia: '楷体_GB2312' },
                      size: headerFontSize,
                    }),
                  ],
                })],
              }),
            ],
          }),
        ],
      }))
    } else if (config.header.docNumber) {
      // 无签发人：发文字号居中
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: config.header.docNumber,
          font: headerFont,
          size: headerFontSize,
        })],
      }))
    }

    // 3. 红色分隔线：单条红线（发文字号之下）
    children.push(new Paragraph({
      spacing: { before: 80, after: 0 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 15, // ~1.9pt ≈ 标准红线粗细
          color: 'E00000',
          space: 1,
        },
      },
      children: [],
    }))

    // 4. 标题前空两行（插入两个正文行高的空段落）
    const bodyLineSpacing = ptToTwip(config.body.lineSpacing)
    for (let i = 0; i < 2; i++) {
      children.push(new Paragraph({
        spacing: { line: bodyLineSpacing, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        children: [],
      }))
    }
  }

  if (ast.title) {
    children.push(nodeToParagraph(ast.title, config))
  }

  for (const node of ast.body) {
    children.push(nodeToParagraph(node, config))
  }

  // ---- 版记段落 ----
  if (config.footerNote.enabled) {
    const bodyFont = {
      ascii: 'Times New Roman',
      eastAsia: config.body.fontFamily,
      hAnsi: 'Times New Roman',
      cs: 'Times New Roman',
    }
    const footerNoteSize = 28 // 四号 14pt = 28 half-point
    const fnOneCharIndent = `${config.body.fontSize}pt` as `${number}pt`

    // 粗线（首条、末条分隔线，推荐 0.35mm ≈ 1pt）
    const thickBorder: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 12, // 1.5pt — 保证在各 Word 渲染器中清晰可见
      color: '000000',
    }
    // 细线（抄送与印发之间的分隔线）
    const thinBorder: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 4, // 0.5pt
      color: '000000',
    }

    const hasCc = !!config.footerNote.cc
    const hasPrint = !!(config.footerNote.printer || config.footerNote.printDate)

    // 1. 首条粗线
    children.push(new Paragraph({
      spacing: { before: 200, after: 0 },
      border: { bottom: thickBorder },
      children: [],
    }))

    // 2. 抄送行（左右各空一字）
    if (hasCc) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        indent: { left: fnOneCharIndent, right: fnOneCharIndent },
        children: [new TextRun({
          text: `抄送：${config.footerNote.cc}`,
          font: bodyFont,
          size: footerNoteSize,
        })],
      }))
    }

    // 3. 中间细线（仅在抄送和印发行同时存在时出现）
    if (hasCc && hasPrint) {
      children.push(new Paragraph({
        spacing: { before: 0, after: 0 },
        border: { bottom: thinBorder },
        children: [],
      }))
    }

    // 4. 印发机关 + 印发日期（无边框表格：左空一字，右空一字）
    if (hasPrint) {
      const printerText = config.footerNote.printer || ''
      const dateText = config.footerNote.printDate
        ? `${config.footerNote.printDate}印发`
        : ''

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                children: [new Paragraph({
                  alignment: AlignmentType.LEFT,
                  indent: { left: fnOneCharIndent },
                  children: printerText
                    ? [new TextRun({ text: printerText, font: bodyFont, size: footerNoteSize })]
                    : [],
                })],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                children: [new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  indent: { right: fnOneCharIndent },
                  children: dateText
                    ? [new TextRun({ text: dateText, font: bodyFont, size: footerNoteSize })]
                    : [],
                })],
              }),
            ],
          }),
        ],
      }))
    }

    // 5. 末条粗线
    children.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      border: { bottom: thickBorder },
      children: [],
    }))
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
