import {
  AlignmentType,
  Document,
  HeadingLevel,
  LineRuleType,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
} from 'docx'
import type { AttachmentNode, DocumentNode, GongwenAST } from '../types/ast'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { cmToTwip, ptToTwip } from '../types/documentConfig'
import { BLACK_COLOR_HEX } from '../layout/constants'
import {
  calculateCharWidthTwips,
  calculateSignatureLayout,
  resolveHeaderRenderPlan,
  splitFirstSentence,
  splitMinutesAttendance,
} from '../layout/typography'
import { buildDocumentStyles } from './styles'
import {
  createCharacterFirstLineIndent,
  getAttachmentParagraphStyle,
  getAttachmentRunStyle,
  getBodyFontConfig,
  getParagraphStyle,
  getRunStyle,
  makeFont,
} from './styleFactory'
import { buildHeaderElements, TABLE_NO_BORDERS } from './headerBuilder'
import { buildFooterNoteTable } from './footerNoteBuilder'
import { buildPageNumberFooters, getPageNumberParagraphOptions } from './pageNumberBuilder'

export { getPageNumberParagraphOptions }

type StaticParagraphType =
  | NodeType.DOCUMENT_TITLE
  | NodeType.HEADING_1
  | NodeType.HEADING_2
  | NodeType.HEADING_3
  | NodeType.HEADING_4
  | NodeType.ADDRESSEE
  | NodeType.PARAGRAPH
  | NodeType.DATE
  | NodeType.POSTSCRIPT
  | NodeType.MINUTES_ATTENDANCE
  | NodeType.ATTACHMENT_PAGE_HEADER

interface BuildStyleCache {
  attachmentRunStyle: Partial<IRunOptions>
  bodyRunStyle: Partial<IRunOptions>
  h1RunStyle: Partial<IRunOptions>
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
    NodeType.POSTSCRIPT,
    NodeType.MINUTES_ATTENDANCE,
    NodeType.ATTACHMENT_PAGE_HEADER,
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
    NodeType.POSTSCRIPT,
    NodeType.MINUTES_ATTENDANCE,
    NodeType.ATTACHMENT_PAGE_HEADER,
  ]

  return {
    attachmentRunStyle: getAttachmentRunStyle(config),
    bodyRunStyle: getRunStyle(NodeType.PARAGRAPH, config),
    h1RunStyle: getRunStyle(NodeType.HEADING_1, config),
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
      NodeType.POSTSCRIPT,
    ]),
  }
}

function splitHeadingSentence(
  content: string,
  headingStyle: Partial<IRunOptions>,
  bodyStyle: Partial<IRunOptions>,
): TextRun[] {
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return [new TextRun({ ...headingStyle, text: lead })]
  }
  return [
    new TextRun({ ...headingStyle, text: lead }),
    new TextRun({ ...bodyStyle, text: rest }),
  ]
}

function splitBoldFirstSentence(content: string, runStyle: Partial<IRunOptions>): TextRun[] {
  const { lead, rest } = splitFirstSentence(content)
  if (!rest) {
    return [new TextRun({ ...runStyle, text: lead, bold: true })]
  }
  return [
    new TextRun({ ...runStyle, text: lead, bold: true }),
    new TextRun({ ...runStyle, text: rest }),
  ]
}

