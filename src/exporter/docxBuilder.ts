import {
  Document, Paragraph, TextRun, Footer, PageNumber,
  AlignmentType, BorderStyle, LineRuleType,
  Table, TableRow, TableCell, WidthType,
  TableAnchorType, RelativeHorizontalPosition, RelativeVerticalPosition, OverlapType,
} from 'docx'
import type { IRunOptions, IBorderOptions } from 'docx'
import type { GongwenAST, DocumentNode, AttachmentNode, TableNode } from '../types/ast'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { cmToTwip, ptToTwip } from '../types/documentConfig'
import { getParagraphStyle, getRunStyle, getAttachmentParagraphStyle, getAttachmentRunStyle } from './styleFactory'

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

// ---- 页码样式 (GB/T 9704: 四号宋体, — X — 格式, 奇右偶左各空一字) ----

/** 页码一字线（Unicode EM DASH） */
const PAGE_NUM_DASH = '\u2014'

/** 页码距版心下边缘 7mm (GB/T 9704)，通过 spacing.before 定位 */
const PAGE_NUM_SPACING_BEFORE = cmToTwip(0.7) // 7mm = 0.7cm ≈ 397 twips

/** 构建页码段落 */
function pageNumberParagraph(
  alignment: typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT,
  indent: { left?: number; right?: number },
  pageNumFont: Record<string, string>,
  pageNumSize: number,
): Paragraph {
  return new Paragraph({
    alignment,
    indent,
    spacing: { before: PAGE_NUM_SPACING_BEFORE },
    children: [
      new TextRun({ font: pageNumFont, size: pageNumSize, children: [PAGE_NUM_DASH + ' '] }),
      new TextRun({ font: pageNumFont, size: pageNumSize, children: [PageNumber.CURRENT] }),
      new TextRun({ font: pageNumFont, size: pageNumSize, children: [' ' + PAGE_NUM_DASH] }),
    ],
  })
}

/**
 * 拆分标题首句：首句（到第一个"。"）用标题字体/样式，其余用仿宋正文样式
 * 适用于一至四级标题（黑体/楷体/仿宋加粗 + 仿宋正文）
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

/**
 * 将附件说明节点转换为 DOCX 段落
 *
 * 单附件模式：附件：xxx
 * 多附件模式：附件：1.xxx
 *                   2.xxx
 *                   3.xxx
 */
function attachmentToParagraphs(node: AttachmentNode, config: DocumentConfig): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const runStyle = getAttachmentRunStyle(config)

  if (!node.isMultiple) {
    // 单附件模式
    const paragraphStyle = getAttachmentParagraphStyle(false, false, config)
    paragraphs.push(
      new Paragraph({
        ...paragraphStyle,
        children: [
          new TextRun({ ...runStyle, text: '附件：' }),
          new TextRun({ ...runStyle, text: node.items[0].name }),
        ],
      })
    )
  } else {
    // 多附件模式
    node.items.forEach((item, index) => {
      const isFirst = index === 0
      const paragraphStyle = getAttachmentParagraphStyle(true, isFirst, config)

      if (isFirst) {
        // 第一个附件：附件：1.xxx
        paragraphs.push(
          new Paragraph({
            ...paragraphStyle,
            children: [
              new TextRun({ ...runStyle, text: '附件：' }),
              new TextRun({ ...runStyle, text: `${item.index}.${item.name}` }),
            ],
          })
        )
      } else {
        // 后续附件：2.xxx
        paragraphs.push(
          new Paragraph({
            ...paragraphStyle,
            children: [
              new TextRun({ ...runStyle, text: `${item.index}.${item.name}` }),
            ],
          })
        )
      }
    })
  }

  return paragraphs
}

// ---- 表格边框定义（公文标准黑色细线） ----

const TABLE_CELL_BORDER: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4, // 0.5pt
  color: '000000',
}

const TABLE_BORDERS = {
  top: TABLE_CELL_BORDER,
  bottom: TABLE_CELL_BORDER,
  left: TABLE_CELL_BORDER,
  right: TABLE_CELL_BORDER,
  insideHorizontal: TABLE_CELL_BORDER,
  insideVertical: TABLE_CELL_BORDER,
}

/**
 * 将表格节点转换为 docx Table
 * @param node 表格节点
 * @param config 文档配置
 * @returns docx Table 对象
 */
