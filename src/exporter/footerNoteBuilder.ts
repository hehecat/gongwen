import {
  AlignmentType,
  BorderStyle,
  OverlapType,
  Paragraph,
  RelativeHorizontalPosition,
  RelativeVerticalPosition,
  Table,
  TableAnchorType,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
} from 'docx'
import type { DocumentConfig } from '../types/documentConfig'
import { ptToTwip } from '../types/documentConfig'
import {
  BLACK_COLOR_HEX,
  FOOTER_NOTE_FONT_SIZE_PT,
} from '../layout/constants'
import { ensureChinesePeriod, resolveHeaderRenderPlan } from '../layout/typography'
import { getBodyFontConfig } from './styleFactory'
import { TABLE_NO_BORDERS } from './headerBuilder'

const NO_BORDER: IBorderOptions = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
}

/**
 * 构建版记浮动表格（GB/T 9704 §7.4）
 * - 统一使用 4 号字（14pt = 280 twips）计算左右空一字
 * - 支持移至版记的主送机关（置于抄送之上且无分隔线）
 * - 信函格式不加印发机关/日期与分隔线（§10.1）
 */
export function buildFooterNoteTable(config: DocumentConfig): Table | null {
  if (!config.footerNote.enabled) return null

  const plan = resolveHeaderRenderPlan(config.header)
  const bodyFont = getBodyFontConfig(config)
  const footerNoteSize = FOOTER_NOTE_FONT_SIZE_PT * 2 // 28 half-point (4号字 14pt)
  const fnOneCharIndent = ptToTwip(FOOTER_NOTE_FONT_SIZE_PT) // 280 twips

  const thickBorder: IBorderOptions = {
    style: BorderStyle.SINGLE,
    size: 8, // 约 0.35mm
    color: BLACK_COLOR_HEX,
  }
  const thinBorder: IBorderOptions = {
    style: BorderStyle.SINGLE,
    size: 6, // 约 0.25mm
    color: BLACK_COLOR_HEX,
  }

  const hasMainRecipient = !!config.footerNote.mainRecipient.trim()
  const hasCc = !!config.footerNote.cc.trim()
  const hasPrint = !plan.isLetterFooterNote && !!(config.footerNote.printer.trim() || config.footerNote.printDate.trim())
  const footerRows: TableRow[] = []

  // §7.4.2 移至版记的主送机关（置于抄送机关之上，之间不加分隔线）
  if (hasMainRecipient) {
    footerRows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: TABLE_NO_BORDERS,
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: {
              left: fnOneCharIndent * 4,
              hanging: fnOneCharIndent * 3,
              right: fnOneCharIndent,
            },
            spacing: { before: 0, after: 0 },
            children: [new TextRun({
              text: `主送：${ensureChinesePeriod(config.footerNote.mainRecipient)}`,
              font: bodyFont,
              size: footerNoteSize,
              color: BLACK_COLOR_HEX,
            })],
          })],
        }),
      ],
    }))
  }

  if (hasCc) {
    footerRows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: TABLE_NO_BORDERS,
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
              color: BLACK_COLOR_HEX,
            })],
          })],
        }),
      ],
    }))
  }

  if (hasPrint) {
    const printerText = config.footerNote.printer.trim()
    const dateText = config.footerNote.printDate.trim()
      ? `${config.footerNote.printDate.trim()}印发`
      : ''

    // §7.4.2 + §7.4.3：若上面有主送/抄送要素，用细线与印发机关隔开
    const topCellBorder = (hasMainRecipient || hasCc) ? thinBorder : NO_BORDER

    footerRows.push(new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: { ...TABLE_NO_BORDERS, top: topCellBorder },
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            indent: { left: fnOneCharIndent },
            spacing: { before: 0, after: 0 },
            children: printerText
              ? [new TextRun({ text: printerText, font: bodyFont, size: footerNoteSize, color: BLACK_COLOR_HEX })]
              : [],
          })],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: { ...TABLE_NO_BORDERS, top: topCellBorder },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            indent: { right: fnOneCharIndent },
            spacing: { before: 0, after: 0 },
            children: dateText
              ? [new TextRun({ text: dateText, font: bodyFont, size: footerNoteSize, color: BLACK_COLOR_HEX })]
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
          borders: TABLE_NO_BORDERS,
          children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })],
        }),
      ],
    }))
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5000, 5000],
    borders: plan.isLetterFooterNote
      ? TABLE_NO_BORDERS
      : {
          top: thickBorder,
          bottom: thickBorder,
          left: NO_BORDER,
          right: NO_BORDER,
          insideHorizontal: (hasMainRecipient || hasCc) && hasPrint ? thinBorder : NO_BORDER,
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
  })
}