function attachmentToParagraphs(
  node: AttachmentNode,
  cache: BuildStyleCache,
  omitSpacingBefore = false,
): Paragraph[] {
  const paragraphs: Paragraph[] = []
  const runStyle = cache.attachmentRunStyle

  if (!node.isMultiple) {
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
      }),
    )
  } else {
    node.items.forEach((item, index) => {
      const isFirst = index === 0
      const paragraphStyle = isFirst
        ? (omitSpacingBefore
            ? cache.attachmentParagraphStyles.multiFirstNoSpacingBefore
            : cache.attachmentParagraphStyles.multiFirst)
        : cache.attachmentParagraphStyles.multiRest

      if (isFirst) {
        paragraphs.push(
          new Paragraph({
            ...paragraphStyle,
            children: [
              new TextRun({ ...runStyle, text: '附件：' }),
              new TextRun({ ...runStyle, text: `${item.index}.${item.name}` }),
            ],
          }),
        )
      } else {
        paragraphs.push(
          new Paragraph({
            ...paragraphStyle,
            children: [
              new TextRun({ ...runStyle, text: `${item.index}.${item.name}` }),
            ],
          }),
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

function buildBlankParagraph(config: DocumentConfig): Paragraph {
  return new Paragraph({
    spacing: { line: ptToTwip(config.body.lineSpacing), lineRule: LineRuleType.EXACT, before: 0, after: 0 },
    children: [new TextRun({ font: getBodyFontConfig(config), size: config.body.fontSize * 2, text: '' })],
  })
}

function nodeToParagraph(
  node: DocumentNode,
  config: DocumentConfig,
  cache: BuildStyleCache,
  spacingBefore = 0,
  signatureContent?: string,
  dateContent?: string,
  isLastTitleLine = true,
): Paragraph {
  let paragraphStyle =
    node.type === NodeType.SIGNATURE || node.type === NodeType.DATE || node.type === NodeType.DOCUMENT_TITLE
      ? getParagraphStyle(node.type, config, signatureContent, dateContent, { isLastTitleLine })
      : cache.paragraphStyles[node.type as StaticParagraphType]
        ?? getParagraphStyle(node.type, config, signatureContent, dateContent)

  const runStyle = cache.runStyles[node.type] ?? getRunStyle(node.type, config)
  const useCharacterIndent = cache.useCharacterIndent.has(node.type)

  if (spacingBefore > 0) {
    paragraphStyle = {
      ...paragraphStyle,
      spacing: { ...paragraphStyle.spacing, before: spacingBefore },
    }
  }

  const baseParagraphStyle = useCharacterIndent
    ? { ...paragraphStyle, indent: undefined }
    : paragraphStyle
  const wordHeadingOptions = getWordHeadingOptions(node.type)

  function createParagraph(children: TextRun[]): Paragraph {
    const paragraph = new Paragraph({
      ...baseParagraphStyle,
      ...wordHeadingOptions,
      children,
    })

    if (useCharacterIndent) {
      (
        paragraph as unknown as {
          properties: {
            push: (item: ReturnType<typeof createCharacterFirstLineIndent>) => void
          }
        }
      ).properties.push(createCharacterFirstLineIndent(config))
    }

    return paragraph
  }

  if (
    node.type === NodeType.HEADING_1
    || node.type === NodeType.HEADING_2
    || node.type === NodeType.HEADING_3
    || node.type === NodeType.HEADING_4
  ) {
    return createParagraph(splitHeadingSentence(node.content, runStyle, cache.bodyRunStyle))
  }

  if (node.type === NodeType.MINUTES_ATTENDANCE) {
    const parsed = splitMinutesAttendance(node.content)
    if (parsed) {
      return createParagraph([
        new TextRun({ ...cache.h1RunStyle, size: config.body.fontSize * 2, text: parsed.label }),
        new TextRun({ ...cache.bodyRunStyle, text: parsed.names }),
      ])
    }
  }

  if (node.type === NodeType.PARAGRAPH && config.specialOptions.boldFirstSentence) {
    return createParagraph(splitBoldFirstSentence(node.content, runStyle))
  }

  return createParagraph([
    new TextRun({
      ...runStyle,
      text: node.content,
    }),
  ])
}

/**
 * §7.3.5.3 加盖签发人签名章行
 * 签名章右空四字，签发人职务左空二字于签名章、上下居中
 */
function buildSignerStampElements(config: DocumentConfig): (Paragraph | Table)[] {
  const title = config.specialOptions.signerTitle.trim()
  const name = config.specialOptions.signerStampName.trim()
  if (!title && !name) return []

  const bodyFont = getBodyFontConfig(config)
  const kaiFont = makeFont('楷体_GB2312', bodyFont.ascii ?? 'Times New Roman')
  const size = config.body.fontSize * 2
  const charWidth = calculateCharWidthTwips(config)

  return [
    buildBlankParagraph(config),
    buildBlankParagraph(config),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: TABLE_NO_BORDERS,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: TABLE_NO_BORDERS,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  indent: { right: 4 * charWidth },
                  spacing: { line: ptToTwip(config.body.lineSpacing), lineRule: LineRuleType.EXACT, before: 0, after: 0 },
                  children: [
                    ...(title
                      ? [new TextRun({ text: `${title}\u3000\u3000`, font: bodyFont, size, color: BLACK_COLOR_HEX })]
                      : []),
                    ...(name
                      ? [new TextRun({ text: name, font: kaiFont, size, color: BLACK_COLOR_HEX })]
                      : []),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    buildBlankParagraph(config),
  ]
}

/** 将完整 GongwenAST 转换为 docx Document */
export function buildDocument(ast: GongwenAST, config: DocumentConfig): Document {
  const children: (Paragraph | Table)[] = []
  const cache = createBuildStyleCache(config)

  // ---- 版头 ----
  const headerPlan = resolveHeaderRenderPlan(config.header)
  if (headerPlan.shouldRender) {
    children.push(...buildHeaderElements(config))
  }

  // 版头启用时，标题需空二行（标准/命令/信函/纪要统一在版头最末要素下空二行）
  const titleSpacingBefore = headerPlan.shouldRender
    ? ptToTwip(config.body.lineSpacing * 2)
    : 0

  if (ast.title) {
    const title = ast.title
    const lines = title.content.split('\n').filter((l) => l.length > 0)
    lines.forEach((line, idx) => {
      children.push(nodeToParagraph(
        { ...title, content: line },
        config,
        cache,
        idx === 0 ? titleSpacingBefore : 0,
        undefined,
        undefined,
        idx === lines.length - 1,
      ))
    })
  }

  let signerStampInserted = false
  const hasSignerStamp = Boolean(
    config.specialOptions.signerTitle.trim() || config.specialOptions.signerStampName.trim(),
  )

  for (let i = 0; i < ast.body.length; i++) {
    const node = ast.body[i]
    const isFirstBodyNode = i === 0

    // 找出与 SIGNATURE / DATE 配对的上下文内容
    const nextNode = i + 1 < ast.body.length ? ast.body[i + 1] : undefined
    const prevNode = i > 0 ? ast.body[i - 1] : undefined

    if (node.type === NodeType.SIGNATURE) {
      const sigLayout = calculateSignatureLayout(
        node.content,
        nextNode?.type === NodeType.DATE ? nextNode.content : null,
        config.specialOptions.hasStamp,
      )
      for (let j = 0; j < sigLayout.emptyLinesBefore; j++) {
        children.push(buildBlankParagraph(config))
      }
    } else if (node.type === NodeType.DATE && prevNode?.type !== NodeType.SIGNATURE) {
      if (hasSignerStamp && !signerStampInserted) {
        children.push(...buildSignerStampElements(config))
        signerStampInserted = true
      } else {
        const sigLayout = calculateSignatureLayout(
          null,
          node.content,
          config.specialOptions.hasStamp,
        )
        for (let j = 0; j < sigLayout.emptyLinesBefore; j++) {
          children.push(buildBlankParagraph(config))
        }
      }
    }

    if (node.type === NodeType.ATTACHMENT) {
      children.push(...attachmentToParagraphs(node as AttachmentNode, cache, isFirstBodyNode))
      continue
    }

    if (node.type === NodeType.SIGNATURE) {
      children.push(
        nodeToParagraph(
          node,
          config,
          cache,
          0,
          node.content,
          nextNode?.type === NodeType.DATE ? nextNode.content : undefined,
        ),
      )
      continue
    }

    if (node.type === NodeType.DATE) {
      children.push(
        nodeToParagraph(
          node,
          config,
          cache,
          0,
          prevNode?.type === NodeType.SIGNATURE ? prevNode.content : undefined,
          node.content,
        ),
      )
      continue
    }

    children.push(nodeToParagraph(node, config, cache))
  }

  // 若配置了签发人签名章但正文没有日期节点，也追加在文末
  if (hasSignerStamp && !signerStampInserted) {
    children.push(...buildSignerStampElements(config))
  }

  // ---- 版记浮动表格 ----
  const footerNoteTable = buildFooterNoteTable(config)
  if (footerNoteTable) {
    children.push(footerNoteTable)
  }

  // ---- 页脚与页码 ----
  const footerSpec = buildPageNumberFooters(config)

  return new Document({
    styles: buildDocumentStyles(config),
    evenAndOddHeaderAndFooters: footerSpec.evenAndOddHeaderAndFooters,
    sections: [
      {
        properties: {
          titlePage: footerSpec.titlePage,
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: {
              top: cmToTwip(config.margins.top),
              bottom: cmToTwip(config.margins.bottom),
              left: cmToTwip(config.margins.left),
              right: cmToTwip(config.margins.right),
            },
          },
        },
        footers: footerSpec.footers,
        children,
      },
    ],
  })
}