function tableNodeToDocxTable(node: TableNode, config: DocumentConfig): Table {
  // 使用表格配置项
  const tableFont = {
    ascii: 'Times New Roman',
    eastAsia: config.table.fontFamily,
    hAnsi: 'Times New Roman',
    cs: 'Times New Roman',
  }
  const tableFontSize = config.table.fontSize * 2
  const tableLineSpacing = ptToTwip(config.table.lineSpacing)

  // 构建表头行
  const headerRow = new TableRow({
    children: node.header.cells.map((cell) =>
      new TableCell({
        borders: TABLE_BORDERS,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: tableLineSpacing, lineRule: LineRuleType.EXACT },
            children: [
              new TextRun({
                text: cell.content,
                font: tableFont,
                size: tableFontSize,
                bold: config.table.boldHeader,
              }),
            ],
          }),
        ],
      })
    ),
  })

  // 构建数据行
  const dataRows = node.rows.map((row) =>
    new TableRow({
      children: row.cells.map((cell) =>
        new TableCell({
          borders: TABLE_BORDERS,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { line: tableLineSpacing, lineRule: LineRuleType.EXACT },
              children: [
                new TextRun({
                  text: cell.content,
                  font: tableFont,
                  size: tableFontSize,
                }),
              ],
            }),
          ],
        })
      ),
    })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [headerRow, ...dataRows],
  })
}

