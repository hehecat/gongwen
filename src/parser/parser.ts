import type { DocumentNode, GongwenAST, AttachmentNode, TableNode } from '../types/ast'
import { NodeType } from '../types/ast'
import { detectNodeType, HEADING_1_RE, ATTACHMENT_RE, extractAttachmentItemsFromLine, isTableRow, isTableSeparator, parseTableRow } from './matchers'

/** 不应被识别为发文机关署名的结尾标点 */
const SIGNATURE_EXCLUDE_ENDINGS = ['。', '：', ':', '；', ';', '！', '!', '？', '?', '，', ',']
/** 标题段落的排除结尾标点（以这些标点结尾的段落不是标题） */
const TITLE_EXCLUDE_ENDINGS = ['。', '，', ',', '；', ';', '：', ':', '！', '!', '？', '?', '、']
/** 机关署名常见关键词（用于降低正文误判） */
const SIGNATURE_ORG_HINTS = [
  '人民政府',
  '政府',
  '委员会',
  '办公厅',
  '办公室',
  '党委',
  '党组',
  '部',
  '厅',
  '局',
  '委',
  '院',
  '会',
  '集团',
  '公司',
  '中央',
]

/**
 * 检查节点是否可能为发文机关署名
 * 条件：类型为 PARAGRAPH，内容长度不超过15字，不以特定标点结尾
 */
function isPossibleSignature(node: DocumentNode | undefined): boolean {
  if (!node || node.type !== NodeType.PARAGRAPH) return false
  const content = node.content.trim()
  if (content.length === 0 || content.length > 15) return false
  return !SIGNATURE_EXCLUDE_ENDINGS.some(ending => content.endsWith(ending))
}

/** 机关名称关键词检查（避免把普通短句识别为署名） */
function hasSignatureOrgHint(text: string): boolean {
  return SIGNATURE_ORG_HINTS.some((hint) => text.includes(hint))
}

/**
 * 检查段落是否可能是标题段落
 * 条件：不以排除标点结尾
 */
function isPossibleTitleParagraph(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0) return false
  return !TITLE_EXCLUDE_ENDINGS.some(ending => trimmed.endsWith(ending))
}

/** 构造单附件节点（保留原始文本，避免信息丢失） */
function buildSingleAttachmentNode(line: string, contentAfterColon: string, currentIndex: number): AttachmentNode {
  return {
    type: NodeType.ATTACHMENT,
    content: line,
    lineNumber: currentIndex + 1,
    isMultiple: false,
    items: [{ index: 0, name: contentAfterColon }],
  }
}

/**
 * 解析附件说明
 *
 * 单附件模式：附件：xxx（冒号后无数字或数字不是1）
 * 多附件模式：附件：1.xxx 2.xxx ...（冒号后紧跟数字1）
 */
function parseAttachment(
  line: string,
  lines: string[],
  currentIndex: number
): { node: AttachmentNode; nextIndex: number } {
  // 1. 提取冒号后的内容
  const colonMatch = line.match(/^附件[：:](.*)$/)
  if (!colonMatch) {
    throw new Error('Invalid attachment line')
  }
  const contentAfterColon = colonMatch[1].trim()

  // 2. 判断单附件还是多附件
  const firstItemMatch = contentAfterColon.match(/^(\d+)[.．．.]/)

  if (!firstItemMatch || firstItemMatch[1] !== '1') {
    // 单附件模式：冒号后不是 "1." 开头
    return {
      node: buildSingleAttachmentNode(line, contentAfterColon, currentIndex),
      nextIndex: currentIndex + 1,
    }
  }

  // 3. 多附件模式：收集所有附件项
  const items: AttachmentNode['items'] = []
  let remainingText = contentAfterColon
  let expectedIndex = 1
  // 记录已消费的最后一行索引（初始为当前行）
  let lastConsumedIndex = currentIndex

  while (true) {
    // 从当前文本中提取连续的附件项
    const { items: foundItems, remaining } = extractAttachmentItemsFromLine(
      remainingText,
      expectedIndex
    )

    // 当前行存在"部分可识别 + 剩余文本"时，不应吞掉剩余文本
    // 首行异常回退为单附件；后续行异常则不消费该行，交由主循环继续解析
    if (remaining.trim() !== '') {
      if (lastConsumedIndex === currentIndex) {
        return {
          node: buildSingleAttachmentNode(line, contentAfterColon, currentIndex),
          nextIndex: currentIndex + 1,
        }
      }
      return {
        node: {
          type: NodeType.ATTACHMENT,
          content: line,
          lineNumber: currentIndex + 1,
          isMultiple: true,
          items,
        },
        nextIndex: lastConsumedIndex,
      }
    }

    if (foundItems.length === 0) {
      if (lastConsumedIndex === currentIndex) {
        return {
          node: buildSingleAttachmentNode(line, contentAfterColon, currentIndex),
          nextIndex: currentIndex + 1,
        }
      }
      return {
        node: {
          type: NodeType.ATTACHMENT,
          content: line,
          lineNumber: currentIndex + 1,
          isMultiple: true,
          items,
        },
        nextIndex: lastConsumedIndex,
      }
    }

    items.push(...foundItems)
    expectedIndex += foundItems.length

    // 当前行的附件项已提取完毕，检查下一行是否有后续附件
    const nextLineIndex = lastConsumedIndex + 1
    if (nextLineIndex < lines.length) {
      const nextLine = lines[nextLineIndex].trim()
      // 跳过空行
      if (nextLine.length === 0) {
        lastConsumedIndex = nextLineIndex
        continue
      }
      // 检查下一行是否以期望的序号开头
      const nextItemMatch = nextLine.match(/^(\d+)[.．．.]/)
      if (nextItemMatch && Number(nextItemMatch[1]) === expectedIndex) {
        remainingText = nextLine
        lastConsumedIndex = nextLineIndex
        continue
      }
    }
    break
  }

  return {
    node: {
      type: NodeType.ATTACHMENT,
      content: line,
      lineNumber: currentIndex + 1,
      isMultiple: true,
      items,
    },
    nextIndex: lastConsumedIndex + 1,
  }
}

