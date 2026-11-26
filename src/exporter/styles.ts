import { AlignmentType, LineRuleType, type IStylesOptions } from 'docx'
import type { DocumentConfig } from '../types/documentConfig'
import { ptToTwip } from '../types/documentConfig'
import { BLACK_COLOR_HEX } from '../layout/constants'
import { getBodyAsciiFont, makeFont } from './styleFactory'

/**
 * 构建 Word 内置文档样式表 (Normal + Heading1 ~ Heading4)
 * 显式设定黑色文字与取消斜体，确保大纲窗格、目录引用与正文风格一致
 */
export function buildDocumentStyles(config: DocumentConfig): IStylesOptions {
  const bodyLineTwip = ptToTwip(config.body.lineSpacing)
  const bodyAscii = getBodyAsciiFont(config)
  const h1Ascii = config.advanced.h1.asciiFontFamily || config.advanced.h1.fontFamily
  const h2Ascii = config.advanced.h2.asciiFontFamily || config.advanced.h2.fontFamily
  const h3Ascii = config.advanced.h3.asciiFontFamily || config.advanced.h3.fontFamily

  return {
    default: {
      document: {
        paragraph: {
          alignment: AlignmentType.JUSTIFIED,
          spacing: {
            line: bodyLineTwip,
            lineRule: LineRuleType.EXACT,
            before: 0,
            after: 0,
          },
        },
        run: {
          font: makeFont(config.body.fontFamily, bodyAscii),
          size: config.body.fontSize * 2,
          color: BLACK_COLOR_HEX,
          italics: false,
        },
      },
      heading1: {
        paragraph: {
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: bodyLineTwip, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        },
        run: {
          font: makeFont(config.advanced.h1.fontFamily, h1Ascii),
          size: config.advanced.h1.fontSize * 2,
          color: BLACK_COLOR_HEX,
          bold: false,
          italics: false,
        },
      },
      heading2: {
        paragraph: {
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: bodyLineTwip, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        },
        run: {
          font: makeFont(config.advanced.h2.fontFamily, h2Ascii),
          size: config.advanced.h2.fontSize * 2,
          color: BLACK_COLOR_HEX,
          bold: config.specialOptions.boldHeading2,
          italics: false,
        },
      },
      heading3: {
        paragraph: {
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: bodyLineTwip, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        },
        run: {
          font: makeFont(config.advanced.h3.fontFamily, h3Ascii),
          size: config.advanced.h3.fontSize * 2,
          color: BLACK_COLOR_HEX,
          bold: config.specialOptions.boldHeading3,
          italics: false,
        },
      },
      heading4: {
        paragraph: {
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: bodyLineTwip, lineRule: LineRuleType.EXACT, before: 0, after: 0 },
        },
        run: {
          font: makeFont(config.body.fontFamily, bodyAscii),
          size: config.body.fontSize * 2,
          color: BLACK_COLOR_HEX,
          bold: false,
          italics: false,
        },
      },
    },
  }
}
