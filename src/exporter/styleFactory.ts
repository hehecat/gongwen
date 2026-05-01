import {
  AlignmentType,
  BuilderElement,
  type IParagraphOptions,
  type IRunOptions,
  type IFontAttributesProperties,
  LineRuleType,
  UnderlineType,
} from 'docx'
import { NodeType, type ParagraphAlignment, type RichTextRun } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { ptToTwip, cmToTwip, CHARS_PER_LINE } from '../types/documentConfig'

const TITLE_DATE_RE = /^[（(]?\d{4}年\d{1,2}月\d{1,2}日[）)]?$/
const TITLE_NAME_RE = /^[\u4e00-\u9fff]{2,4}$/

/**
 * 构建 IFontAttributesProperties，支持中英文字体分离
 * 
 * 字体分配规则：
 * - ascii: 基本西文字符（英文字母、数字）
 * - eastAsia: 东亚文字（中文、日文、韩文）
 * - hAnsi: 高ANSI字符（包括省略号、破折号等中文标点）
 * 
 * 注意：省略号（U+2026）、破折号（U+2014）等字符被 Word 归类为 hAnsi，
 * 因此 hAnsi 需要使用中文字体以确保这些标点使用正确的中文字体。
 */
function font(eastAsia: string, ascii = 'Times New Roman'): IFontAttributesProperties {
  return { ascii, eastAsia, hAnsi: eastAsia, cs: ascii }
}

/**
 * 计算首行缩进值（twips）
 * 缩进 = 字符数 × (字号 + 字符间距)
 * 字符间距用于确保每行恰好28字，缩进也需要同步调整
 */
function calculateFirstLineIndent(config: DocumentConfig): number {
  return calculateCharWidth(config) * config.body.firstLineIndent
}

export function shouldUseCharacterFirstLineIndent(type: NodeType): boolean {
  return type === NodeType.HEADING_1
    || type === NodeType.HEADING_2
    || type === NodeType.HEADING_3
    || type === NodeType.HEADING_4
    || type === NodeType.PARAGRAPH
}

export function createCharacterFirstLineIndent(config: DocumentConfig): BuilderElement {
  return new BuilderElement({
    name: 'w:ind',
    attributes: {
      left: { key: 'w:left', value: 0 },
      // OOXML uses 1/100 character as the unit for firstLineChars.
      firstLineChars: { key: 'w:firstLineChars', value: config.body.firstLineIndent * 100 },
      firstLine: { key: 'w:firstLine', value: calculateFirstLineIndent(config) },
    },
  })
}

/**
 * 计算单个字符宽度（twips）
 * 字符宽度 = 字号 + 字符间距
 */
function calculateCharWidth(config: DocumentConfig): number {
  const availableTwips = 11906 - cmToTwip(config.margins.left) - cmToTwip(config.margins.right)
  const charGapCount = Math.max(1, CHARS_PER_LINE - 1)
  const charSpacingTwips = Math.floor(
    (availableTwips - config.body.fontSize * 20 * CHARS_PER_LINE) / charGapCount
  )
  return config.body.fontSize * 20 + charSpacingTwips
}

/**
 * 计算文本的实际宽度（twips）
 * - 中文字符（含年月日）：宽度 = 1 个汉字宽度
 * - 阿拉伯数字、英文字母：宽度约为汉字的 0.69 倍
 * - 其他 ASCII 字符：宽度约为汉字的 0.69 倍
 */
function calculateTextWidth(text: string, charWidthTwips: number): number {
  let width = 0
  for (const char of text) {
    // 判断是否为中文字符（含年月日等）
    // CJK 统一汉字范围：\u4e00-\u9fff
    // CJK 兼容汉字：\u3400-\u4dbf
    // 中文标点等也在 CJK 范围内
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
      width += charWidthTwips
    } else {
      // 阿拉伯数字、英文字母等 ASCII 字符，宽度约为汉字的 0.69 倍
      width += charWidthTwips * 0.69
    }
  }
  return width
}

/**
 * 计算发文机关署名的右缩进值
 * 公式：基础右空字数 + (成文日期宽度 - 署名宽度) / 2
 * - 有印章（hasStamp = true）：基础右空四字
 * - 无印章（hasStamp = false）：基础右空二字
 * 注意：居中偏移可能为负数（署名比日期长时），只需保证最终右缩进 >= 0
 */
function calculateSignatureIndent(
  signatureContent: string,
  dateContent: string,
  config: DocumentConfig
): number {
  const charWidthTwips = calculateCharWidth(config)
  const baseIndent = (config.specialOptions.hasStamp ? 4 : 2) * charWidthTwips
  const signatureWidth = calculateTextWidth(signatureContent, charWidthTwips)
  const dateWidth = calculateTextWidth(dateContent, charWidthTwips)
  const centerOffset = (dateWidth - signatureWidth) / 2
  return Math.max(0, baseIndent + centerOffset)
}

