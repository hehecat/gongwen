import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  LineRuleType,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IBorderOptions,
} from 'docx'
import type { DocumentConfig } from '../types/documentConfig'
import { mmToTwip, ptToTwip } from '../types/documentConfig'
import {
  A4_WIDTH_MM,
  BLACK_COLOR_HEX,
  HEADER_SEP_GAP_MM,
  LETTER_LINE_LENGTH_MM,
  RED_COLOR_HEX,
} from '../layout/constants'
import { parseSigners, resolveHeaderRenderPlan } from '../layout/typography'
import { getBodyFontConfig, makeFont } from './styleFactory'

const NO_BORDER: IBorderOptions = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
}

export const TABLE_NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
}

function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

function readImageDimensions(bytes: Uint8Array, type: 'png' | 'jpg'): { width: number; height: number } | null {
  if (type === 'png' && bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]
    const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]
    if (width > 0 && height > 0) return { width, height }
  }
  if (type === 'jpg' && bytes.length >= 4 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
    let i = 2
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xFF) {
        i++
        continue
      }
      const marker = bytes[i + 1]
      if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
        const height = (bytes[i + 5] << 8) | bytes[i + 6]
        const width = (bytes[i + 7] << 8) | bytes[i + 8]
        if (width > 0 && height > 0) return { width, height }
        break
      }
      if (i + 3 >= bytes.length) break
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3]
      if (segLen < 2) break
      i += 2 + segLen
    }
  }
  return null
}

function parseImageDataUrl(dataUrl: string): { type: 'png' | 'jpg'; data: Uint8Array } | null {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i)
  if (!match) return null
  const type = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
  try {
    return { type, data: decodeBase64(match[2]) }
  } catch {
    return null
  }
}

function buildBlankBodyLine(config: DocumentConfig): Paragraph {
  const bodyFont = getBodyFontConfig(config)
  return new Paragraph({
    spacing: { line: ptToTwip(config.body.lineSpacing), lineRule: LineRuleType.EXACT, before: 0, after: 0 },
    children: [new TextRun({ font: bodyFont, size: config.body.fontSize * 2, text: '' })],
  })
}

function buildTopLeftSecurityLines(config: DocumentConfig): Paragraph[] {
  const { header } = config
  const bodyFont = getBodyFontConfig(config)
  const heiFont = makeFont('黑体', 'Times New Roman')
  const size = config.body.fontSize * 2
  const spacing = { line: ptToTwip(config.body.lineSpacing), lineRule: LineRuleType.EXACT, before: 0, after: 0 }
  const out: Paragraph[] = []

  if (header.copyNumber.trim()) {
    out.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing,
      children: [new TextRun({ text: header.copyNumber.trim(), font: bodyFont, size, color: BLACK_COLOR_HEX })],
    }))
  }
  if (header.secretLevel.trim()) {
    out.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing,
      children: [new TextRun({ text: header.secretLevel.trim(), font: heiFont, size, color: BLACK_COLOR_HEX })],
    }))
  }
  if (header.urgency.trim()) {
    out.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing,
      children: [new TextRun({ text: header.urgency.trim(), font: heiFont, size, color: BLACK_COLOR_HEX })],
    }))
  }
  return out
}

