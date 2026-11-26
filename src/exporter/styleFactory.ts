import {
  AlignmentType,
  BuilderElement,
  type IParagraphOptions,
  type IRunOptions,
  type IFontAttributesProperties,
  LineRuleType,
} from 'docx'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { ptToTwip } from '../types/documentConfig'
import { BLACK_COLOR_HEX } from '../layout/constants'
import {
  calculateCharSpacingTwips,
  calculateCharWidthTwips,
  calculateSignatureLayout,
} from '../layout/typography'

export function getBodyAsciiFont(config: DocumentConfig): string {
  return config.body.asciiFontFamily || config.body.fontFamily
}

/**
 * 构建 IFontAttributesProperties，支持中英文字体分离
 * hAnsi 使用中文字体以确保省略号、破折号、六角括号等标点字体正确
 */
export function makeFont(eastAsia: string, ascii = 'Times New Roman'): IFontAttributesProperties {
  return { ascii, eastAsia, hAnsi: eastAsia, cs: ascii }
}

/** 获取正文完整字体配置（供版头、版记、落款等复用） */
export function getBodyFontConfig(config: DocumentConfig): IFontAttributesProperties {
  return makeFont(config.body.fontFamily, getBodyAsciiFont(config))
}

function calculateFirstLineIndent(config: DocumentConfig): number {
  return calculateCharWidthTwips(config) * config.body.firstLineIndent
}

export function shouldUseCharacterFirstLineIndent(type: NodeType): boolean {
  return type === NodeType.HEADING_1
    || type === NodeType.HEADING_2
    || type === NodeType.HEADING_3
    || type === NodeType.HEADING_4
    || type === NodeType.PARAGRAPH
    || type === NodeType.POSTSCRIPT
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

export interface ParagraphStyleExtraOptions {
  isLastTitleLine?: boolean
}

/** 节点类型 → 段落样式 */
export function getParagraphStyle(
  type: NodeType,
  config: DocumentConfig,
  signatureContent?: string,
  dateContent?: string,
  extra?: ParagraphStyleExtraOptions,
): Partial<IParagraphOptions> {
  const lineSpacingValue = ptToTwip(config.body.lineSpacing)
  const firstLineIndentTwips = calculateFirstLineIndent(config)
  const charWidthTwips = calculateCharWidthTwips(config)

  const BASE_SPACING = {
    line: lineSpacingValue,
    lineRule: LineRuleType.EXACT,
    before: 0,
    after: 0,
  } as const

  const BODY_INDENT = { firstLine: firstLineIndentTwips, left: 0 } as const

  switch (type) {
    case NodeType.DOCUMENT_TITLE: {
      const isLastTitleLine = extra?.isLastTitleLine ?? true
      return {
        alignment: AlignmentType.CENTER,
        spacing: {
          line: ptToTwip(config.title.lineSpacing),
          lineRule: LineRuleType.EXACT,
          before: 0,
          after: isLastTitleLine ? lineSpacingValue : 0,
        },
      }
    }

    case NodeType.ADDRESSEE:
      return {
        alignment: AlignmentType.JUSTIFIED,
        spacing: BASE_SPACING,
        indent: { left: 0 },
      }

    case NodeType.ATTACHMENT:
      return {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...BASE_SPACING, before: lineSpacingValue },
        indent: { left: 2 * charWidthTwips },
      }

    case NodeType.ATTACHMENT_PAGE_HEADER:
      return {
        alignment: AlignmentType.LEFT,
        pageBreakBefore: true,
        spacing: { ...BASE_SPACING, after: lineSpacingValue },
        indent: { left: 0 },
      }

    case NodeType.MINUTES_ATTENDANCE:
      // §10.3: 左空二字编排“出席：”，冒号占一字 -> 回行与冒号后首字对齐（左 5 字 + 悬挂 3 字）
      return {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...BASE_SPACING, before: lineSpacingValue },
        indent: {
          left: 5 * charWidthTwips,
          hanging: 3 * charWidthTwips,
        },
      }

    case NodeType.SIGNATURE: {
      const layout = calculateSignatureLayout(
        signatureContent ?? null,
        dateContent ?? null,
        config.specialOptions.hasStamp,
      )
      return {
        alignment: AlignmentType.RIGHT,
        spacing: BASE_SPACING,
        indent: { right: Math.round(layout.signatureRightIndentEm * charWidthTwips) },
      }
    }

    case NodeType.DATE: {
      const layout = calculateSignatureLayout(
        signatureContent ?? null,
        dateContent ?? null,
        config.specialOptions.hasStamp,
      )
      return {
        alignment: AlignmentType.RIGHT,
        spacing: BASE_SPACING,
        indent: { right: Math.round(layout.dateRightIndentEm * charWidthTwips) },
      }
    }

    case NodeType.POSTSCRIPT:
    default:
      return {
        alignment: AlignmentType.JUSTIFIED,
        spacing: BASE_SPACING,
        indent: BODY_INDENT,
      }
  }
}