/** 节点类型 → 段落样式 */
export function getParagraphStyle(
  type: NodeType,
  config: DocumentConfig,
  signatureContent?: string,
  dateContent?: string,
  isTitleDate = false,
  isTitleName = false,
  manualAlignment?: ParagraphAlignment,
  noIndent = false,
): Partial<IParagraphOptions> {
  const lineSpacingValue = ptToTwip(config.body.lineSpacing)
  const firstLineIndentTwips = calculateFirstLineIndent(config)
  const charWidthTwips = calculateCharWidth(config)

  const BASE_SPACING = {
    line: lineSpacingValue,
    lineRule: LineRuleType.EXACT,
    before: 0,
    after: 0,
  } as const

  const BODY_INDENT = { firstLine: firstLineIndentTwips, left: 0 } as const

  let style: Partial<IParagraphOptions>

  switch (type) {
    case NodeType.DOCUMENT_TITLE:
      style = {
        alignment: AlignmentType.CENTER,
        spacing: {
          line: ptToTwip(config.title.lineSpacing),
          lineRule: LineRuleType.EXACT,
          before: 0,
          after: 0,
        },
      }
      break

    case NodeType.ADDRESSEE:
      style = {
        alignment: AlignmentType.JUSTIFIED,
        spacing: BASE_SPACING,
        indent: { left: 0 },
      }
      break

    case NodeType.ATTACHMENT:
      style = {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...BASE_SPACING, before: lineSpacingValue },
        indent: { left: 2 * charWidthTwips },
      }
      break

    case NodeType.SIGNATURE:
      if (!signatureContent || !dateContent) {
        style = {
          alignment: AlignmentType.RIGHT,
          spacing: BASE_SPACING,
          indent: { right: (config.specialOptions.hasStamp ? 4 : 2) * charWidthTwips },
        }
        break
      }
      style = {
        alignment: AlignmentType.RIGHT,
        spacing: BASE_SPACING,
        indent: { right: calculateSignatureIndent(signatureContent, dateContent, config) },
      }
      break

    case NodeType.DATE:
      if (isTitleDate) {
        style = {
          alignment: AlignmentType.CENTER,
          spacing: BASE_SPACING,
        }
        break
      }
      // GB/T 9704: 加盖印章右空四字，不加盖印章右空二字
      style = {
        alignment: AlignmentType.RIGHT,
        spacing: BASE_SPACING,
        indent: { right: (config.specialOptions.hasStamp ? 4 : 2) * charWidthTwips },
      }
      break

    // 正文及所有标题级别：两端对齐 + 首行缩进
    default:
      style = {
        alignment: AlignmentType.JUSTIFIED,
        spacing: BASE_SPACING,
        indent: BODY_INDENT,
      }
      break
  }

  if (type === NodeType.PARAGRAPH && noIndent) {
    style = {
      ...style,
      indent: { left: 0, right: 0, firstLine: 0 },
    }
  }

  if (isTitleName || isTitleDate) {
    style = {
      ...style,
      alignment: AlignmentType.CENTER,
      indent: { left: 0, right: 0, firstLine: 0 },
    }
  }

  if (!manualAlignment) return style

  const alignmentMap = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
    justify: AlignmentType.JUSTIFIED,
  } as const

  return {
    ...style,
    alignment: alignmentMap[manualAlignment],
    indent: manualAlignment === 'justify' ? style.indent : { left: 0, right: 0, firstLine: 0 },
  }
}

/** 节点类型 → 文本样式 (font / size / bold) */
export function getRunStyle(type: NodeType, config: DocumentConfig): Partial<IRunOptions> {
  const bodyFontSize = config.body.fontSize * 2 // pt → half-point
  const titleFontSize = config.title.fontSize * 2

  // 字符间距微调：使每行恰好 28 字 (GB/T 9704)
  // characterSpacing 单位为 twips (1/20 pt)，向下取整确保不超出可用宽度
  const availableTwips = 11906 - cmToTwip(config.margins.left) - cmToTwip(config.margins.right)
  const charGapCount = Math.max(1, CHARS_PER_LINE - 1)
  const charSpacing = Math.floor(
    (availableTwips - config.body.fontSize * 20 * CHARS_PER_LINE) / charGapCount
  )

  switch (type) {
    case NodeType.DOCUMENT_TITLE:
      return {
        font: font(config.title.fontFamily),
        size: titleFontSize,
        color: DEFAULT_TEXT_COLOR,
        italics: false,
      }

    case NodeType.HEADING_1:
      return {
        font: font(config.advanced.h1.fontFamily, config.advanced.h1.asciiFontFamily || config.advanced.h1.fontFamily),
        size: config.advanced.h1.fontSize * 2,
        characterSpacing: charSpacing,
        color: DEFAULT_TEXT_COLOR,
        italics: false,
      }

    case NodeType.HEADING_2:
      return {
        font: font(config.advanced.h2.fontFamily, config.advanced.h2.asciiFontFamily || config.advanced.h2.fontFamily),
        size: config.advanced.h2.fontSize * 2,
        characterSpacing: charSpacing,
        color: DEFAULT_TEXT_COLOR,
        italics: false,
      }

    case NodeType.HEADING_3:
      return {
        font: font(config.advanced.h3.fontFamily, config.advanced.h3.asciiFontFamily || config.advanced.h3.fontFamily),
        size: config.advanced.h3.fontSize * 2,
        bold: config.specialOptions.boldHeading3,
        characterSpacing: charSpacing,
        color: DEFAULT_TEXT_COLOR,
        italics: false,
      }

    case NodeType.HEADING_4:
    case NodeType.ADDRESSEE:
    case NodeType.PARAGRAPH:
    case NodeType.DATE:
    case NodeType.SIGNATURE:
    default:
      return {
        font: font(config.body.fontFamily),
        size: bodyFontSize,
        characterSpacing: charSpacing,
        color: DEFAULT_TEXT_COLOR,
        italics: false,
      }
  }
}

