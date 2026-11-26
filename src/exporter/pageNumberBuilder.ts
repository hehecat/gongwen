import {
  AlignmentType,
  BorderStyle,
  Footer,
  LineRuleType,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { DocumentConfig, PageNumberStyle } from '../types/documentConfig'
import { mmToTwip, ptToTwip } from '../types/documentConfig'
import {
  BLACK_COLOR_HEX,
  LETTER_LINE_LENGTH_MM,
  PAGE_NUMBER_FONT_SIZE_PT,
  PAGE_NUM_GAP_MM,
  RED_COLOR_HEX,
} from '../layout/constants'
import { resolveHeaderRenderPlan } from '../layout/typography'
import { TABLE_NO_BORDERS } from './headerBuilder'

const PAGE_NUM_DASH = '\u2014'
const PAGE_NUM_SPACING_BEFORE = mmToTwip(PAGE_NUM_GAP_MM)

type PageNumberAlignment = typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT | typeof AlignmentType.CENTER

interface PageNumberParagraphOptions {
  alignment: PageNumberAlignment
  indent: { left?: number; right?: number }
}

export function getPageNumberParagraphOptions(
  pageNumberStyle: PageNumberStyle,
  pageNumIndent: number,
): {
  evenAndOddHeaderAndFooters: boolean
  defaultOptions: PageNumberParagraphOptions
  evenOptions?: PageNumberParagraphOptions
} {
  if (pageNumberStyle === 'center') {
    return {
      evenAndOddHeaderAndFooters: false,
      defaultOptions: {
        alignment: AlignmentType.CENTER,
        indent: {},
      },
    }
  }

  return {
    evenAndOddHeaderAndFooters: true,
    defaultOptions: {
      alignment: AlignmentType.RIGHT,
      indent: { right: pageNumIndent },
    },
    evenOptions: {
      alignment: AlignmentType.LEFT,
      indent: { left: pageNumIndent },
    },
  }
}

function pageNumberParagraph(
  alignment: PageNumberAlignment,
  indent: { left?: number; right?: number },
  pageNumFont: Record<string, string>,
  pageNumSize: number,
): Paragraph {
  return new Paragraph({
    alignment,
    indent,
    spacing: { before: PAGE_NUM_SPACING_BEFORE },
    children: [
      new TextRun({ font: pageNumFont, size: pageNumSize, color: BLACK_COLOR_HEX, children: [`${PAGE_NUM_DASH} `] }),
      new TextRun({ font: pageNumFont, size: pageNumSize, color: BLACK_COLOR_HEX, children: [PageNumber.CURRENT] }),
      new TextRun({ font: pageNumFont, size: pageNumSize, color: BLACK_COLOR_HEX, children: [` ${PAGE_NUM_DASH}`] }),
    ],
  })
}

function buildLetterFirstPageBottomLine(): Table {
  // §10.1: 信函首页底部 170mm 上细下粗红色双线，首页不显示页码
  return new Table({
    width: { size: mmToTwip(LETTER_LINE_LENGTH_MM), type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: {
      ...TABLE_NO_BORDERS,
      top: {
        style: BorderStyle.THIN_THICK_SMALL_GAP,
        size: 12,
        color: RED_COLOR_HEX,
      },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: TABLE_NO_BORDERS,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({
              spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
              children: [],
            })],
          }),
        ],
      }),
    ],
  })
}

export interface DocumentFooterSpec {
  evenAndOddHeaderAndFooters: boolean
  titlePage: boolean
  footers?: {
    default?: Footer
    even?: Footer
    first?: Footer
  }
}

/** 构建页脚（包含国标页码、自定义页码字体与信函首页底部红双线） */
export function buildPageNumberFooters(config: DocumentConfig): DocumentFooterSpec {
  const plan = resolveHeaderRenderPlan(config.header)
  const selectedFont = config.specialOptions.pageNumberFont.trim() || '宋体'
  const pageNumFont = {
    ascii: selectedFont,
    eastAsia: selectedFont,
    hAnsi: selectedFont,
    cs: selectedFont,
  }
  const pageNumSize = PAGE_NUMBER_FONT_SIZE_PT * 2
  const pageNumIndent = ptToTwip(PAGE_NUMBER_FONT_SIZE_PT)
  const pageNumberOptions = getPageNumberParagraphOptions(
    config.specialOptions.pageNumberStyle,
    pageNumIndent,
  )

  const showPageNum = config.specialOptions.showPageNumber
  const isLetter = plan.hideFirstPageNumber

  if (!showPageNum && !isLetter) {
    return {
      evenAndOddHeaderAndFooters: false,
      titlePage: false,
      footers: undefined,
    }
  }

  const footers: DocumentFooterSpec['footers'] = {}

  if (showPageNum) {
    footers.default = new Footer({
      children: [
        pageNumberParagraph(
          pageNumberOptions.defaultOptions.alignment,
          pageNumberOptions.defaultOptions.indent,
          pageNumFont,
          pageNumSize,
        ),
      ],
    })
    if (pageNumberOptions.evenOptions) {
      footers.even = new Footer({
        children: [
          pageNumberParagraph(
            pageNumberOptions.evenOptions.alignment,
            pageNumberOptions.evenOptions.indent,
            pageNumFont,
            pageNumSize,
          ),
        ],
      })
    }
  }

  if (isLetter) {
    // §10.1 信函首页无页码，但底部需印 170mm 上细下粗红色双线
    footers.first = new Footer({
      children: [buildLetterFirstPageBottomLine()],
    })
  }

  return {
    evenAndOddHeaderAndFooters: showPageNum && pageNumberOptions.evenAndOddHeaderAndFooters,
    titlePage: isLetter,
    footers,
  }
}
