/**
 * 标点净化工具
 *
 * 将常见的半角标点替换为全角标点（中文排版规范），
 * 并清理多余空白（不间断空格、连续空行、行首尾空格）。
 * 同时清理 Markdown 语法标记。
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

/**
 * 清理 Markdown 语法标记
 * 识别配对的标记并删除，保留文本内容
 * @param text - 原始文本
 * @returns 清理后的文本和替换次数
 */
function stripMarkdown(text: string): { text: string; count: number } {
  let result = text
  let count = 0

  // 1. 清理代码块（```...```）- 必须先处理，避免内部内容被其他规则影响
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    count++
    // 提取代码块内容（去掉 ``` 标记）
    const content = match.slice(3, -3)
    // 如果第一行是语言标识，去掉它
    const lines = content.split('\n')
    if (lines[0] && lines[0].trim().match(/^[a-zA-Z0-9+-]*$/)) {
      return lines.slice(1).join('\n')
    }
    return content
  })

  // 2. 清理行内代码（`code`）
  result = result.replace(/`([^`]+)`/g, (_match, content) => {
    count++
    return content
  })

  // 3. 清理图片（![alt](url)）- 保留 alt 文本
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt) => {
    count++
    return alt
  })

  // 4. 清理链接（[text](url)）- 保留文本
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, (_match, linkText) => {
    count++
    return linkText
  })

  // 5. 清理删除线（~~text~~）
  result = result.replace(/~~([^~]+)~~/g, (_match, content) => {
    count++
    return content
  })

  // 6. 清理加粗（**text** 或 __text__）
  result = result.replace(/\*\*([^*]+)\*\*/g, (_match, content) => {
    count++
    return content
  })
  result = result.replace(/__([^_]+)__/g, (_match, content) => {
    count++
    return content
  })

  // 7. 清理斜体（*text* 或 _text_）
  // 注意：先处理加粗，再处理斜体，避免重复匹配
  // 使用 [^*] 确保中间不含 *，避免匹配到加粗的情况
  result = result.replace(/\*([^*\n]+)\*/g, (_match, content) => {
    count++
    return content
  })
  result = result.replace(/_([^_\n]+)_/g, (_match, content) => {
    count++
    return content
  })

  // 8. 清理标题标记（# ## ### 等）- 行首的 # 符号
  result = result.replace(/^(#{1,6})\s+/gm, (_match, _hashes) => {
    count++
    return ''
  })

  // 9. 清理引用标记（> ）- 行首的 > 符号
  result = result.replace(/^(>)\s*/gm, (_match) => {
    count++
    return ''
  })

  // 10. 清理无序列表标记（- * + 开头）
  result = result.replace(/^(\s*)[-*+]\s+/gm, (_match, indent) => {
    count++
    return indent
  })

  // 11. 清理有序列表标记（1. 2. 等）
  result = result.replace(/^(\s*)\d+\.\s+/gm, (_match, indent) => {
    count++
    return indent
  })

  // 12. 清理水平线（--- *** ___）
  result = result.replace(/^(---|\*\*\*|___)$/gm, () => {
    count++
    return ''
  })

  return { text: result, count }
}

export interface SanitizeResult {
  text: string
  /** 总替换次数（标点 + 空白清理） */
  count: number
}

export function sanitizeText(text: string): SanitizeResult {
  let result = text
  let count = 0

  // 0. 清理 Markdown 语法标记（最先执行，避免 Markdown 标记中的标点被误处理）
  const markdownResult = stripMarkdown(result)
  result = markdownResult.text
  count += markdownResult.count

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