function buildOrgLogoBlock(config: DocumentConfig): (Paragraph | Table)[] {
  const { header } = config
  const parsedImage = header.customImageDataUrl ? parseImageDataUrl(header.customImageDataUrl) : null

  if (parsedImage) {
    const pxPerMm = 96 / 25.4
    const maxWidthPx = Math.max(120, (A4_WIDTH_MM - config.margins.left * 10 - config.margins.right * 10) * pxPerMm)
    const targetHeightPx = Math.max(24, header.customImageHeightMm * pxPerMm)
    const dims = readImageDimensions(parsedImage.data, parsedImage.type)
    let width = maxWidthPx
    let height = targetHeightPx
    if (dims) {
      const ratio = dims.width / dims.height
      width = targetHeightPx * ratio
      if (width > maxWidthPx) {
        width = maxWidthPx
        height = width / ratio
      }
    }
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            type: parsedImage.type,
            data: parsedImage.data,
            transformation: { width: Math.round(width), height: Math.round(height) },
          }),
        ],
      }),
    ]
  }

  const orgLines = header.orgName
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (orgLines.length === 0) return []

  const orgFont = makeFont(header.orgNameFontFamily || '方正小标宋_GBK', 'Times New Roman')
  const orgSize = header.orgNameFontSize * 2
  const charSpacing = header.orgNameAlign === 'center' && header.orgNameLetterSpacing > 0
    ? ptToTwip(header.orgNameLetterSpacing)
    : undefined
  const alignment = header.orgNameAlign === 'distribute'
    ? AlignmentType.DISTRIBUTE
    : AlignmentType.CENTER

  const suffix = header.orgNameSuffix.trim()
  if (suffix) {
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 82, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: orgLines.map((line) => new Paragraph({
                  alignment,
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({
                    text: line,
                    font: orgFont,
                    size: orgSize,
                    color: RED_COLOR_HEX,
                    characterSpacing: charSpacing,
                  })],
                })),
              }),
              new TableCell({
                width: { size: 18, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({
                    text: suffix,
                    font: orgFont,
                    size: orgSize,
                    color: RED_COLOR_HEX,
                  })],
                })],
              }),
            ],
          }),
        ],
      }),
    ]
  }

  return orgLines.map((line) => new Paragraph({
    alignment,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text: line,
      font: orgFont,
      size: orgSize,
      color: RED_COLOR_HEX,
      characterSpacing: charSpacing,
    })],
  }))
}

function buildRedSeparator(style: DocumentConfig['header']['separatorStyle'], isLetter = false): (Paragraph | Table)[] {
  if (style === 'none' && !isLetter) return []

  if (isLetter) {
    // §10.1: 发文机关标志下 4mm 处印一条 170mm 红色双线（上粗下细）
    return [
      new Table({
        width: { size: mmToTwip(LETTER_LINE_LENGTH_MM), type: WidthType.DXA },
        alignment: AlignmentType.CENTER,
        borders: {
          ...TABLE_NO_BORDERS,
          bottom: {
            style: BorderStyle.THICK_THIN_SMALL_GAP,
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
                  spacing: { before: mmToTwip(HEADER_SEP_GAP_MM), after: 0, line: 20, lineRule: LineRuleType.EXACT },
                  children: [],
                })],
              }),
            ],
          }),
        ],
      }),
    ]
  }

  if (style === 'star') {
    const redLine: IBorderOptions = {
      style: BorderStyle.SINGLE,
      size: 15,
      color: RED_COLOR_HEX,
    }
    return [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 47, type: WidthType.PERCENTAGE },
                borders: { ...TABLE_NO_BORDERS, bottom: redLine },
                verticalAlign: VerticalAlign.BOTTOM,
                children: [new Paragraph({ spacing: { before: 40, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [] })],
              }),
              new TableCell({
                width: { size: 6, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: '★', size: 22, color: RED_COLOR_HEX, font: makeFont('宋体', 'Times New Roman') })],
                })],
              }),
              new TableCell({
                width: { size: 47, type: WidthType.PERCENTAGE },
                borders: { ...TABLE_NO_BORDERS, bottom: redLine },
                verticalAlign: VerticalAlign.BOTTOM,
                children: [new Paragraph({ spacing: { before: 40, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [] })],
              }),
            ],
          }),
        ],
      }),
    ]
  }

  return [
    new Paragraph({
      spacing: { before: mmToTwip(HEADER_SEP_GAP_MM), after: 0, line: 20, lineRule: LineRuleType.EXACT },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 15,
          color: RED_COLOR_HEX,
          space: 1,
        },
      },
      children: [],
    }),
  ]
}

function buildSignerRuns(
  namesInRow: string[],
  includeLabel: boolean,
  bodyFont: ReturnType<typeof getBodyFontConfig>,
  kaiFont: ReturnType<typeof makeFont>,
  fontSizeHalfPt: number,
): TextRun[] {
  const runs: TextRun[] = []
  if (includeLabel) {
    runs.push(new TextRun({ text: '签发人：', font: bodyFont, size: fontSizeHalfPt, color: BLACK_COLOR_HEX }))
  }
  namesInRow.forEach((name, idx) => {
    if (idx > 0) {
      runs.push(new TextRun({ text: '\u3000', font: kaiFont, size: fontSizeHalfPt, color: BLACK_COLOR_HEX }))
    }
    runs.push(new TextRun({ text: name, font: kaiFont, size: fontSizeHalfPt, color: BLACK_COLOR_HEX }))
  })
  return runs
}

