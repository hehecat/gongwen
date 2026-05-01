import {
  Document, Paragraph, TextRun, Footer, PageNumber,
  AlignmentType, BorderStyle, HeadingLevel, LineRuleType,
  Table, TableRow, TableCell, WidthType,
  TableAnchorType, RelativeHorizontalPosition, RelativeVerticalPosition, OverlapType,
} from 'docx'
import type { IRunOptions, IBorderOptions, IParagraphOptions } from 'docx'
import type { GongwenAST, DocumentNode, AttachmentNode } from '../types/ast'
import { NodeType } from '../types/ast'
import type { DocumentConfig, PageNumberStyle } from '../types/documentConfig'
import { cmToTwip, ptToTwip } from '../types/documentConfig'
import {
  getParagraphStyle,
  getRunStyle,
  getAttachmentParagraphStyle,
  getAttachmentRunStyle,
  getTitleDateRunStyle,
  getTitleNameRunStyle,
  isTitleDateLine,
  isTitleNameLine,
  buildRunStyleOverride,
  hasRichStyleOverrides,
} from './styleFactory'

type StaticParagraphType =
  | NodeType.DOCUMENT_TITLE
  | NodeType.HEADING_1
  | NodeType.HEADING_2
  | NodeType.HEADING_3
  | NodeType.HEADING_4
  | NodeType.ADDRESSEE
  | NodeType.PARAGRAPH
  | NodeType.DATE

interface BuildStyleCache {
  attachmentRunStyle: Partial<IRunOptions>
  bodyRunStyle: Partial<IRunOptions>
  runStyles: Record<NodeType, Partial<IRunOptions>>
  paragraphStyles: Record<StaticParagraphType, Partial<IParagraphOptions>>
  attachmentParagraphStyles: {
    single: Partial<IParagraphOptions>
    singleNoSpacingBefore: Partial<IParagraphOptions>
    multiFirst: Partial<IParagraphOptions>
    multiFirstNoSpacingBefore: Partial<IParagraphOptions>
    multiRest: Partial<IParagraphOptions>
  }
  useCharacterIndent: Set<NodeType>
}

function createBuildStyleCache(config: DocumentConfig): BuildStyleCache {
  const paragraphNodeTypes: StaticParagraphType[] = [
    NodeType.DOCUMENT_TITLE,
    NodeType.HEADING_1,
    NodeType.HEADING_2,
    NodeType.HEADING_3,
    NodeType.HEADING_4,
    NodeType.ADDRESSEE,
    NodeType.PARAGRAPH,
    NodeType.DATE,
  ]

  const runNodeTypes: NodeType[] = [
    NodeType.DOCUMENT_TITLE,
    NodeType.HEADING_1,
    NodeType.HEADING_2,
    NodeType.HEADING_3,
    NodeType.HEADING_4,
    NodeType.ADDRESSEE,
    NodeType.PARAGRAPH,
    NodeType.SIGNATURE,
    NodeType.DATE,
  ]

  return {
    attachmentRunStyle: getAttachmentRunStyle(config),
    bodyRunStyle: getRunStyle(NodeType.PARAGRAPH, config),
    runStyles: Object.fromEntries(
      runNodeTypes.map((type) => [type, getRunStyle(type, config)]),
    ) as Record<NodeType, Partial<IRunOptions>>,
    paragraphStyles: Object.fromEntries(
      paragraphNodeTypes.map((type) => [type, getParagraphStyle(type, config)]),
    ) as Record<StaticParagraphType, Partial<IParagraphOptions>>,
    attachmentParagraphStyles: {
      single: getAttachmentParagraphStyle(false, false, config, false),
      singleNoSpacingBefore: getAttachmentParagraphStyle(false, false, config, true),
      multiFirst: getAttachmentParagraphStyle(true, true, config, false),
      multiFirstNoSpacingBefore: getAttachmentParagraphStyle(true, true, config, true),
      multiRest: getAttachmentParagraphStyle(true, false, config, false),
    },
    useCharacterIndent: new Set([
      NodeType.HEADING_1,
      NodeType.HEADING_2,
      NodeType.HEADING_3,
      NodeType.HEADING_4,
      NodeType.PARAGRAPH,
    ]),
  }
}

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

