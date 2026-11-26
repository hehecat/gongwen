import {
  CHARS_PER_LINE,
  cmToTwip,
  type DocumentConfig,
  type HeaderConfig,
} from '../types/documentConfig'
import { A4_PAGE_WIDTH_TWIP } from './constants'

export interface SentenceSplit {
  lead: string
  rest: string | null
}

export interface SignatureLayoutResult {
  /** 署名前空行数（加盖印章为空二行，不加盖为空一行） */
  emptyLinesBefore: number
  /** 发文机关署名右缩进字符数 (em) */
  signatureRightIndentEm: number
  /** 成文日期右缩进字符数 (em) */
  dateRightIndentEm: number
}

export interface HeaderRenderPlan {
  shouldRender: boolean
  hasTopLeftMeta: boolean
  hasMetaRow: boolean
  hideFirstPageNumber: boolean
  isLetterFooterNote: boolean
}

/** 补全中文句末标点（用于版记抄送/主送机关末位句号） */
export function ensureChinesePeriod(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`
}

/** 拆分首句（到第一个中文句号「。」为止） */
export function splitFirstSentence(content: string): SentenceSplit {
  const idx = content.indexOf('。')
  if (idx === -1 || idx === content.length - 1) {
    return { lead: content, rest: null }
  }
  return {
    lead: content.slice(0, idx + 1),
    rest: content.slice(idx + 1),
  }
}

/** 拆分纪要出席/请假/列席行：「出席：xxx」 */
export function splitMinutesAttendance(content: string): { label: string; names: string } | null {
  const match = content.match(/^((?:出席|请假|列席)[：:])\s*(.*)$/)
  if (!match) return null
  return {
    label: match[1].replace(':', '：'),
    names: match[2].trim(),
  }
}

/** 估算文本宽度（以汉字宽度 = 1 em 为基准） */
export function calculateTextWidthEm(text: string): number {
  let width = 0
  for (const char of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(char)) {
      width += 1
    } else {
      width += 0.69
    }
  }
  return width
}

/** 计算正文字符间距（twips），确保每行恰好容纳 28 字 */
export function calculateCharSpacingTwips(config: DocumentConfig): number {
  const availableTwips = A4_PAGE_WIDTH_TWIP - cmToTwip(config.margins.left) - cmToTwip(config.margins.right)
  const charGapCount = Math.max(1, CHARS_PER_LINE - 1)
  return Math.floor(
    (availableTwips - config.body.fontSize * 20 * CHARS_PER_LINE) / charGapCount,
  )
}

/** 计算单个汉字加字符间距后的有效宽度（twips） */
export function calculateCharWidthTwips(config: DocumentConfig): number {
  return config.body.fontSize * 20 + calculateCharSpacingTwips(config)
}

/**
 * 计算发文机关署名与成文日期布局（对照 GB/T 9704 §7.3.5.1 & §7.3.5.2）
 *
 * - §7.3.5.1 加盖印章：空二行；日期右空四字；署名以成文日期为准居中
 * - §7.3.5.2 不加盖印章：空一行；署名右空二字，日期首字比署名首字右移二字；
 *   若成文日期长于署名，则日期右空二字并相应增加署名右空字数
 */
export function calculateSignatureLayout(
  signatureContent: string | null,
  dateContent: string | null,
  hasStamp: boolean,
): SignatureLayoutResult {
  const emptyLinesBefore = hasStamp ? 2 : 1

  if (hasStamp) {
    const dateRightIndentEm = 4
    if (signatureContent && dateContent) {
      const signatureWidth = calculateTextWidthEm(signatureContent)
      const dateWidth = calculateTextWidthEm(dateContent)
      const centerOffset = (dateWidth - signatureWidth) / 2
      return {
        emptyLinesBefore,
        signatureRightIndentEm: Math.max(0, dateRightIndentEm + centerOffset),
        dateRightIndentEm,
      }
    }
    return {
      emptyLinesBefore,
      signatureRightIndentEm: 4,
      dateRightIndentEm,
    }
  }

  // 不加盖印章 (§7.3.5.2)
  if (signatureContent && dateContent) {
    const signatureWidth = calculateTextWidthEm(signatureContent)
    const dateWidth = calculateTextWidthEm(dateContent)

    if (signatureWidth >= dateWidth) {
      // 署名右空 2 字，日期首字比署名首字右移 2 字
      const signatureRightIndentEm = 2
      const dateRightIndentEm = Math.max(0, signatureWidth - dateWidth)
      return {
        emptyLinesBefore,
        signatureRightIndentEm,
        dateRightIndentEm,
      }
    }

    // 日期长于署名：日期右空 2 字，署名首字比日期首字左移 2 字
    const dateRightIndentEm = 2
    const signatureRightIndentEm = Math.max(2, 2 + dateWidth - signatureWidth + 2)
    return {
      emptyLinesBefore,
      signatureRightIndentEm,
      dateRightIndentEm,
    }
  }

  return {
    emptyLinesBefore,
    signatureRightIndentEm: 2,
    dateRightIndentEm: 2,
  }
}

/**
 * 解析签发人姓名（支持逗号、顿号、分号、空格、换行分隔），
 * 按 GB/T 9704 §7.2.6 每行最多两个姓名分组。
 */
export function parseSigners(signerText: string): string[][] {
  const names = signerText
    .split(/[，,、；;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (names.length === 0) return []

  const rows: string[][] = []
  for (let i = 0; i < names.length; i += 2) {
    rows.push(names.slice(i, i + 2))
  }
  return rows
}

/** 将发文字号中的常见括号规范为六角括号〔〕，去掉顺序号前「第」字与前导零 */
export function normalizeDocNumberText(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  let result = trimmed
    .replace(/[\u005b【（(](\d{4})[\u005d】）)]/g, '〔$1〕')
    .replace(/(〔\d{4}〕)\s*第\s*0*(\d+)\s*号/g, '$1$2号')
    .replace(/(〔\d{4}〕)\s*0+(\d+)\s*号/g, '$1$2号')

  result = result.replace(/\s+/g, '')
  return result
}

/** 统一版头与信函衍生规则判定 */
export function resolveHeaderRenderPlan(header: HeaderConfig): HeaderRenderPlan {
  const hasOrgVisual = Boolean(header.orgName.trim() || header.customImageDataUrl.trim())
  const shouldRender = header.enabled && hasOrgVisual
  const hasTopLeftMeta = Boolean(
    header.copyNumber.trim() || header.secretLevel.trim() || header.urgency.trim(),
  )
  const hasMetaRow = Boolean(header.docNumber.trim() || header.signer.trim())
  const isLetter = header.enabled && header.format === 'letter'

  return {
    shouldRender,
    hasTopLeftMeta,
    hasMetaRow,
    hideFirstPageNumber: isLetter,
    isLetterFooterNote: isLetter,
  }
}

/** 清洗导出文件名，避免 Windows/macOS 非法路径字符 */
export function sanitizeExportFileName(rawTitle: string): string {
  const cleaned = rawTitle
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('')
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code >= 0 && code <= 31) return '-'
      return /[<>:"/\\|?*]/.test(char) ? '-' : char
    })
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^-+|-+$/g, '')
    .trim()

  const fallback = cleaned || '公文'
  return fallback.length > 100 ? fallback.slice(0, 100) : fallback
}
