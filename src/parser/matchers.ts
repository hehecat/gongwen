import { NodeType } from '../types/ast'
import type { AttachmentItem } from '../types/ast'
import type { ParserConfig } from '../types/documentConfig'

/**
 * 正则匹配器：识别各级公文标题及特殊段落
 * 支持全角/半角括号容错
 */

// 一级标题：中文数字 + 顿号，如「一、」「十二、」
export const HEADING_1_RE = /^[一二三四五六七八九十百]+、/

// 二级标题：中文数字 + 括号，如「（一）」「(二)」
const HEADING_2_RE = /^[（(][一二三四五六七八九十百]+[）)]/

// 三级标题（严格数字模式）：1~3位阿拉伯数字 + 点号且点号后非数字（避免 "3.5万元"、"2026.4月" 误判）
const HEADING_3_STRICT_NUMERIC_RE = /^\d{1,3}[.．](?!\d)/
const HEADING_3_LOOSE_NUMERIC_RE = /^\d+[.．]/
const HEADING_3_CHINESE_RE = /^[一二三四五六七八九十百]+[是要]/

// 四级标题：阿拉伯数字 + 括号，如「（1）」「(2)」
const HEADING_4_RE = /^[（(]\d+[）)]/

// 附件说明：以"附件"开头 + 全角/半角冒号
export const ATTACHMENT_RE = /^附件[：:]/

// 附件另面标识（§7.3.7）：仅"附件"或"附件1"/"附件 2"独立短行
export const ATTACHMENT_PAGE_HEADER_RE = /^附件(?:\s*\d+)?$/

// 纪要出席/请假/列席行（§10.3）
export const MINUTES_ATTENDANCE_RE = /^(?:出席|请假|列席)[：:]/

// 附注（§7.3.6）：全角或半角圆括号包裹整行
export const POSTSCRIPT_RE = /^[（(][^）)]+[）)]$/

// 成文日期：纯日期行（严格匹配整行）
const DATE_RE = /^\d{4}年\d{1,2}月\d{1,2}日$/

/**
 * 从单行文本中提取连续的附件项
 * 避免附件名称中出现小数（如 "2.5亿元"）或年份小数时被误截断
 *
 * @param text 文本内容
 * @param startIndex 期望的起始序号
 * @returns 提取的附件项 + 剩余文本
 */
export function extractAttachmentItemsFromLine(
  text: string,
  startIndex: number,
): { items: AttachmentItem[]; remaining: string } {
  const items: AttachmentItem[] = []
  let remaining = text
  let expectedIndex = startIndex

  while (remaining.length > 0) {
    const pattern = new RegExp(`^${expectedIndex}[.．]\\s*`)
    const match = remaining.match(pattern)

    if (!match) {
      break
    }

    remaining = remaining.slice(match[0].length)

    // 仅在出现「数字+点+非数字」时拆分下一项，避免切分 "2.5亿元" / "2026.4月"
    const nextIndexPattern = /(?=\d+[.．](?!\d))/
    const nextMatch = remaining.match(nextIndexPattern)

    let name: string
    if (nextMatch && nextMatch.index !== undefined) {
      name = remaining.slice(0, nextMatch.index).trim()
      remaining = remaining.slice(nextMatch.index)
    } else {
      name = remaining.trim()
      remaining = ''
    }

    items.push({ index: expectedIndex, name })
    expectedIndex++
  }

  return { items, remaining }
}

/**
 * 检测单行文本的节点类型（纯函数）
 * 不含标题判断逻辑，标题由 parser 层根据位置决定
 *
 * 优先级：ATTACHMENT → MINUTES_ATTENDANCE → DATE → HEADING_1~4 → PARAGRAPH
 */
export function detectNodeType(
  line: string,
  parserConfig?: Partial<ParserConfig>,
): NodeType {
  const trimmed = line.trim()
  const recognizeChineseThreeLevel = parserConfig?.recognizeChineseThreeLevel ?? true
  const strictNumericHeading3 = parserConfig?.strictNumericHeading3 ?? true

  if (ATTACHMENT_RE.test(trimmed)) return NodeType.ATTACHMENT
  if (MINUTES_ATTENDANCE_RE.test(trimmed)) return NodeType.MINUTES_ATTENDANCE
  if (DATE_RE.test(trimmed)) return NodeType.DATE
  if (HEADING_1_RE.test(trimmed)) return NodeType.HEADING_1
  if (HEADING_2_RE.test(trimmed)) return NodeType.HEADING_2

  const numericH3Re = strictNumericHeading3
    ? HEADING_3_STRICT_NUMERIC_RE
    : HEADING_3_LOOSE_NUMERIC_RE
  if (numericH3Re.test(trimmed)) return NodeType.HEADING_3
  if (recognizeChineseThreeLevel && HEADING_3_CHINESE_RE.test(trimmed)) {
    return NodeType.HEADING_3
  }

  if (HEADING_4_RE.test(trimmed)) return NodeType.HEADING_4

  return NodeType.PARAGRAPH
}