function getHeaderOrgFontSize(text: string, config: DocumentConfig): number {
  const length = Array.from(text.trim()).length
  if (length <= 0) return 30
  const availablePoints = (11906 - cmToTwip(config.margins.left) - cmToTwip(config.margins.right)) / 20
  return Math.max(18, Math.min(30, Math.floor(availablePoints / length)))
}

/** 构建页码段落 */
function pageNumberParagraph(
  alignment: typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT | typeof AlignmentType.CENTER,
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

function ensureChinesePeriod(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`
}

/**
 * 拆分标题首句：首句（到第一个"。"）用标题字体/样式，其余用仿宋正文样式
 * 适用于一至四级标题（黑体/楷体/仿宋加粗 + 仿宋正文）
 */
function splitHeadingSentence(
  content: string,
  headingStyle: Partial<IRunOptions>,
  bodyStyle: Partial<IRunOptions>,
): TextRun[] {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return [new TextRun({ ...headingStyle, text: content })]
  }

  const headingText = content.slice(0, idx + 1)
  const bodyText = content.slice(idx + 1)

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
function attachmentToParagraphs(
  node: AttachmentNode,
  cache: BuildStyleCache,
  omitSpacingBefore = false
): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const runStyle = cache.attachmentRunStyle

  if (!node.isMultiple) {
    // 单附件模式
    const paragraphStyle = omitSpacingBefore
      ? cache.attachmentParagraphStyles.singleNoSpacingBefore
      : cache.attachmentParagraphStyles.single
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
      const paragraphStyle = isFirst
        ? (omitSpacingBefore
          ? cache.attachmentParagraphStyles.multiFirstNoSpacingBefore
          : cache.attachmentParagraphStyles.multiFirst)
        : cache.attachmentParagraphStyles.multiRest

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

function getWordHeadingOptions(nodeType: NodeType): Pick<IParagraphOptions, 'heading' | 'outlineLevel'> | undefined {
  switch (nodeType) {
    case NodeType.HEADING_1:
      return { heading: HeadingLevel.HEADING_1, outlineLevel: 0 }
    case NodeType.HEADING_2:
      return { heading: HeadingLevel.HEADING_2, outlineLevel: 1 }
    case NodeType.HEADING_3:
      return { heading: HeadingLevel.HEADING_3, outlineLevel: 2 }
    case NodeType.HEADING_4:
      return { heading: HeadingLevel.HEADING_4, outlineLevel: 3 }
    default:
      return undefined
  }
}

export function getWordHeadingMeta(nodeType: NodeType): Pick<IParagraphOptions, 'heading' | 'outlineLevel'> | undefined {
  return getWordHeadingOptions(nodeType)
}

/** 将单个 AST 节点转换为 docx Paragraph */
function nodeToParagraph(
  node: DocumentNode,
  config: DocumentConfig,
  cache: BuildStyleCache,
  spacingBefore = 0,
  signatureContent?: string,
  dateContent?: string,
  isTitleDate = false,
  isTitleName = false,
  noIndent = false,
): Paragraph {
  let paragraphStyle = getParagraphStyle(
    node.type,
    config,
    signatureContent,
    dateContent,
    isTitleDate,
    isTitleName,
    node.alignment,
    noIndent || node.noIndent === true,
  )
  const runStyle = isTitleDate
    ? getTitleDateRunStyle(config)
    : isTitleName
      ? getTitleNameRunStyle(config)
      : getRunStyle(node.type, config)

  // 外部传入的额外 spacing.before（如版头后标题空二行）
  if (spacingBefore > 0) {
    paragraphStyle = {
      ...paragraphStyle,
      spacing: { ...paragraphStyle.spacing, before: spacingBefore },
    }
  }

  if (hasRichStyleOverrides(node.runs)) {
    return new Paragraph({
      ...paragraphStyle,
      children: (node.runs ?? []).map((run) => new TextRun(buildRunStyleOverride(runStyle, run))),
    })
  }

  // 一至四级标题：首句用标题样式，句号后切换为正文样式
  if (
    node.type === NodeType.HEADING_1 ||
    node.type === NodeType.HEADING_2 ||
    node.type === NodeType.HEADING_3 ||
    node.type === NodeType.HEADING_4
  ) {
    return createParagraph(splitHeadingSentence(node.content, runStyle, cache.bodyRunStyle))
  }

  // 正文首句加粗（忽略标题下姓名和日期）
  if (node.type === NodeType.PARAGRAPH && config.specialOptions.boldFirstSentence && !isTitleName && !isTitleDate) {
    return new Paragraph({
      ...paragraphStyle,
      children: splitBoldFirstSentence(node.content, runStyle),
    })
  }

  return createParagraph([
    new TextRun({
      ...runStyle,
      text: node.content,
    }),
  ])
}

/** 将完整 GongwenAST 转换为 docx Document */
export function buildDocument(ast: GongwenAST, config: DocumentConfig): Document {
  const children: (Paragraph | Table)[] = []
  const isLeadingNameDate = Boolean(
    ast.title &&
    ast.body.length >= 2 &&
    isTitleNameLine(ast.body[0].content) &&
    isTitleDateLine(ast.body[1].content),
  )
  const firstBodyParagraphIndex = ast.body.findIndex((node, index) => (
    node.type === NodeType.PARAGRAPH &&
    !(isLeadingNameDate && index === 0) &&
    !(isLeadingNameDate && index === 1) &&
    !(index === 0 && isTitleDateLine(node.content))
  ))

  // ---- 版头段落 ----
  if (config.header.enabled && config.header.orgName) {
    const headerFont = {
      ascii: 'Times New Roman',
      eastAsia: config.body.fontFamily,
      hAnsi: 'Times New Roman',
      cs: 'Times New Roman',
    }
    const headerFontSize = config.body.fontSize * 2
    const headerOrgFontSize = getHeaderOrgFontSize(config.header.orgName, config)
    // "空一字"缩进量 = 1 个字号宽度（使用数字 twips，在表格单元格内最可靠）
    const oneCharIndent = ptToTwip(config.body.fontSize)

    // 1. 发文机关标志：使用分散对齐确保在版心内铺满整行
    children.push(new Paragraph({
      alignment: AlignmentType.DISTRIBUTE,
      children: [new TextRun({
        text: config.header.orgName,
        font: { ascii: 'Times New Roman', eastAsia: '方正小标宋_GBK', hAnsi: 'Times New Roman', cs: 'Times New Roman' },
        size: headerOrgFontSize * 2,
        color: 'E00000',
      })],
    }))

    // 发文机关标志下空二行（三号字行高，确保行距精确）
    const bodyLineSpacing = ptToTwip(config.body.lineSpacing)
    const headerGapLines = config.header.mode === 'formal' ? 2 : 0
    for (let i = 0; i < headerGapLines; i++) {
      children.push(new Paragraph({
        spacing: { line: bodyLineSpacing, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        children: [new TextRun({ font: headerFont, size: headerFontSize, text: '' })],
      }))
    }

    // 2. 发文字号 / 签发人（正式文）
    if (config.header.mode === 'formal' && config.header.signer) {
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
    } else if (config.header.mode === 'formal' && config.header.docNumber) {
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
      spacing: { before: 0, after: 0, line: ptToTwip(1), lineRule: LineRuleType.EXACT },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 18, // 略加粗，导出效果更接近预览
          color: 'E00000',
          space: 1,
        },
      },
      children: [],
    }))
  }

  // 版头启用时，标题需通过 spacing.before 空二行（56pt = 1120 twips）
  const titleSpacingBefore = (config.header.enabled && config.header.orgName)
    ? ptToTwip(config.body.lineSpacing * (config.header.mode === 'formal' ? 2 : 1))
    : 0

  if (ast.title) {
    children.push(nodeToParagraph(ast.title, config, cache, titleSpacingBefore))
  }

  for (let i = 0; i < ast.body.length; i++) {
    const node = ast.body[i]
    const isTitleName = isLeadingNameDate && i === 0
    const isTitleDate = (i === 0 && ast.title !== null && isTitleDateLine(node.content)) || (isLeadingNameDate && i === 1)
    const shouldNoIndent = config.specialOptions.firstParagraphNoIndent && i === firstBodyParagraphIndex
    
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
      const attachmentParagraphs = attachmentToParagraphs(
        node as AttachmentNode,
        cache,
        isFirstBodyNode,
      )
      children.push(...attachmentParagraphs)
      continue
    }
    
    // 对于 SIGNATURE 节点，查找下一个节点是否为 DATE
    if (node.type === NodeType.SIGNATURE && i + 1 < ast.body.length && ast.body[i + 1].type === NodeType.DATE) {
      children.push(nodeToParagraph(node, config, cache, 0, node.content, ast.body[i + 1].content))
    } else {
      children.push(nodeToParagraph(node, config, 0, undefined, undefined, isTitleDate, isTitleName, shouldNoIndent))
    }
  }

  // ---- 版记浮动表格（锚定页面底部版心下边缘） ----
  // 使用 Table Float 将版记吸附到最后一页底部，
  // 无需计算空行填充，Word 引擎自动处理文本避让。
  if (config.footerNote.enabled) {
    const bodyFont = {
      ascii: 'Times New Roman',
      eastAsia: config.body.fontFamily,
      hAnsi: config.body.fontFamily,
      cs: 'Times New Roman',
    }
    const footerNoteSize = 28 // 四号 14pt = 28 half-point
    // 使用 twips 数值（表格内段落缩进更可靠）
    const fnOneCharIndent = ptToTwip(config.body.fontSize)

    // 粗线（首条、末条分隔线）
    const thickBorder: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 8, // 约 0.35mm
      color: '000000',
    }
    // 细线（抄送与印发之间的分隔线）
    const thinBorder: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 6, // 约 0.25mm
      color: '000000',
    }

    const hasCc = !!config.footerNote.cc
    const hasPrint = !!(config.footerNote.printer || config.footerNote.printDate)
    const footerRows: TableRow[] = []

    if (hasCc) {
      footerRows.push(new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              indent: {
                left: fnOneCharIndent * 4,
                hanging: fnOneCharIndent * 3,
                right: fnOneCharIndent,
              },
              spacing: { before: 0, after: 0 },
              children: [new TextRun({
                text: `抄送：${ensureChinesePeriod(config.footerNote.cc)}`,
                font: bodyFont,
                size: footerNoteSize,
              })],
            })],
          }),
        ],
      }))
    }

    if (hasPrint) {
      const printerText = config.footerNote.printer || ''
      const dateText = config.footerNote.printDate
        ? `${config.footerNote.printDate}印发`
        : ''

      footerRows.push(new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              indent: { left: fnOneCharIndent },
              spacing: { before: 0, after: 0 },
              children: printerText
                ? [new TextRun({ text: printerText, font: bodyFont, size: footerNoteSize })]
                : [],
            })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              indent: { right: fnOneCharIndent },
              spacing: { before: 0, after: 0 },
              children: dateText
                ? [new TextRun({ text: dateText, font: bodyFont, size: footerNoteSize })]
                : [],
            })],
          }),
        ],
      }))
    }

    if (footerRows.length === 0) {
      footerRows.push(new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
          }),
        ],
      }))
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [5000, 5000],
      borders: {
        top: thickBorder,
        bottom: thickBorder,
        left: NO_BORDER,
        right: NO_BORDER,
        insideHorizontal: hasCc && hasPrint ? thinBorder : NO_BORDER,
        insideVertical: NO_BORDER,
      },
      float: {
        horizontalAnchor: TableAnchorType.MARGIN,
        verticalAnchor: TableAnchorType.MARGIN,
        relativeHorizontalPosition: RelativeHorizontalPosition.LEFT,
        relativeVerticalPosition: RelativeVerticalPosition.BOTTOM,
        overlap: OverlapType.NEVER,
      },
      rows: footerRows,
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
  const pageNumberOptions = getPageNumberParagraphOptions(config.specialOptions.pageNumberStyle, pageNumIndent)

  // 页脚配置：支持居中或双面打印奇右偶左
  let footers: { default: Footer; even?: Footer } | undefined
  if (config.specialOptions.showPageNumber) {
    footers = config.specialOptions.pageNumberLayout === 'center'
      ? {
          default: new Footer({
            children: [pageNumberParagraph(AlignmentType.CENTER, {}, pageNumFont, pageNumSize)],
          }),
        }
      : {
          default: new Footer({
            children: [pageNumberParagraph(AlignmentType.RIGHT, { right: pageNumIndent }, pageNumFont, pageNumSize)],
          }),
          even: new Footer({
            children: [pageNumberParagraph(AlignmentType.LEFT, { left: pageNumIndent }, pageNumFont, pageNumSize)],
          }),
        }
  }

  return new Document({
    // 双面打印布局才启用奇偶页不同页脚
    evenAndOddHeaderAndFooters: config.specialOptions.showPageNumber && config.specialOptions.pageNumberLayout === 'mirrored',
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