export function isTitleDateLine(text: string): boolean {
  return TITLE_DATE_RE.test(text.trim())
}

export function isTitleNameLine(text: string): boolean {
  return TITLE_NAME_RE.test(text.trim())
}

export function getTitleDateRunStyle(config: DocumentConfig): Partial<IRunOptions> {
  return {
    font: font('楷体_GB2312', '楷体_GB2312'),
    size: 16 * 2,
    characterSpacing: Math.floor(
      (11906 - cmToTwip(config.margins.left) - cmToTwip(config.margins.right)) / CHARS_PER_LINE - config.body.fontSize * 20,
    ),
  }
}

export function getTitleNameRunStyle(config: DocumentConfig): Partial<IRunOptions> {
  return getTitleDateRunStyle(config)
}

export function hasRichStyleOverrides(runs?: RichTextRun[]): boolean {
  return !!runs?.some((run) => (
    run.bold ||
    run.italic ||
    run.underline ||
    !!run.fontFamily ||
    !!run.fontSize
  ))
}

export function buildRunStyleOverride(
  baseStyle: Partial<IRunOptions>,
  run: RichTextRun,
): Partial<IRunOptions> {
  return {
    ...baseStyle,
    text: run.text,
    ...(run.fontFamily ? { font: font(run.fontFamily, run.fontFamily) } : {}),
    ...(run.fontSize ? { size: run.fontSize * 2 } : {}),
    ...(run.bold !== undefined ? { bold: run.bold } : {}),
    ...(run.italic !== undefined ? { italics: run.italic } : {}),
    ...(run.underline ? { underline: { type: UnderlineType.SINGLE } } : {}),
  }
}

/**
 * 附件说明段落样式
 *
 * @param isMultiple 是否为多附件模式
 * @param isFirst 是否为多附件的第一行（仅多附件模式有效）
 * @param config 文档配置
 */
export function getAttachmentParagraphStyle(
  isMultiple: boolean,
  isFirst: boolean,
  config: DocumentConfig,
  omitSpacingBefore = false
): Partial<IParagraphOptions> {
  const lineSpacingValue = ptToTwip(config.body.lineSpacing)
  const charWidthTwips = calculateCharWidth(config)
  const spacing = omitSpacingBefore
    ? { line: lineSpacingValue, lineRule: LineRuleType.EXACT }
    : { line: lineSpacingValue, lineRule: LineRuleType.EXACT, before: lineSpacingValue }

  if (!isMultiple) {
    // 单附件：左空 5 字符（2 + 3），悬挂缩进 3 字符（用于换行对齐）
    return {
      alignment: AlignmentType.JUSTIFIED,
      spacing,
      indent: {
        left: 5 * charWidthTwips,
        hanging: 3 * charWidthTwips,
      },
    }
  }

  if (isFirst) {
    // 多附件第一行：左空 5 字符（2 + 3），悬挂缩进 3 字符
    // 首行从 2 字符位置开始（5 - 3 = 2），换行后从 5 字符位置开始
    return {
      alignment: AlignmentType.JUSTIFIED,
      spacing,
      indent: {
        left: 5 * charWidthTwips,
        hanging: 3 * charWidthTwips,
      },
    }
  }

  // 多附件后续行：左空 5 字符（2 + 3），首行和换行后都从 5 字符开始
  return {
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: lineSpacingValue, lineRule: LineRuleType.EXACT },
    indent: {
      left: 5 * charWidthTwips,
    },
  }
}

/**
 * 附件说明文本样式：使用纯中文字体
 * 西文字符（数字、点号等）也使用中文字体
 */
export function getAttachmentRunStyle(config: DocumentConfig): Partial<IRunOptions> {
  const bodyFontSize = config.body.fontSize * 2
  const availableTwips = 11906 - cmToTwip(config.margins.left) - cmToTwip(config.margins.right)
  const charGapCount = Math.max(1, CHARS_PER_LINE - 1)
  const charSpacing = Math.floor(
    (availableTwips - config.body.fontSize * 20 * CHARS_PER_LINE) / charGapCount
  )

  return {
    font: {
      ascii: config.body.fontFamily,
      eastAsia: config.body.fontFamily,
      hAnsi: config.body.fontFamily,
      cs: config.body.fontFamily,
    },
    size: bodyFontSize,
    characterSpacing: charSpacing,
    color: DEFAULT_TEXT_COLOR,
    italics: false,
  }
}
