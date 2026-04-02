/**
 * 文本修复工具
 *
 * 1. 将中文语境下误用的英文标点替换为中文标点。
 * 2. 清理 AI 生成文本中常见的多余空格、制表符和连续空行。
 */

const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const CJK_OR_FULLWIDTH_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/
const DIGIT_OR_CJK_NUMERAL = /[0-9一二三四五六七八九十百千万零]/

const PUNCTUATION_REPLACEMENTS = new Map<string, string>([
  [',', '，'],
  [':', '：'],
  [';', '；'],
  ['?', '？'],
  ['!', '！'],
  ['(', '（'],
  [')', '）'],
])

export interface SanitizeResult {
  text: string
  count: number
}

export interface AutoFixResult extends SanitizeResult {
  punctuationCount: number
  whitespaceCount: number
}

export interface TextFixOptions {
  convertEnglishPunctuation: boolean
  removeRedundantSpaces: boolean
}

const DEFAULT_TEXT_FIX_OPTIONS: TextFixOptions = {
  convertEnglishPunctuation: true,
  removeRedundantSpaces: true,
}

function charAt(text: string, index: number): string {
  return index >= 0 && index < text.length ? text[index] : ''
}

function isCjkChar(char: string): boolean {
  return CJK_CHAR.test(char)
}

function isCjkOrFullwidthChar(char: string): boolean {
  return CJK_OR_FULLWIDTH_CHAR.test(char)
}

function isDigitOrChineseNumeral(char: string): boolean {
  return DIGIT_OR_CJK_NUMERAL.test(char)
}

function replaceWhenNeeded(
  text: string,
  shouldReplace: (index: number, source: string) => boolean,
): SanitizeResult {
  let count = 0
  const chars = Array.from(text)

  for (let index = 0; index < chars.length; index++) {
    const current = chars[index]
    const replacement = PUNCTUATION_REPLACEMENTS.get(current)
    if (!replacement || !shouldReplace(index, text)) continue

    chars[index] = replacement
    count++
  }

  return { text: chars.join(''), count }
}

/**
 * 处理双引号（交替 “ ”）
 */
function replaceQuotes(text: string): SanitizeResult {
  let count = 0
  let open = true
  const chars = Array.from(text)

  for (let i = 0; i < chars.length; i++) {
    if (chars[i] !== '"') continue

    chars[i] = open ? '“' : '”'
    open = !open
    count++
  }

  return { text: chars.join(''), count }
}

export function replaceEnglishPunctuation(text: string): SanitizeResult {
  let result = text
  let count = 0

  // 普通标点
  const common = replaceWhenNeeded(result, (index, source) => {
    const current = charAt(source, index)
    const previous = charAt(source, index - 1)
    const next = charAt(source, index + 1)

    if (current === '(' || current === ')') {
      return (
        isDigitOrChineseNumeral(previous) ||
        isDigitOrChineseNumeral(next) ||
        isCjkChar(previous) ||
        isCjkChar(next)
      )
    }

    return isCjkOrFullwidthChar(previous) || isCjkOrFullwidthChar(next)
  })

  result = common.text
  count += common.count

  // 句号
  result = result.replace(/\./g, (match, offset, source) => {
    const previous = charAt(source, offset - 1)
    const next = charAt(source, offset + 1)
    const shouldConvert = isCjkChar(previous) && !/[0-9A-Za-z]/.test(next)

    if (!shouldConvert) return match

    count++
    return '。'
  })

  // 双引号（最后处理，避免干扰判断）
  const quoteResult = replaceQuotes(result)
  result = quoteResult.text
  count += quoteResult.count

  return { text: result, count }
}

function applyRegexReplacements(
  text: string,
  replacements: Array<[RegExp, string]>,
): SanitizeResult {
  let result = text
  let count = 0

  for (const [pattern, replacement] of replacements) {
    const matches = Array.from(result.matchAll(pattern))
    count += matches.length
    result = result.replace(pattern, replacement)
  }

  return { text: result, count }
}

export function removeRedundantSpaces(text: string): SanitizeResult {
  const normalized = applyRegexReplacements(text, [
    [/\u00a0/g, ' '],
    [/\u3000/g, ' '],
    [/\t+/g, ' '],
    [/([（《【“])[ \t]+/g, '$1'],
    [/[ \t]+([）】》”，。；：！？、])/g, '$1'],
    [/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])[ \t]+([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])/g, '$1$2'],
    [/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])[ \t]+([（《【“])/g, '$1$2'],
    [/([）】》”])[ \t]+([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])/g, '$1$2'],
    [/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])[ \t]+([，。；：！？、])/g, '$1$2'],
    [/([，。；：！？、])[ \t]+([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])/g, '$1$2'],
  ])

  let count = normalized.count
  let result = normalized.text

  result = result
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed !== line) count++
      return trimmed
    })
    .join('\n')

  result = result.replace(/\n{3,}/g, () => {
    count++
    return '\n\n'
  })

  return { text: result, count }
}

export function autoFixDocumentText(
  text: string,
  options: TextFixOptions = DEFAULT_TEXT_FIX_OPTIONS,
): AutoFixResult {
  const punctuation = options.convertEnglishPunctuation
    ? replaceEnglishPunctuation(text)
    : { text, count: 0 }

  const whitespace = options.removeRedundantSpaces
    ? removeRedundantSpaces(punctuation.text)
    : { text: punctuation.text, count: 0 }

  return {
    text: whitespace.text,
    punctuationCount: punctuation.count,
    whitespaceCount: whitespace.count,
    count: punctuation.count + whitespace.count,
  }
}

export function sanitizeText(
  text: string,
  options: TextFixOptions = DEFAULT_TEXT_FIX_OPTIONS,
): SanitizeResult {
  const result = autoFixDocumentText(text, options)
  return { text: result.text, count: result.count }
}
