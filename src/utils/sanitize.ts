import type { SanitizeConfig } from '../types/documentConfig'
import { DEFAULT_CONFIG } from '../types/documentConfig'
import { normalizeDocNumberText } from '../layout/typography'

/** 半角句号仅在中文字符后替换为全角（避免误伤英文缩写 / 小数） */
const CJK_BEFORE_DOT = /([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])\./g

/** 替换规则 */
const PUNCTUATION_MAP: [RegExp, string][] = [
  [/,/g, '\uff0c'],             // , → ，
  [CJK_BEFORE_DOT, '$1\u3002'], // . (中文后) → 。
  [/:/g, '\uff1a'],             // : → ：
  [/;/g, '\uff1b'],             // ; → ；
  [/\(/g, '\uff08'],            // ( → （
  [/\)/g, '\uff09'],            // ) → ）
  [/\?/g, '\uff1f'],            // ? → ？
  [/!/g, '\uff01'],             // ! → ！
]

/** 需要保护不被标点转换误伤的片段：URL、邮箱、时间、千分位数字 */
const PROTECTED_TOKEN_RE =
  /https?:\/\/[^\s\u4e00-\u9fff）)】」”’]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g

/** 跨行引文判定：段落内出现偶数个或至少 2 个双引号时成对闭合；按行独立扫描以防单行漏引号污染全文 */
function convertDoubleQuotes(text: string): { text: string; count: number } {
  let count = 0
  const lines = text.split('\n')

  // 先统计全文双引号总数：若全篇成对（偶数）且存在未闭合单行跨行引文，保持跨行配对；
  // 若全篇为奇数（存在漏打），按行重置避免污染后文。
  const totalQuotes = (text.match(/"/g) ?? []).length
  const useCrossLinePairing = totalQuotes >= 2 && totalQuotes % 2 === 0

  if (useCrossLinePairing) {
    let open = false
    let result = ''
    for (const char of text) {
      if (char === '"') {
        result += open ? '\u201d' : '\u201c'
        open = !open
        count++
      } else {
        result += char
      }
    }
    return { text: result, count }
  }

  const convertedLines = lines.map((line) => {
    if (!line.includes('"')) return line
    let open = false
    let out = ''
    for (const char of line) {
      if (char === '"') {
        out += open ? '\u201d' : '\u201c'
        open = !open
        count++
      } else {
        out += char
      }
    }
    return out
  })

  return { text: convertedLines.join('\n'), count }
}

export interface SanitizeDetails {
  punctuation: number
  quotes: number
  whitespace: number
}

export interface SanitizeResult {
  text: string
  /** 总替换次数（标点 + 引号 + 空白清理） */
  count: number
  details: SanitizeDetails
}

export function sanitizeText(
  text: string,
  options?: Partial<SanitizeConfig>,
): SanitizeResult {
  const cfg: SanitizeConfig = {
    ...DEFAULT_CONFIG.sanitize,
    ...options,
  }

  if (!cfg.enabled || !text) {
    return {
      text,
      count: 0,
      details: { punctuation: 0, quotes: 0, whitespace: 0 },
    }
  }

  let result = text
  let punctuationCount = 0
  let quotesCount = 0
  let whitespaceCount = 0

  // 先提取受保护片段（URL / 邮箱 / 时间 / 千分位数字）
  const placeholders: string[] = []
  result = result.replace(PROTECTED_TOKEN_RE, (match) => {
    const idx = placeholders.length
    placeholders.push(match)
    return `\uE000PROTECTED_${idx}\uE001`
  })

  // 1. 发文字号六角括号规范化（如 国办发[2026]1号 -> 国办发〔2026〕1号）
  if (cfg.normalizeDocNumberBrackets) {
    result = result.replace(
      /([\u4e00-\u9fff]{1,12})[\u005b【（(](\d{4})[\u005d】）)]\s*(?:第\s*)?0*(\d+\s*号)/g,
      (_match, prefix: string, year: string, num: string) => {
        punctuationCount++
        return normalizeDocNumberText(`${prefix}[${year}]${num}`)
      },
    )
  }

  // 2. 标点替换
  if (cfg.convertPunctuation) {
    for (const [pattern, replacement] of PUNCTUATION_MAP) {
      pattern.lastIndex = 0
      result = result.replace(pattern, (...args) => {
        punctuationCount++
        return replacement.includes('$1') ? args[1] + replacement.slice(2) : replacement
      })
    }
  }

  // 3. 半角双引号成对转中文全角引号
  if (cfg.convertQuotes) {
    const quoted = convertDoubleQuotes(result)
    result = quoted.text
    quotesCount += quoted.count
  }

  // 还原受保护片段
  if (placeholders.length > 0) {
    result = result.replace(/\uE000PROTECTED_(\d+)\uE001/g, (_m, idxStr: string) => {
      return placeholders[Number(idxStr)] ?? ''
    })
  }

  // 4. 清理空白（不间断空格、行首尾多余空格、3+连续空行）
  if (cfg.cleanWhitespace) {
    result = result.replace(/\u00A0/g, () => {
      whitespaceCount++
      return ' '
    })

    result = result
      .split('\n')
      .map((line) => {
        const t = line.trim()
        if (t !== line) whitespaceCount++
        return t
      })
      .join('\n')

    result = result.replace(/\n{3,}/g, () => {
      whitespaceCount++
      return '\n\n'
    })
  }

  return {
    text: result,
    count: punctuationCount + quotesCount + whitespaceCount,
    details: {
      punctuation: punctuationCount,
      quotes: quotesCount,
      whitespace: whitespaceCount,
    },
  }
}
