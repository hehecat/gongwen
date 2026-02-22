/**
 * GB/T 9704 公文排版标准常量
 * 所有尺寸单位: twip (1/20 pt, 1/1440 inch)
 * 字号单位: half-point (docx 标准)
 */

// ---- 页面尺寸 (A4) ----
export const PAGE_WIDTH = 11906 // 210mm
export const PAGE_HEIGHT = 16838 // 297mm

// ---- 页边距 ----
export const MARGIN_TOP = 2098 // 37mm
export const MARGIN_BOTTOM = 1984 // 35mm
export const MARGIN_LEFT = 1588 // 28mm
export const MARGIN_RIGHT = 1474 // 26mm

// ---- 行距 ----
export const LINE_SPACING_VALUE = 580 // 固定 29pt (29 * 20 = 580 twip)

// ---- 字体 (使用 GBK/GB2312 版本，兼容政府机关系统) ----
export const FONT_FANG_SONG = '仿宋_GB2312' // 正文、三级/四级标题
export const FONT_HEI_TI = '黑体' // 一级标题
export const FONT_KAI_TI = '楷体_GB2312' // 二级标题
export const FONT_XIAO_BIAO_SONG = '方正小标宋_GBK' // 公文标题

// ---- 字号 (half-point) ----
export const TITLE_FONT_SIZE = 44 // 22pt - 公文标题 (小标宋)
export const BODY_FONT_SIZE = 32 // 16pt - 正文及各级标题 (三号字)

// ---- 缩进 ----
// 首行缩进 2 字符: 2 × 16pt(三号字) = 32pt
// styleFactory 中直接使用 "32pt" 字符串度量