/**
 * 解析 Markdown 表格
 *
 * 格式：
 * | 列1 | 列2 | 列3 |
 * |-----|-----|-----|
 * | 数据1 | 数据2 | 数据3 |
 */
function parseTable(
  lines: string[],
  currentIndex: number
): { node: TableNode; nextIndex: number } {
  const startLine = currentIndex
  const headerCells = parseTableRow(lines[currentIndex])
  const columnCount = headerCells.length

  // 跳过分隔行
  let i = currentIndex + 1
  if (i < lines.length && isTableSeparator(lines[i])) {
    i++
  }

  // 收集数据行
  const rows: TableNode['rows'] = []
  while (i < lines.length && isTableRow(lines[i])) {
    rows.push({ cells: parseTableRow(lines[i]) })
    i++
  }

  return {
    node: {
      type: NodeType.TABLE,
      content: lines.slice(startLine, i).join('\n'),
      lineNumber: startLine + 1,
      header: { cells: headerCells },
      rows,
      columnCount,
    },
    nextIndex: i,
  }
}

/**
 * 将纯文本解析为公文 AST（纯函数）
 *
 * 规则:
 * 1. 跳过空行
 * 2. 前 n 段不以标点符号结尾的段落视为公文标题（DOCUMENT_TITLE）
 * 3. 后续行通过正则检测类型
 * 4. 解析完成后识别发文机关署名：
 *    仅当 DATE 位于末尾，且 DATE 前一个段落满足"短句 + 机关关键词"时改为 SIGNATURE
 */
export function parseGongwen(text: string): GongwenAST {
  const lines = text.split('\n')
  const title: DocumentNode[] = []
  const body: DocumentNode[] = []

  let titlePhaseComplete = false
  let addresseeChecked = false
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    // 跳过空行
    if (trimmed.length === 0) {
      i++
      continue
    }

    const lineNumber = i + 1

    // 标题阶段：收集连续的不以标点结尾的段落
    if (!titlePhaseComplete) {
      // 检查是否可能是标题段落
      if (isPossibleTitleParagraph(trimmed)) {
        title.push({ type: NodeType.DOCUMENT_TITLE, content: trimmed, lineNumber })
        i++
        continue
      }
      // 遇到以标点结尾的段落，标题阶段结束
      titlePhaseComplete = true
    }

    // 主送机关检测（标题后第一个非空行 + 冒号结尾，但不是附件说明）
    if (!addresseeChecked) {
      addresseeChecked = true
      if (
        (trimmed.endsWith('：') || trimmed.endsWith(':')) &&
        !HEADING_1_RE.test(trimmed) &&
        !ATTACHMENT_RE.test(trimmed)
      ) {
        body.push({ type: NodeType.ADDRESSEE, content: trimmed, lineNumber })
        i++
        continue
      }
    }

    // 附件说明检测
    if (ATTACHMENT_RE.test(trimmed)) {
      const { node, nextIndex } = parseAttachment(trimmed, lines, i)
      body.push(node)
      i = nextIndex
      continue
    }

    // 表格检测（必须检测连续的表格行）
    if (isTableRow(trimmed)) {
      // 检查下一行是否为分隔行或表格行（确保是完整表格）
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : ''
      if (isTableSeparator(nextLine) || isTableRow(nextLine)) {
        const { node, nextIndex } = parseTable(lines, i)
        body.push(node)
        i = nextIndex
        continue
      }
    }

    // 正则检测类型
    const type = detectNodeType(trimmed)
    body.push({ type, content: trimmed, lineNumber })
    i++
  }

  // 识别发文机关署名：仅处理末尾成文日期，降低误判
  for (let j = 1; j < body.length; j++) {
    if (body[j].type !== NodeType.DATE || j !== body.length - 1) continue
    if (isPossibleSignature(body[j - 1]) && hasSignatureOrgHint(body[j - 1].content)) {
      body[j - 1] = { ...body[j - 1], type: NodeType.SIGNATURE }
    }
  }

  return { title, body }
}
