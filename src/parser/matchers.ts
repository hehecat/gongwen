import { NodeType } from '../types/ast'

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
const ATTACHMENT_RE = /^附件[：:]/

// 成文日期：纯日期行（严格匹配整行）
const DATE_RE = /^\d{4}年\d{1,2}月\d{1,2}日$/

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
