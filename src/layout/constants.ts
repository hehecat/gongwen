/**
 * GB/T 9704—2012 精确版面尺寸与排版常量
 * 统一供预览渲染与 DOCX 导出层消费
 */

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297
export const MM_TO_PT = 72 / 25.4

/** 72dpi 下 A4 固定画布尺寸（1pt = 1px） */
export const A4_CANVAS_WIDTH_PX = Number((A4_WIDTH_MM * MM_TO_PT).toFixed(2))
export const A4_CANVAS_HEIGHT_PX = Number((A4_HEIGHT_MM * MM_TO_PT).toFixed(2))

/** 毫米转 px (72dpi: 1pt = 1px) */
export function mmToPx(mm: number): number {
  return mm * MM_TO_PT
}

/** 厘米转 px (72dpi: 1pt = 1px) */
export function cmToPx(cm: number): number {
  return cm * 10 * MM_TO_PT
}

// ---- GB/T 9704—2012 标准间距与尺寸 ----

/** §5.2.1 版心尺寸 (mm) */
export const STANDARD_MARGIN_TOP_CM = 3.7
export const STANDARD_MARGIN_BOTTOM_CM = 3.5
export const STANDARD_MARGIN_LEFT_CM = 2.8
export const STANDARD_MARGIN_RIGHT_CM = 2.6

/** §7.2.4 发文机关标志上边缘至版心上边缘距离 (mm) */
export const HEADER_ORG_TOP_STANDARD_MM = 35
/** §10.2 命令（令）标志上边缘至版心上边缘距离 (mm) */
export const HEADER_ORG_TOP_COMMAND_MM = 20
/** §10.3 纪要标志上边缘至版心上边缘距离 (mm) */
export const HEADER_ORG_TOP_MINUTES_MM = 35
/** §10.1 信函发文机关标志上边缘至上页边距离 (mm) */
export const LETTER_ORG_TOP_EDGE_MM = 30
/** §10.1 信函底部红色双线距下页边距离 (mm) */
export const LETTER_BOTTOM_LINE_EDGE_MM = 20
/** §10.1 信函红色双线长度 (mm) */
export const LETTER_LINE_LENGTH_MM = 170

/** §7.2.7 / §10.1 版头分隔线距上方要素距离 (mm) */
export const HEADER_SEP_GAP_MM = 4

/** §7.5 页码一字线上距版心下边缘距离 (mm) */
export const PAGE_NUM_GAP_MM = 7

/** §7.4.1 版记分隔线粗细 (mm) */
export const FOOTER_NOTE_THICK_MM = 0.35
export const FOOTER_NOTE_THIN_MM = 0.25

/** §7.4.2 / §7.4.3 / §7.5 版记与页码默认四号字 (pt) */
export const FOOTER_NOTE_FONT_SIZE_PT = 14
export const PAGE_NUMBER_FONT_SIZE_PT = 14

/** §5.2.4 & §6.2 标准文字与红头颜色 (HEX) */
export const RED_COLOR_HEX = 'E00000'
export const BLACK_COLOR_HEX = '000000'

/** A4 页面宽度 (twips) */
export const A4_PAGE_WIDTH_TWIP = 11906
/** A4 页面高度 (twips) */
export const A4_PAGE_HEIGHT_TWIP = 16838
