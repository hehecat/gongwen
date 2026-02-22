import type { DocumentNode, GongwenAST } from '../types/ast'
import { NodeType } from '../types/ast'
import { detectNodeType, HEADING_1_RE } from './matchers'

/**
 * 将纯文本解析为公文 AST（纯函数）
 *
 * 规则:
 * 1. 跳过空行
 * 2. 第一个非空行视为公文标题（DOCUMENT_TITLE）
 * 3. 后续行通过正则检测类型
 */
export function parseGongwen(text: string): GongwenAST {
  const lines = text.split('\n')
  let title: DocumentNode | null = null
  const body: DocumentNode[] = []

  let titleFound = false
  let addresseeChecked = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    // 跳过空行
    if (trimmed.length === 0) continue

    const lineNumber = i + 1

    // 首个非空行 → 公文标题
    if (!titleFound) {
      title = { type: NodeType.DOCUMENT_TITLE, content: trimmed, lineNumber }
      titleFound = true
      continue
    }

    // 后续行：先检测主送机关（标题后第一个非空行 + 冒号结尾），再做正则检测
    if (!addresseeChecked) {
      addresseeChecked = true
      if (
        (trimmed.endsWith('：') || trimmed.endsWith(':')) &&
        !HEADING_1_RE.test(trimmed)
      ) {
        body.push({ type: NodeType.ADDRESSEE, content: trimmed, lineNumber })
        continue
      }
    }

    // 正则检测类型
    const type = detectNodeType(trimmed)
    body.push({ type, content: trimmed, lineNumber })
  }

  return { title, body }
}