/** 节点类型 → 文本样式 (font / size / bold) */
export function getRunStyle(type: NodeType, config: DocumentConfig): Partial<IRunOptions> {
  const bodyFontSize = config.body.fontSize * 2
  const titleFontSize = config.title.fontSize * 2
  const charSpacing = calculateCharSpacingTwips(config)

  switch (type) {
    case NodeType.DOCUMENT_TITLE:
      return {
        font: makeFont(config.title.fontFamily, getBodyAsciiFont(config)),
        size: titleFontSize,
        color: BLACK_COLOR_HEX,
        bold: false,
        italics: false,
      }

    case NodeType.HEADING_1:
      return {
        font: makeFont(
          config.advanced.h1.fontFamily,
          config.advanced.h1.asciiFontFamily || config.advanced.h1.fontFamily,
        ),
        size: config.advanced.h1.fontSize * 2,
        characterSpacing: charSpacing,
        color: BLACK_COLOR_HEX,
        italics: false,
      }

    case NodeType.HEADING_2:
      return {
        font: makeFont(
          config.advanced.h2.fontFamily,
          config.advanced.h2.asciiFontFamily || config.advanced.h2.fontFamily,
        ),
        size: config.advanced.h2.fontSize * 2,
        bold: config.specialOptions.boldHeading2,
        characterSpacing: charSpacing,
        color: BLACK_COLOR_HEX,
        italics: false,
      }

    case NodeType.HEADING_3:
      return {
        font: makeFont(
          config.advanced.h3.fontFamily,
          config.advanced.h3.asciiFontFamily || config.advanced.h3.fontFamily,
        ),
        size: config.advanced.h3.fontSize * 2,
        bold: config.specialOptions.boldHeading3,
        characterSpacing: charSpacing,
        color: BLACK_COLOR_HEX,
        italics: false,
      }

    case NodeType.ATTACHMENT_PAGE_HEADER:
      return {
        font: makeFont(
          config.advanced.h1.fontFamily,
          config.advanced.h1.asciiFontFamily || config.advanced.h1.fontFamily,
        ),
        size: bodyFontSize,
        characterSpacing: charSpacing,
        color: BLACK_COLOR_HEX,
        italics: false,
      }

    case NodeType.HEADING_4:
    case NodeType.ADDRESSEE:
    case NodeType.PARAGRAPH:
    case NodeType.DATE:
    case NodeType.SIGNATURE:
    case NodeType.POSTSCRIPT:
    case NodeType.MINUTES_ATTENDANCE:
    default:
      return {
        font: getBodyFontConfig(config),
        size: bodyFontSize,
        characterSpacing: charSpacing,
        color: BLACK_COLOR_HEX,
        italics: false,
      }
  }
}

/**
 * 附件说明段落样式
 */
export function getAttachmentParagraphStyle(
  isMultiple: boolean,
  isFirst: boolean,
  config: DocumentConfig,
  omitSpacingBefore = false,
): Partial<IParagraphOptions> {
  const lineSpacingValue = ptToTwip(config.body.lineSpacing)
  const charWidthTwips = calculateCharWidthTwips(config)
  const spacing = omitSpacingBefore
    ? { line: lineSpacingValue, lineRule: LineRuleType.EXACT }
    : { line: lineSpacingValue, lineRule: LineRuleType.EXACT, before: lineSpacingValue }

  if (!isMultiple || isFirst) {
    return {
      alignment: AlignmentType.JUSTIFIED,
      spacing,
      indent: {
        left: 5 * charWidthTwips,
        hanging: 3 * charWidthTwips,
      },
    }
  }

  return {
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: lineSpacingValue, lineRule: LineRuleType.EXACT },
    indent: {
      left: 5 * charWidthTwips,
    },
  }
}

/** 附件说明文本样式 */
export function getAttachmentRunStyle(config: DocumentConfig): Partial<IRunOptions> {
  const bodyFontSize = config.body.fontSize * 2
  const charSpacing = calculateCharSpacingTwips(config)

  return {
    font: getBodyFontConfig(config),
    size: bodyFontSize,
    characterSpacing: charSpacing,
    color: BLACK_COLOR_HEX,
    italics: false,
  }
}
