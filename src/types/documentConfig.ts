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

/** 各级标题字体 */
export interface HeadingsConfig {
  h1: { fontFamily: string; fontSize: number }
  h2: { fontFamily: string; fontSize: number }
}

/** 正文格式 */
export interface BodyConfig {
  fontFamily: string
  fontSize: number      // pt
  lineSpacing: number   // 磅 (固定行距)
  firstLineIndent: number // 字符数
}

/** 表格格式 (预留) */
export interface TableConfig {
  fontFamily: string
  fontSize: number      // pt
  lineSpacing: number   // 磅
  boldHeader: boolean
}

/** 特殊选项 */
export interface SpecialOptionsConfig {
  boldFirstSentence: boolean
  showPageNumber: boolean
  pageNumberFont: string
}

/** 高级设置 — 单个元素配置 */
export interface AdvancedElementConfig {
  fontFamily: string      // 中文字体
  asciiFontFamily: string // 英数字体
  fontSize: number        // pt
}

/** 高级设置 */
export interface AdvancedConfig {
  addressee: AdvancedElementConfig
  h1: AdvancedElementConfig
  h2: AdvancedElementConfig
  h3: AdvancedElementConfig
}

/** 完整文档配置 */
export interface DocumentConfig {
  margins: MarginsConfig
  title: TitleConfig
  headings: HeadingsConfig
  body: BodyConfig
  table: TableConfig
  specialOptions: SpecialOptionsConfig
  advanced: AdvancedConfig
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
    lineSpacing: 29,
  },
  headings: {
    h1: { fontFamily: '黑体', fontSize: 16 },
    h2: { fontFamily: '楷体_GB2312', fontSize: 16 },
  },
  body: {
    fontFamily: '仿宋_GB2312',
    fontSize: 16,
    lineSpacing: 29,
    firstLineIndent: 2,
  },
  table: {
    fontFamily: '仿宋_GB2312',
    fontSize: 12,
    lineSpacing: 22,
    boldHeader: true,
  },
  specialOptions: {
    boldFirstSentence: false,
    showPageNumber: true,
    pageNumberFont: '宋体',
  },
  advanced: {
    addressee: { fontFamily: '仿宋_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h1: { fontFamily: '黑体', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h2: { fontFamily: '楷体_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
    h3: { fontFamily: '仿宋_GB2312', asciiFontFamily: 'Times New Roman', fontSize: 16 },
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

export const FONT_SIZE_OPTIONS: { label: string; value: number }[] = [
  { label: '小四 (12pt)', value: 12 },
  { label: '四号 (14pt)', value: 14 },
  { label: '小三 (15pt)', value: 15 },
  { label: '三号 (16pt)', value: 16 },
  { label: '小二 (18pt)', value: 18 },
  { label: '二号 (22pt)', value: 22 },
  { label: '小一 (24pt)', value: 24 },
  { label: '一号 (26pt)', value: 26 },
]

export const LINE_SPACING_OPTIONS: { label: string; value: number }[] = [
  { label: '22磅', value: 22 },
  { label: '24磅', value: 24 },
  { label: '26磅', value: 26 },
  { label: '28磅', value: 28 },
  { label: '29磅', value: 29 },
  { label: '30磅', value: 30 },
  { label: '32磅', value: 32 },
]

export const INDENT_OPTIONS: { label: string; value: number }[] = [
  { label: '无缩进', value: 0 },
  { label: '1字符', value: 1 },
  { label: '2字符', value: 2 },
  { label: '3字符', value: 3 },
]

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
