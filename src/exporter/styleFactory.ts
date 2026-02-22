import {
  AlignmentType,
  type IParagraphOptions,
  type IRunOptions,
  type IFontAttributesProperties,
  LineRuleType,
} from 'docx'
import { NodeType } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { ptToTwip } from '../types/documentConfig'

/** 构建 IFontAttributesProperties，支持中英文字体分离 */
function font(eastAsia: string, ascii = 'Times New Roman'): IFontAttributesProperties {
  return { ascii, eastAsia, hAnsi: ascii, cs: ascii }
}

/** 节点类型 → 段落样式 */
export function getParagraphStyle(type: NodeType, config: DocumentConfig): Partial<IParagraphOptions> {
  const lineSpacingValue = ptToTwip(config.body.lineSpacing)
  const indentPt = `${config.body.firstLineIndent * config.body.fontSize}pt` as `${number}pt`

  const BASE_SPACING = {
    line: lineSpacingValue,
    lineRule: LineRuleType.EXACT,
    before: 0,
    after: 0,
  } as const

  const BODY_INDENT = { firstLine: indentPt, left: 0 } as const

  switch (type) {
    case NodeType.DOCUMENT_TITLE:
      return {
        alignment: AlignmentType.CENTER,
        spacing: {
          line: ptToTwip(config.title.lineSpacing),
          lineRule: LineRuleType.EXACT,
          before: 0,
          after: 0,
        },
      }

    case NodeType.ADDRESSEE:
      return {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...BASE_SPACING, before: lineSpacingValue },
        indent: { left: 0 },
      }

    case NodeType.ATTACHMENT:
      return {
        alignment: AlignmentType.JUSTIFIED,
        spacing: { ...BASE_SPACING, before: lineSpacingValue },
        indent: { left: indentPt },
      }

    case NodeType.DATE:
      return {
        alignment: AlignmentType.RIGHT,
        spacing: BASE_SPACING,
        indent: { right: `${4 * config.body.fontSize}pt` as `${number}pt` },
      }

    // 正文及所有标题级别：两端对齐 + 首行缩进
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
  const bodyFontSize = config.body.fontSize * 2 // pt → half-point
  const titleFontSize = config.title.fontSize * 2

  switch (type) {
    case NodeType.DOCUMENT_TITLE:
      return {
        font: font(config.title.fontFamily),
        size: titleFontSize,
      }

    case NodeType.HEADING_1:
      return {
        font: font(config.advanced.h1.fontFamily, config.advanced.h1.asciiFontFamily || config.advanced.h1.fontFamily),
        size: config.advanced.h1.fontSize * 2,
      }

    case NodeType.HEADING_2:
      return {
        font: font(config.advanced.h2.fontFamily, config.advanced.h2.asciiFontFamily || config.advanced.h2.fontFamily),
        size: config.advanced.h2.fontSize * 2,
      }

    case NodeType.HEADING_3:
      return {
        font: font(config.advanced.h3.fontFamily, config.advanced.h3.asciiFontFamily || config.advanced.h3.fontFamily),
        size: config.advanced.h3.fontSize * 2,
        bold: true,
      }

    case NodeType.ADDRESSEE:
      return {
        font: font(
          config.advanced.addressee.fontFamily,
          config.advanced.addressee.asciiFontFamily || config.advanced.addressee.fontFamily,
        ),
        size: config.advanced.addressee.fontSize * 2,
      }

    case NodeType.HEADING_4:
    case NodeType.PARAGRAPH:
    case NodeType.ATTACHMENT:
    case NodeType.DATE:
    default:
      return {
        font: font(config.body.fontFamily),
        size: bodyFontSize,
      }
  }
}
