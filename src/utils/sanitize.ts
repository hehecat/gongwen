/**
 * 标点净化工具
 *
 * 将常见的半角标点替换为全角标点（中文排版规范），
 * 并清理多余空白（不间断空格、连续空行、行首尾空格）。
 */

/** 半角句号仅在中文字符后替换为全角（避免误伤英文缩写 / 小数） */
const CJK_BEFORE_DOT = /([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])\./g

/** 替换规则：按顺序执行，顺序无关联依赖 */
const PUNCTUATION_MAP: [RegExp, string][] = [
  [/,/g, '\uff0c'],          // , → ，
  [CJK_BEFORE_DOT, '$1\u3002'], // . (中文后) → 。
  [/:/g, '\uff1a'],          // : → ：
  [/;/g, '\uff1b'],          // ; → ；
  [/\(/g, '\uff08'],         // ( → （
  [/\)/g, '\uff09'],         // ) → ）
  [/\?/g, '\uff1f'],         // ? → ？
  [/!/g, '\uff01'],          // ! → ！
]

export interface SanitizeResult {
  text: string
  /** 总替换次数（标点 + 空白清理） */
  count: number
}

export function sanitizeText(text: string): SanitizeResult {
  let result = text
  let count = 0

  // 1. 标点替换
  for (const [pattern, replacement] of PUNCTUATION_MAP) {
    // 重置 lastIndex（正则带 g 标志复用时需要）
    pattern.lastIndex = 0
    result = result.replace(pattern, (...args) => {
      count++
      // 对含捕获组的替换（如 CJK_BEFORE_DOT），手动拼接
      return replacement.includes('$1') ? args[1] + replacement.slice(2) : replacement
    })
  }

  // 2. 不间断空格 → 普通空格
  result = result.replace(/\u00A0/g, () => { count++; return ' ' })

  // 3. 行首尾多余空格 trim（逐行处理）
  const trimmed = result.split('\n').map((line) => {
    const t = line.trim()
    if (t !== line) count++
    return t
  }).join('\n')
  result = trimmed

  // 4. 连续 3+ 空行 → 合并为 1 空行
  result = result.replace(/\n{3,}/g, () => { count++; return '\n\n' })

  return { text: result, count }
}
