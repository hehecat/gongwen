/**
 * 公文格式配置类型定义 (对照 GB/T 9704—2012)
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
  asciiFontFamily: string // 英数字体
  fontSize: number        // pt
  lineSpacing: number     // 磅 (固定行距)
  firstLineIndent: number // 字符数
}

/** 页码样式 */
export type PageNumberStyle = 'mirrored' | 'center'

/** 特殊选项 */
export interface SpecialOptionsConfig {
  boldFirstSentence: boolean
  boldHeading2: boolean
  boldHeading3: boolean
  showPageNumber: boolean
  pageNumberFont: string
  pageNumberStyle: PageNumberStyle
  /**
   * 是否加盖印章
   * - true: 成文日期右空四字 (GB/T 9704 §7.3.5.1)
   * - false: 成文日期右空二字 (GB/T 9704 §7.3.5.2)
   */
  hasStamp: boolean
  /** 签发人签名章职务（GB/T 9704 §7.3.5.3 / §10.2，留空则不显示签名章） */
  signerTitle: string
  /** 签发人签名章姓名 */
  signerStampName: string
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

/** 公文版式（对应 GB/T 9704 §7 与 §10） */
export type DocumentFormat = 'standard' | 'letter' | 'command' | 'minutes'

/** 发文机关标志对齐方式 */
export type HeaderOrgAlign = 'center' | 'distribute'

/** 版头红色分隔线样式 */
export type HeaderSeparatorStyle = 'solid' | 'star' | 'none'

/** 版头配置 */
export interface HeaderConfig {
  enabled: boolean
  /** 公文版式：标准公文 / 信函 / 命令（令）/ 纪要 */
  format: DocumentFormat
  /** 份号（§7.2.1 如 "000001"） */
  copyNumber: string
  /** 密级和保密期限（§7.2.2 如 "秘密★1年"） */
  secretLevel: string
  /** 紧急程度（§7.2.3 如 "特急" / "加急"） */
  urgency: string
  /** 发文机关标志（红色大字居中，多行可用换行符表示联合行文） */
  orgName: string
  /** 联合行文右侧居中缀字（§7.2.4 如 "文件"，留空不单独拆列） */
  orgNameSuffix: string
  /** 发文机关标志字体 */
  orgNameFontFamily: string
  /** 发文机关标志字号 (pt) */
  orgNameFontSize: number
  /** 发文机关标志对齐：居中 / 分散对齐 */
  orgNameAlign: HeaderOrgAlign
  /** 发文机关标志附加字距 (pt) */
  orgNameLetterSpacing: number
  /** 发文字号，如 "国办发〔2024〕1号" */
  docNumber: string
  /** 签发人（上行文使用，支持逗号/顿号/空格分隔多人，为空则不显示） */
  signer: string
  /** 分隔线样式：单红线 / 红星红线 / 无分隔线 */
  separatorStyle: HeaderSeparatorStyle
  /** 自定义红头图片 Data URL（PNG/JPG，非空时替代文字标志） */
  customImageDataUrl: string
  /** 自定义红头图片高度 (mm) */
  customImageHeightMm: number
}

/** 版记配置 */
export interface FooterNoteConfig {
  enabled: boolean
  /** 移至版记的主送机关（§7.4.2，置于抄送机关之上） */
  mainRecipient: string
  /** 抄送机关 */
  cc: string
  /** 印发机关 */
  printer: string
  /** 印发日期，如 "2024年1月1日" */
  printDate: string
}

/** 标点净化配置 */
export interface SanitizeConfig {
  enabled: boolean
  convertPunctuation: boolean
  convertQuotes: boolean
  cleanWhitespace: boolean
  normalizeDocNumberBrackets: boolean
}

/** 解析器配置 */
export interface ParserConfig {
  /** 是否将行首「一是/二要」识别为三级标题 */
  recognizeChineseThreeLevel: boolean
  /** 严格数字三级标题：避免 "3.5万元"、"2026.4月" 误判为三级标题 */
  strictNumericHeading3: boolean
}

/** 完整文档配置 */
export interface DocumentConfig {
  margins: MarginsConfig
  title: TitleConfig
  body: BodyConfig
  specialOptions: SpecialOptionsConfig
  advanced: AdvancedConfig
  header: HeaderConfig
  footerNote: FooterNoteConfig
  sanitize: SanitizeConfig
  parser: ParserConfig
}

/** 深层 Partial 类型，用于 patch 更新 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// ---- 默认值 (GB/T 9704—2012 国标) ----

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
    lineSpacing: 28.9,
  },
  body: {
    fontFamily: '仿宋_GB2312',
    asciiFontFamily: 'Times New Roman',
    fontSize: 16,
    lineSpacing: 28.9,
    firstLineIndent: 2,
  },
  specialOptions: {
    boldFirstSentence: false,
    boldHeading2: false,
    boldHeading3: true,
    showPageNumber: true,
    pageNumberFont: '宋体',
    pageNumberStyle: 'mirrored',
    hasStamp: false,
    signerTitle: '',
    signerStampName: '',
  },
  advanced: {
    h1: { fontFamily: '黑体', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h2: { fontFamily: '楷体_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h3: { fontFamily: '仿宋_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
  },
  header: {
    enabled: false,
    format: 'standard',
    copyNumber: '',
    secretLevel: '',
    urgency: '',
    orgName: '',
    orgNameSuffix: '',
    orgNameFontFamily: '方正小标宋_GBK',
    orgNameFontSize: 30,
    orgNameAlign: 'center',
    orgNameLetterSpacing: 0,
    docNumber: '',
    signer: '',
    separatorStyle: 'solid',
    customImageDataUrl: '',
    customImageHeightMm: 38,
  },
  footerNote: {
    enabled: false,
    mainRecipient: '',
    cc: '',
    printer: '',
    printDate: '',
  },
  sanitize: {
    enabled: true,
    convertPunctuation: true,
    convertQuotes: true,
    cleanWhitespace: true,
    normalizeDocNumberBrackets: true,
  },
  parser: {
    recognizeChineseThreeLevel: true,
    strictNumericHeading3: true,
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
  { label: '28.9（国标22行）', value: 28.9 },
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

export const PAGE_NUMBER_STYLE_OPTIONS: { label: string; value: PageNumberStyle }[] = [
  { label: '单右双左（国标）', value: 'mirrored' },
  { label: '全居中', value: 'center' },
]

export const DOCUMENT_FORMAT_OPTIONS: { label: string; value: DocumentFormat; description: string }[] = [
  { label: '标准红头公文', value: 'standard', description: 'GB/T 9704 §7 通用版式' },
  { label: '信函格式', value: 'letter', description: 'GB/T 9704 §10.1 上下双红线' },
  { label: '命令（令）', value: 'command', description: 'GB/T 9704 §10.2 令号与签名章' },
  { label: '会议纪要', value: 'minutes', description: 'GB/T 9704 §10.3 纪要标志与出席' },
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

/** 毫米 → twip (1mm = 56.7 twip) */
export function mmToTwip(mm: number): number {
  return Math.round(mm * 56.7)
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
