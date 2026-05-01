import type { DocumentNode, GongwenAST, AttachmentNode, ParagraphAlignment, RichTextRun } from '../types/ast'
import { NodeType } from '../types/ast'
import { detectNodeType, HEADING_1_RE, ATTACHMENT_RE, extractAttachmentItemsFromLine } from './matchers'

/** 不应被识别为发文机关署名的结尾标点 */
const SIGNATURE_EXCLUDE_ENDINGS = ['。', '：', ':', '；', ';', '！', '!', '？', '?', '，', ',']
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

export interface ParsedLineInput {
  text: string
  lineNumber: number
  runs?: RichTextRun[]
  alignment?: ParagraphAlignment
  noIndent?: boolean
}

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

/** 主送机关通常是标题后的短行，长段落即使以冒号结尾也应视为正文 */
const ADDRESSEE_MAX_LENGTH = 40

function isPossibleAddressee(line: string): boolean {
  if (!(line.endsWith('：') || line.endsWith(':'))) return false
  if (line.length > ADDRESSEE_MAX_LENGTH) return false
  if (HEADING_1_RE.test(line) || ATTACHMENT_RE.test(line)) return false
  return true
}

/** 构造单附件节点（保留原始文本，避免信息丢失） */
function buildSingleAttachmentNode(source: ParsedLineInput, contentAfterColon: string): AttachmentNode {
  return {
    type: NodeType.ATTACHMENT,
    content: source.text,
    lineNumber: source.lineNumber,
    runs: source.runs,
    alignment: source.alignment,
    isMultiple: false,
    items: [{ index: 0, name: contentAfterColon }],
    noIndent: source.noIndent,
  }
}

/**
 * 解析附件说明
 *
 * 单附件模式：附件：xxx（冒号后无数字或数字不是1）
 * 多附件模式：附件：1.xxx 2.xxx ...（冒号后紧跟数字1）
 */
function parseAttachment(
  source: ParsedLineInput,
  lines: ParsedLineInput[],
  currentIndex: number
): { node: AttachmentNode; nextIndex: number } {
  // 1. 提取冒号后的内容
  const colonMatch = source.text.match(/^附件[：:](.*)$/)
  if (!colonMatch) {
    throw new Error('Invalid attachment line')
  }
  const contentAfterColon = colonMatch[1].trim()

  // 2. 判断单附件还是多附件
  const firstItemMatch = contentAfterColon.match(/^(\d+)[.．．.]/)

  if (!firstItemMatch || firstItemMatch[1] !== '1') {
    // 单附件模式：冒号后不是 "1." 开头
    return {
        node: buildSingleAttachmentNode(source, contentAfterColon),
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

    // 当前行存在“部分可识别 + 剩余文本”时，不应吞掉剩余文本
    // 首行异常回退为单附件；后续行异常则不消费该行，交由主循环继续解析
    if (remaining.trim() !== '') {
      if (lastConsumedIndex === currentIndex) {
        return {
          node: buildSingleAttachmentNode(source, contentAfterColon),
          nextIndex: currentIndex + 1,
        }
      }
      return {
        node: {
          type: NodeType.ATTACHMENT,
          content: source.text,
          lineNumber: source.lineNumber,
          runs: source.runs,
          alignment: source.alignment,
          noIndent: source.noIndent,
          isMultiple: true,
          items,
        },
        nextIndex: lastConsumedIndex,
      }
    }

    if (foundItems.length === 0) {
      if (lastConsumedIndex === currentIndex) {
        return {
          node: buildSingleAttachmentNode(source, contentAfterColon),
          nextIndex: currentIndex + 1,
        }
      }
      return {
        node: {
          type: NodeType.ATTACHMENT,
          content: source.text,
          lineNumber: source.lineNumber,
          runs: source.runs,
          alignment: source.alignment,
          noIndent: source.noIndent,
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
      const nextLine = lines[nextLineIndex].text.trim()
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
      content: source.text,
      lineNumber: source.lineNumber,
      runs: source.runs,
      alignment: source.alignment,
      noIndent: source.noIndent,
      isMultiple: true,
      items,
    },
    nextIndex: lastConsumedIndex + 1,
  }
}

/**
 * 将纯文本解析为公文 AST（纯函数）
 *
 * 规则:
 * 1. 跳过空行
 * 2. 第一个非空行视为公文标题（DOCUMENT_TITLE）
 * 3. 后续行通过正则检测类型
 * 4. 解析完成后识别发文机关署名：
 *    - 当 DATE 位于末尾，且 DATE 前一个段落满足“短句 + 机关关键词”时改为 SIGNATURE
 *    - 当文末只有单位署名、没有 DATE 时，若末尾段落满足“短句 + 机关关键词”也改为 SIGNATURE
 */
export function parseGongwen(text: string): GongwenAST {
  const lines = text.split('\n').map((line, index) => ({ text: line, lineNumber: index + 1 }))
  return parseParsedLines(lines)
}

export function parseParsedLines(lines: ParsedLineInput[]): GongwenAST {
  let title: DocumentNode | null = null
  const body: DocumentNode[] = []

  let titleFound = false
  let addresseeChecked = false
  let i = 0

  while (i < lines.length) {
    const source = lines[i]
    const trimmed = source.text.trim()

    // 跳过空行
    if (trimmed.length === 0) {
      i++
      continue
    }

    const lineNumber = source.lineNumber

    // 首个非空行 → 公文标题
    if (!titleFound) {
      title = {
        type: NodeType.DOCUMENT_TITLE,
        content: trimmed,
        lineNumber,
        runs: source.runs,
        alignment: source.alignment,
        noIndent: source.noIndent,
      }
      titleFound = true
      i++
      continue
    }

    // 主送机关检测（标题后第一个非空行 + 冒号结尾 + 短行）
    if (!addresseeChecked) {
      addresseeChecked = true
      if (
        (trimmed.endsWith('：') || trimmed.endsWith(':')) &&
        !HEADING_1_RE.test(trimmed) &&
        !ATTACHMENT_RE.test(trimmed)
      ) {
        body.push({ type: NodeType.ADDRESSEE, content: trimmed, lineNumber, runs: source.runs, alignment: source.alignment, noIndent: source.noIndent })
        i++
        continue
      }
    }

    // 附件说明检测
    if (ATTACHMENT_RE.test(trimmed)) {
      const { node, nextIndex } = parseAttachment(source, lines, i)
      body.push(node)
      i = nextIndex
      continue
    }

    // 正则检测类型
    const type = detectNodeType(trimmed)
    body.push({ type, content: trimmed, lineNumber, runs: source.runs, alignment: source.alignment, noIndent: source.noIndent })
    i++
  }

  // 识别发文机关署名：优先处理“署名 + 日期”场景。
  for (let j = 1; j < body.length; j++) {
    if (body[j].type !== NodeType.DATE || j !== body.length - 1) continue
    if (isPossibleSignature(body[j - 1]) && hasSignatureOrgHint(body[j - 1].content)) {
      body[j - 1] = { ...body[j - 1], type: NodeType.SIGNATURE }
    }
  }

  // 兼容“只有单位、没有日期”的文末署名。
  const lastNode = body[body.length - 1]
  if (isPossibleSignature(lastNode) && hasSignatureOrgHint(lastNode.content)) {
    body[body.length - 1] = { ...lastNode, type: NodeType.SIGNATURE }
  }

  return { title, body }
}
