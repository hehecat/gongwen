import { NodeType } from '../types/ast'
import type { AttachmentItem, TableCell } from '../types/ast'

/**
 * 正则匹配器：识别各级公文标题及特殊段落
 * 支持全角/半角括号容错
 */

// 一级标题：中文数字 + 顿号，如「一、」「十二、」
export const HEADING_1_RE = /^[一二三四五六七八九十]+、/

// 二级标题：中文数字 + 括号，如「（一）」「(二)」
const HEADING_2_RE = /^[（(][一二三四五六七八九十]+[）)]/

// 三级标题：阿拉伯数字 + 点号，如「1.」「12．」
const HEADING_3_RE = /^\d+[.．]/

// 四级标题：阿拉伯数字 + 括号，如「（1）」「(2)」
const HEADING_4_RE = /^[（(]\d+[）)]/

// 附件说明：以"附件"开头 + 全角/半角冒号
export const ATTACHMENT_RE = /^附件[：:]/

// 成文日期：纯日期行（严格匹配整行）
const DATE_RE = /^\d{4}年\d{1,2}月\d{1,2}日$/

// 表格行：以 | 开头和结尾
const TABLE_ROW_RE = /^\|.*\|$/

// 表格分隔行：|---|---| 或 |:---:|:---:| 格式
// 支持中文冒号和英文冒号，支持左对齐(:---)、右对齐(---:)、居中对齐(:---:)
// 每个单元格只包含连字符、冒号（中英文）和空格
const TABLE_SEPARATOR_RE = /^\|(?:\s*[：:]?-+[：:]?\s*\|)+\s*$/

/**
 * 检测是否为表格分隔行（如 |---|---| 或 |:---:|:---:|）
 * @param line 文本行
 * @returns 是否为表格分隔行
 */
export function isTableSeparator(line: string): boolean {
  const trimmed = line.trim()
  // 必须以 | 开头和结尾，且每个单元格只包含连字符、冒号（中英文）和空格
  return TABLE_SEPARATOR_RE.test(trimmed)
}

/**
 * 检测是否为表格行（以 | 开头和结尾）
 * @param line 文本行
 * @returns 是否为表格行
 */
export function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  return TABLE_ROW_RE.test(trimmed) && !isTableSeparator(trimmed)
}

/**
 * 解析表格行为单元格数组
 * @param line 表格行文本
 * @returns 单元格数组
 */
export function parseTableRow(line: string): TableCell[] {
  const trimmed = line.trim()
  // 移除首尾的 |
  const content = trimmed.slice(1, -1)
  // 按 | 分割
  const cells = content.split('|')
  return cells.map((cell) => ({ content: cell.trim() }))
}

/**
 * 计算表格列数
 * @param line 表格行文本
 * @returns 列数
 */
export function getTableColumnCount(line: string): number {
  return parseTableRow(line).length
}

/**
 * 从单行文本中提取连续的附件项
 *
 * @param text 文本内容
 * @param startIndex 期望的起始序号
 * @returns 提取的附件项 + 剩余文本
 */
export function extractAttachmentItemsFromLine(
  text: string,
  startIndex: number
): { items: AttachmentItem[]; remaining: string } {
  const items: AttachmentItem[] = []
  let remaining = text
  let expectedIndex = startIndex

  while (remaining.length > 0) {
    // 尝试匹配期望序号的附件项
    const pattern = new RegExp(`^${expectedIndex}[.．．.]\\s*`)
    const match = remaining.match(pattern)

    if (!match) {
      break
    }

    // 移除序号和点号
    remaining = remaining.slice(match[0].length)

    // 查找下一个序号的位置，或到文本末尾
    const nextIndexPattern = /(?=\d+[.．．.])/
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
 * 优先级：ATTACHMENT → DATE → HEADING_1~4 → PARAGRAPH
 * 附件必须在标题之前匹配，避免"附件：1.xxx"误命中 HEADING_3
 */
export function detectNodeType(line: string): NodeType {
  const trimmed = line.trim()

  if (ATTACHMENT_RE.test(trimmed)) return NodeType.ATTACHMENT
  if (DATE_RE.test(trimmed)) return NodeType.DATE
  if (HEADING_1_RE.test(trimmed)) return NodeType.HEADING_1
  if (HEADING_2_RE.test(trimmed)) return NodeType.HEADING_2
  if (HEADING_3_RE.test(trimmed)) return NodeType.HEADING_3
  if (HEADING_4_RE.test(trimmed)) return NodeType.HEADING_4

  return NodeType.PARAGRAPH
}
