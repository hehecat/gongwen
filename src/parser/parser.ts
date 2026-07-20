import type { DocumentNode, GongwenAST, AttachmentNode } from '../types/ast'
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

/**
 * 检查节点是否可能为发文机关署名
 * 条件：类型为 PARAGRAPH，内容长度不超过22字，不以特定标点结尾
 */
function isPossibleSignature(node: DocumentNode | undefined): boolean {
  if (!node || node.type !== NodeType.PARAGRAPH) return false
  const content = node.content.trim()
  if (content.length === 0 || content.length > 22) return false
  return !SIGNATURE_EXCLUDE_ENDINGS.some(ending => content.endsWith(ending))
}

/**
 * 从 body 末尾去掉连续 ATTACHMENT 节点，返回逻辑文末的结束索引
 * 例如 body=[P, DATE, ATTACHMENT, ATTACHMENT] → 返回 2
 */
function findLogicalBodyEnd(body: DocumentNode[]): number {
  let i = body.length - 1
  while (i >= 0 && body[i].type === NodeType.ATTACHMENT) {
    i--
  }
  return i + 1
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

const PREAMBLE_MAX_LINES = 4
const TITLE_FRAGMENT_MAX_LEN = 40
const TITLE_MERGED_MAX_LEN = 120
const ORG_PREFIX_MAX_LEN = 20
const TITLE_STRONG_ENDINGS = ['。', '；', ';', '！', '!', '？', '?']

function isStructuralPreambleStop(line: string): boolean {
  if (isPossibleAddressee(line)) return true
  const t = detectNodeType(line)
  return t !== NodeType.PARAGRAPH
}

function isOrgPrefixLine(line: string): boolean {
  const text = line.trim()
  if (text.length === 0 || text.length > ORG_PREFIX_MAX_LEN) return false
  if (isPossibleAddressee(text)) return false
  if (detectNodeType(text) !== NodeType.PARAGRAPH) return false
  if (SIGNATURE_EXCLUDE_ENDINGS.some((e) => text.endsWith(e))) return false
  return hasSignatureOrgHint(text)
}

/** 多行拆分时的标题片段（较短） */
function isTitleFragment(line: string): boolean {
  const text = line.trim()
  if (text.length === 0 || text.length > TITLE_FRAGMENT_MAX_LEN) return false
  if (isPossibleAddressee(text)) return false
  if (detectNodeType(text) !== NodeType.PARAGRAPH) return false
  if (TITLE_STRONG_ENDINGS.some((e) => text.endsWith(e))) return false
  return true
}

/** 可作为完整单行标题（允许更长） */
function isStandaloneTitleLine(line: string): boolean {
  const text = line.trim()
  if (text.length === 0 || text.length > TITLE_MERGED_MAX_LEN) return false
  if (isPossibleAddressee(text)) return false
  if (detectNodeType(text) !== NodeType.PARAGRAPH) return false
  if (TITLE_STRONG_ENDINGS.some((e) => text.endsWith(e))) return false
  return true
}

/**
 * 从文首提取公文标题：
 * - 可识别文头机关前缀行，与后续标题一起作为公文标题（机关行保留在 title.content 中，用 \n 连接）
 * - 可合并连续多行标题片段
 * 返回 title 与 body 循环起始下标 startIndex
 */
function extractPreamble(lines: string[]): { title: DocumentNode | null; startIndex: number } {
  // 找第一个非空行
  let i = 0
  while (i < lines.length && lines[i].trim().length === 0) i++
  if (i >= lines.length) {
    return { title: null, startIndex: lines.length }
  }

  // 若首个非空行是结构节点/主送，无标题
  const first = lines[i].trim()
  if (isStructuralPreambleStop(first)) {
    return { title: null, startIndex: i }
  }

  // 可选：识别机关前缀（允许其后空行），保留在 title 中
  let orgPrefix: string | null = null
  let orgLineNumber = 0

  if (isOrgPrefixLine(first)) {
    let j = i + 1
    while (j < lines.length && lines[j].trim().length === 0) j++
    if (j < lines.length) {
      const next = lines[j].trim()
      if (!isStructuralPreambleStop(next) && (isTitleFragment(next) || isStandaloneTitleLine(next))) {
        // 保留机关行，从标题行继续合并
        orgPrefix = first
        orgLineNumber = i + 1
        i = j
      } else {
        // 仅机关名：当作标题
        return {
          title: { type: NodeType.DOCUMENT_TITLE, content: first, lineNumber: i + 1 },
          startIndex: i + 1,
        }
      }
    } else {
      return {
        title: { type: NodeType.DOCUMENT_TITLE, content: first, lineNumber: i + 1 },
        startIndex: i + 1,
      }
    }
  }

  // 从 i 起合并标题行
  const firstTitle = lines[i].trim()
  if (!isStandaloneTitleLine(firstTitle) && !isTitleFragment(firstTitle)) {
    // 不像标题（例如超长带句号正文）——仍按旧行为首行当标题，避免吞进 body 丢标题位
    // 但若带强句末且很长，更像正文：title=null 让它进 body
    if (TITLE_STRONG_ENDINGS.some((e) => firstTitle.endsWith(e)) || firstTitle.length > TITLE_MERGED_MAX_LEN) {
      return { title: null, startIndex: i }
    }
    return {
      title: { type: NodeType.DOCUMENT_TITLE, content: firstTitle, lineNumber: i + 1 },
      startIndex: i + 1,
    }
  }

  const parts: string[] = [firstTitle]
  const titleLineNumber = i + 1
  let cursor = i + 1

  // 多行：仅连续非空 + isTitleFragment，合并长度限制
  while (parts.length < PREAMBLE_MAX_LINES && cursor < lines.length) {
    const raw = lines[cursor]
    if (raw.trim().length === 0) break // 空行结束标题块
    const t = raw.trim()
    if (isStructuralPreambleStop(t)) break
    if (!isTitleFragment(t)) break
    const merged = parts.join('') + t
    if (merged.length > TITLE_MERGED_MAX_LEN) break
    parts.push(t)
    cursor++
  }

  return {
    title: {
      type: NodeType.DOCUMENT_TITLE,
      content: orgPrefix ? `${orgPrefix}\n${parts.join('')}` : parts.join(''),
      lineNumber: orgPrefix ? orgLineNumber : titleLineNumber,
    },
    startIndex: cursor,
  }
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

    // 当前行存在“部分可识别 + 剩余文本”时，不应吞掉剩余文本
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
 * 将纯文本解析为公文 AST（纯函数）
 *
 * 规则:
 * 1. 跳过空行
 * 2. 文首行通过 extractPreamble 识别可能的机关前缀、多行标题合并，结果存为 DOCUMENT_TITLE；若首个非空行为结构节点或主送则无标题
 * 3. 后续行通过正则检测类型
 * 4. 解析完成后识别发文机关署名（排除尾部 ATTACHMENT 后取逻辑文末）：
 *    - 当 DATE 位于逻辑文末末尾，且 DATE 前一个段落满足“短句 + 机关关键词”时改为 SIGNATURE
 *    - 当逻辑文末末尾只有单位署名、没有 DATE 时，若末尾段落满足“短句 + 机关关键词”也改为 SIGNATURE
 */
export function parseGongwen(text: string): GongwenAST {
  const lines = text.split('\n')
  const { title, startIndex } = extractPreamble(lines)
  const body: DocumentNode[] = []

  let addresseeChecked = false
  let i = startIndex

  while (i < lines.length) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (trimmed.length === 0) {
      i++
      continue
    }

    const lineNumber = i + 1

    if (!addresseeChecked) {
      addresseeChecked = true
      if (isPossibleAddressee(trimmed)) {
        body.push({ type: NodeType.ADDRESSEE, content: trimmed, lineNumber })
        i++
        continue
      }
    }

    if (ATTACHMENT_RE.test(trimmed)) {
      const { node, nextIndex } = parseAttachment(trimmed, lines, i)
      body.push(node)
      i = nextIndex
      continue
    }

    const type = detectNodeType(trimmed)
    body.push({ type, content: trimmed, lineNumber })
    i++
  }

  // 识别发文机关署名：先去尾部附件得到"逻辑文末"，保证附件不干扰署名识别
  const logicalEnd = findLogicalBodyEnd(body)

  // 1) 署名 + 日期场景（在逻辑文末中相邻）
  if (logicalEnd >= 2 && body[logicalEnd - 1].type === NodeType.DATE) {
    const prev = body[logicalEnd - 2]
    if (isPossibleSignature(prev) && hasSignatureOrgHint(prev.content)) {
      body[logicalEnd - 2] = { ...prev, type: NodeType.SIGNATURE }
    }
  } else if (logicalEnd >= 1) {
    // 2) 兼容“只有单位、没有日期”的文末署名（逻辑文末末尾）
    const last = body[logicalEnd - 1]
    if (isPossibleSignature(last) && hasSignatureOrgHint(last.content)) {
      body[logicalEnd - 1] = { ...last, type: NodeType.SIGNATURE }
    }
  }

  return { title, body }
}
