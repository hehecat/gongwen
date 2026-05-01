/**
 * 公文格式配置类型定义
 * 包含所有可自定义的排版参数、默认值、选项常量和单位转换工具函数
 */

// ---- 配置接口 ----

/** 页面边距 (cm) */
export interface MarginsConfig {
  top: number
  bottom: number
  left: number
  right: number
}

/** 标题格式 */
export interface TitleConfig {
  fontFamily: string
  fontSize: number    // pt
  lineSpacing: number // 磅 (固定行距)
}

/** 正文格式 */
export interface BodyConfig {
  fontFamily: string
  fontSize: number      // pt
  lineSpacing: number   // 磅 (固定行距)
  firstLineIndent: number // 字符数
}


/** 特殊选项 */
export type PageNumberStyle = 'mirrored' | 'center'

export interface SpecialOptionsConfig {
  boldFirstSentence: boolean
  firstParagraphNoIndent: boolean
  showPageNumber: boolean
  pageNumberFont: string
  pageNumberLayout: 'center' | 'mirrored'
  /**
   * 是否加盖印章
   * - true: 成文日期右空四字 (GB/T 9704 7.3.5.1 加盖印章的公文)
   * - false: 成文日期右空二字 (GB/T 9704 7.3.5.2 不加盖印章的公文)
   */
  hasStamp: boolean
}

/** 文本修复选项 */
export interface TextFixOptionsConfig {
  convertEnglishPunctuation: boolean
  removeRedundantSpaces: boolean
}

/** 高级设置 — 单个元素配置 */
export interface AdvancedElementConfig {
  fontFamily: string      // 中文字体
  asciiFontFamily: string // 英数字体
  fontSize: number        // pt
}

/** 高级设置 */
export interface AdvancedConfig {
  h1: AdvancedElementConfig
  h2: AdvancedElementConfig
  h3: AdvancedElementConfig
}

/** 版头配置 */
export interface HeaderConfig {
  enabled: boolean
  mode: 'formal' | 'note'
  /** 发文机关标志（红色大字居中） */
  orgName: string
  /** 发文字号，如"国办发〔2024〕1号" */
  docNumber: string
  /** 签发人（上行文使用，为空则不显示） */
  signer: string
}

/** 版记配置 */
export interface FooterNoteConfig {
  enabled: boolean
  /** 抄送机关 */
  cc: string
  /** 印发机关 */
  printer: string
  /** 印发日期，如"2024年1月1日" */
  printDate: string
}

/** 完整文档配置 */
export interface DocumentConfig {
  margins: MarginsConfig
  title: TitleConfig
  body: BodyConfig
  specialOptions: SpecialOptionsConfig
  textFixOptions: TextFixOptionsConfig
  advanced: AdvancedConfig
  header: HeaderConfig
  footerNote: FooterNoteConfig
}