/** 将单个 AST 节点转换为 docx Paragraph */
function nodeToParagraph(
  node: DocumentNode,
  config: DocumentConfig,
  spacingBefore = 0,
  signatureContent?: string,
  dateContent?: string
): Paragraph {
  let paragraphStyle = getParagraphStyle(node.type, config, signatureContent, dateContent)
  const runStyle = getRunStyle(node.type, config)

  // 外部传入的额外 spacing.before（如版头后标题空二行）
  if (spacingBefore > 0) {
    paragraphStyle = {
      ...paragraphStyle,
      spacing: { ...paragraphStyle.spacing, before: spacingBefore },
    }
  }

  // 一至四级标题：首句用标题样式，句号后切换为正文样式
  if (
    node.type === NodeType.HEADING_1 ||
    node.type === NodeType.HEADING_2 ||
    node.type === NodeType.HEADING_3 ||
    node.type === NodeType.HEADING_4
  ) {
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

    // 发文机关标志下空二行（三号字行高，确保行距精确）
    const bodyLineSpacing = ptToTwip(config.body.lineSpacing)
    for (let i = 0; i < 2; i++) {
      children.push(new Paragraph({
        spacing: { line: bodyLineSpacing, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        children: [new TextRun({ font: headerFont, size: headerFontSize, text: '' })],
      }))
    }

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
  }

  // 版头启用时，标题需通过 spacing.before 空二行（56pt = 1120 twips）
  const titleSpacingBefore = (config.header.enabled && config.header.orgName)
    ? ptToTwip(config.body.lineSpacing * 2)
    : 0

  // 渲染多段标题
  if (ast.title.length > 0) {
    // 第一个标题段应用 spacingBefore（版头后的空行）
    children.push(nodeToParagraph(ast.title[0], config, titleSpacingBefore))
    // 后续标题段正常渲染
    for (let i = 1; i < ast.title.length; i++) {
      children.push(nodeToParagraph(ast.title[i], config))
    }
    // 标题后添加一个固定行距的空行
    const bodyLineSpacing = ptToTwip(config.body.lineSpacing)
    const bodyFont = {
      ascii: 'Times New Roman',
      eastAsia: config.body.fontFamily,
      hAnsi: config.body.fontFamily,
      cs: 'Times New Roman',
    }
    const bodyFontSize = config.body.fontSize * 2
    children.push(new Paragraph({
      spacing: { line: bodyLineSpacing, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
      children: [new TextRun({ font: bodyFont, size: bodyFontSize, text: '' })],
    }))
  }

  for (let i = 0; i < ast.body.length; i++) {
    const node = ast.body[i]
    
    // 发文机关署名前插入 2 个空行
    if (node.type === NodeType.SIGNATURE) {
      const bodyLineSpacing = ptToTwip(config.body.lineSpacing)
      const bodyFont = {
        ascii: 'Times New Roman',
        eastAsia: config.body.fontFamily,
        hAnsi: config.body.fontFamily,
        cs: 'Times New Roman',
      }
      const bodyFontSize = config.body.fontSize * 2
      
      for (let j = 0; j < 2; j++) {
        children.push(new Paragraph({
          spacing: { line: bodyLineSpacing, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
          children: [new TextRun({ font: bodyFont, size: bodyFontSize, text: '' })],
        }))
      }
    }
    
    // 附件说明特殊处理
    if (node.type === NodeType.ATTACHMENT) {
      const attachmentParagraphs = attachmentToParagraphs(node as AttachmentNode, config)
      children.push(...attachmentParagraphs)
      continue
    }
    
    // 表格特殊处理
    if (node.type === NodeType.TABLE) {
      children.push(tableNodeToDocxTable(node as TableNode, config))
      continue
    }
    
    // 对于 SIGNATURE 节点，查找下一个节点是否为 DATE
    if (node.type === NodeType.SIGNATURE && i + 1 < ast.body.length && ast.body[i + 1].type === NodeType.DATE) {
      children.push(nodeToParagraph(node, config, 0, node.content, ast.body[i + 1].content))
    } else {
      children.push(nodeToParagraph(node, config))
    }
  }

  // ---- 版记浮动表格（锚定页面底部版心下边缘） ----
  // 使用 Table Float 将版记吸附到最后一页底部，
  // 无需计算空行填充，Word 引擎自动处理文本避让。
  if (config.footerNote.enabled) {
    const bodyFont = {
      ascii: 'Times New Roman',
      eastAsia: config.body.fontFamily,
      hAnsi: 'Times New Roman',
      cs: 'Times New Roman',
    }
    const footerNoteSize = 28 // 四号 14pt = 28 half-point
    // 使用 twips 数值（表格内段落缩进更可靠）
    const fnOneCharIndent = ptToTwip(config.body.fontSize)

    // 粗线（首条、末条分隔线）
    const thickBorder: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 12, // 1.5pt
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

    // 版记内容：全部放入浮动表格的唯一单元格
    const footerNoteChildren: (Paragraph | Table)[] = []

    // 1. 首条粗线
    footerNoteChildren.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      border: { bottom: thickBorder },
      children: [],
    }))

    // 2. 抄送行（左右各空一字）
    if (hasCc) {
      footerNoteChildren.push(new Paragraph({
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
      footerNoteChildren.push(new Paragraph({
        spacing: { before: 0, after: 0 },
        border: { bottom: thinBorder },
        children: [],
      }))
    }

    // 4. 印发机关 + 印发日期（嵌套无边框表格：左空一字，右空一字）
    if (hasPrint) {
      const printerText = config.footerNote.printer || ''
      const dateText = config.footerNote.printDate
        ? `${config.footerNote.printDate}印发`
        : ''

      footerNoteChildren.push(new Table({
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
    footerNoteChildren.push(new Paragraph({
      spacing: { before: 0, after: 0 },
      border: { bottom: thickBorder },
      children: [],
    }))

    // 浮动表格包装器：无边框 1×1 表格，锚定在版心底部
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_NO_BORDERS,
      float: {
        horizontalAnchor: TableAnchorType.MARGIN,
        verticalAnchor: TableAnchorType.MARGIN,
        relativeHorizontalPosition: RelativeHorizontalPosition.LEFT,
        relativeVerticalPosition: RelativeVerticalPosition.BOTTOM,
        overlap: OverlapType.NEVER,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: TABLE_NO_BORDERS,
              margins: { top: 0, bottom: 0, left: 0, right: 0 },
              children: footerNoteChildren,
            }),
          ],
        }),
      ],
    }))
  }

  // 页码字体：四号宋体（中英文统一宋体，14pt = 28 half-point）
  const pageNumFont = {
    ascii: '宋体',
    eastAsia: '宋体',
    hAnsi: '宋体',
    cs: '宋体',
  }
  const pageNumSize = 28 // 四号 14pt
  // 奇偶页各空一字（四号字 14pt = 280 twips）
  const pageNumIndent = ptToTwip(14)

  // 页脚配置：单页码居右空一字，双页码居左空一字
  const footers = config.specialOptions.showPageNumber
    ? {
        default: new Footer({
          children: [pageNumberParagraph(AlignmentType.RIGHT, { right: pageNumIndent }, pageNumFont, pageNumSize)],
        }),
        even: new Footer({
          children: [pageNumberParagraph(AlignmentType.LEFT, { left: pageNumIndent }, pageNumFont, pageNumSize)],
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