/** 构建公文版头段落/表格集合（兼容标准公文、信函、命令、纪要四种版式） */
export function buildHeaderElements(config: DocumentConfig): (Paragraph | Table)[] {
  const plan = resolveHeaderRenderPlan(config.header)
  if (!plan.shouldRender) return []

  const { header } = config
  const bodyFont = getBodyFontConfig(config)
  const kaiFont = makeFont('楷体_GB2312', getBodyFontConfig(config).ascii ?? 'Times New Roman')
  const headerFontSize = config.body.fontSize * 2
  const oneCharIndent = ptToTwip(config.body.fontSize)
  const elements: (Paragraph | Table)[] = []

  if (header.format === 'letter') {
    // §10.1 信函格式：标志 -> 4mm 红色双线 -> 14pt 后左份号密级紧急、右发文字号
    elements.push(...buildOrgLogoBlock(config))
    elements.push(...buildRedSeparator('solid', true))

    if (plan.hasTopLeftMeta || header.docNumber.trim()) {
      const leftParagraphs = buildTopLeftSecurityLines(config)
      if (leftParagraphs.length === 0) {
        leftParagraphs.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }))
      }
      const rightParagraphs = header.docNumber.trim()
        ? [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 0, after: 0 },
              children: [new TextRun({ text: header.docNumber.trim(), font: bodyFont, size: headerFontSize, color: BLACK_COLOR_HEX })],
            }),
          ]
        : [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })]

      elements.push(new Paragraph({
        spacing: { before: ptToTwip(14), after: 0, line: 20, lineRule: LineRuleType.EXACT },
        children: [],
      }))

      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                children: leftParagraphs,
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: TABLE_NO_BORDERS,
                children: rightParagraphs,
              }),
            ],
          }),
        ],
      }))
    }

    return elements
  }

  // 标准公文 / 命令 / 纪要：左上角份号、密级、紧急程度
  if (header.format === 'standard' && plan.hasTopLeftMeta) {
    elements.push(...buildTopLeftSecurityLines(config))
  }

  // 发文机关标志
  elements.push(...buildOrgLogoBlock(config))

  if (header.format === 'command') {
    // §10.2 命令（令）：标志下空二行居中令号，无红线
    if (header.docNumber.trim()) {
      elements.push(buildBlankBodyLine(config))
      elements.push(buildBlankBodyLine(config))
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: header.docNumber.trim(), font: bodyFont, size: headerFontSize, color: BLACK_COLOR_HEX })],
      }))
    }
    return elements
  }

  if (header.format === 'minutes') {
    // §10.3 纪要格式：可选期号 + 红色分隔线
    if (header.docNumber.trim()) {
      elements.push(buildBlankBodyLine(config))
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: header.docNumber.trim(), font: bodyFont, size: headerFontSize, color: BLACK_COLOR_HEX })],
      }))
    }
    elements.push(...buildRedSeparator(header.separatorStyle, false))
    return elements
  }

  // §7.2.5 / §7.2.6 标准版式：仅在存在发文字号或签发人时插入空二行并排布
  if (plan.hasMetaRow) {
    elements.push(buildBlankBodyLine(config))
    elements.push(buildBlankBodyLine(config))

    const signerRows = parseSigners(header.signer)
    if (signerRows.length > 0) {
      const tableRows = signerRows.map((namesInRow, rowIdx) => {
        const isLastRow = rowIdx === signerRows.length - 1
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: TABLE_NO_BORDERS,
              children: [new Paragraph({
                alignment: AlignmentType.LEFT,
                indent: { left: oneCharIndent },
                spacing: { before: 0, after: 0 },
                children: isLastRow && header.docNumber.trim()
                  ? [new TextRun({ text: header.docNumber.trim(), font: bodyFont, size: headerFontSize, color: BLACK_COLOR_HEX })]
                  : [],
              })],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: TABLE_NO_BORDERS,
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                indent: { right: oneCharIndent },
                spacing: { before: 0, after: 0 },
                children: buildSignerRuns(namesInRow, rowIdx === 0, bodyFont, kaiFont, headerFontSize),
              })],
            }),
          ],
        })
      })

      elements.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_NO_BORDERS,
        rows: tableRows,
      }))
    } else if (header.docNumber.trim()) {
      elements.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: header.docNumber.trim(),
          font: bodyFont,
          size: headerFontSize,
          color: BLACK_COLOR_HEX,
        })],
      }))
    }
  }

  elements.push(...buildRedSeparator(header.separatorStyle, false))
  return elements
}