/** 深层 Partial 类型，用于 patch 更新 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// ---- 默认值 (GB/T 9704 国标) ----

export const DEFAULT_CONFIG: DocumentConfig = {
  margins: {
    top: 3.7,
    bottom: 3.5,
    left: 2.8,
    right: 2.6,
  },
  title: {
    fontFamily: '方正小标宋_GBK',
    fontSize: 22,
    lineSpacing: 29.6,
  },
  body: {
    fontFamily: '仿宋_GB2312',
    fontSize: 16,
    lineSpacing: 29.6,
    firstLineIndent: 2,
  },
  specialOptions: {
    boldFirstSentence: false,
    firstParagraphNoIndent: false,
    showPageNumber: true,
    pageNumberFont: '宋体',
    pageNumberLayout: 'mirrored',
    hasStamp: false,
  },
  textFixOptions: {
    convertEnglishPunctuation: true,
    removeRedundantSpaces: true,
  },
  advanced: {
    h1: { fontFamily: '黑体', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h2: { fontFamily: '楷体_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h3: { fontFamily: '仿宋_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
  },
  header: {
    enabled: false,
    mode: 'formal',
    orgName: '',
    docNumber: '',
    signer: '',
  },
  footerNote: {
    enabled: false,
    cc: '',
    printer: '',
    printDate: '',
  },
}

// ---- 下拉选项常量 ----

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: '方正小标宋_GBK', value: '方正小标宋_GBK' },
  { label: '方正小标宋简体', value: '方正小标宋简体' },
  { label: '仿宋_GB2312', value: '仿宋_GB2312' },
  { label: '仿宋', value: '仿宋' },
  { label: '黑体', value: '黑体' },
  { label: '楷体_GB2312', value: '楷体_GB2312' },
  { label: '楷体', value: '楷体' },
  { label: '宋体', value: '宋体' },
  { label: '华文中宋', value: '华文中宋' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Arial', value: 'Arial' },
]

export const ASCII_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Calibri', value: 'Calibri' },
  { label: '（跟随中文字体）', value: '' },
]

const FONT_SIZE_PRESET_LABELS = new Map<number, string>([
  [42, '初号'],
  [36, '小初'],
  [26, '一号'],
  [24, '小一'],
  [22, '二号'],
  [18, '小二'],
  [16, '三号'],
  [15, '小三'],
  [14, '四号'],
  [12, '小四'],
  [10.5, '五号'],
  [9, '小五'],
])

export function formatFontSizeLabel(value: number): string {
  const presetName = FONT_SIZE_PRESET_LABELS.get(value)
  return presetName ? `${value}（${presetName}）` : String(value)
}

export const FONT_SIZE_OPTIONS: { label: string; value: number }[] = [
  42,
  36,
  26,
  24,
  22,
  18,
  16,
  15,
  14,
  12,
  10.5,
  9,
].map((value) => ({
  label: formatFontSizeLabel(value),
  value,
}))

export const LINE_SPACING_OPTIONS: { label: string; value: number }[] = [
  { label: '22', value: 22 },
  { label: '24', value: 24 },
  { label: '26', value: 26 },
  { label: '28', value: 28 },
  { label: '29', value: 29 },
  { label: '29.6', value: 29.6 },
  { label: '30', value: 30 },
  { label: '32', value: 32 },
]

export const INDENT_OPTIONS: { label: string; value: number }[] = [
  { label: '无缩进', value: 0 },
  { label: '1字符', value: 1 },
  { label: '2字符', value: 2 },
  { label: '3字符', value: 3 },
]

export const PAGE_NUMBER_LAYOUT_OPTIONS: { label: string; value: 'center' | 'mirrored' }[] = [
  { label: '居中', value: 'center' },
  { label: '双面打印两侧', value: 'mirrored' },
]

export const HEADER_MODE_OPTIONS: { label: string; value: 'formal' | 'note' }[] = [
  { label: '正式文', value: 'formal' },
  { label: '便签', value: 'note' },
]

// ---- 版式常量 (GB/T 9704) ----

/** 每行字数 */
export const CHARS_PER_LINE = 28

/** 每页行数 */
export const LINES_PER_PAGE = 22

/** A4 预览宽度：210mm @ 72dpi */
export const A4_PREVIEW_WIDTH_PX = 595.28

// ---- 单位转换工具函数 ----

/** 厘米 → twip (1cm = 567 twip) */
export function cmToTwip(cm: number): number {
  return Math.round(cm * 567)
}

/** 磅 → half-point (1pt = 2 half-point) */
export function ptToHalfPoint(pt: number): number {
  return pt * 2
}

/** 磅 → twip (1pt = 20 twip) */
export function ptToTwip(pt: number): number {
  return pt * 20
}

/** 厘米 → 占 A4 页面百分比 (宽 210mm, 高 297mm) */
export function cmToPagePercent(cm: number, axis: 'x' | 'y'): number {
  const totalMm = axis === 'x' ? 210 : 297
  return (cm * 10) / totalMm * 100
}
