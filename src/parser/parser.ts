import type {
  AttachmentNode,
  DocumentNode,
  GongwenAST,
  NodeTypeOverrides,
} from '../types/ast'
import { NodeType } from '../types/ast'
import type { ParserConfig } from '../types/documentConfig'
import {
  ATTACHMENT_PAGE_HEADER_RE,
  ATTACHMENT_RE,
  HEADING_1_RE,
  POSTSCRIPT_RE,
  detectNodeType,
  extractAttachmentItemsFromLine,
} from './matchers'

export interface ParseGongwenOptions {
  overrides?: NodeTypeOverrides
  parserConfig?: Partial<ParserConfig>
}

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
  '党校',
  '部',
  '厅',
  '局',
  '委',
  '院',
  '会',
  '集团',
  '公司',
  '中央',
  '中心',
  '专班',
  '指挥部',
  '工作组',
  '处',
  '科',
  '室',
  '站',
  '所',
  '队',
  '大队',
  '支队',
  '总队',
  '学校',
  '大学',
  '学院',
  '医院',
  '银行',
  '协会',
  '联合会',
  '基金会',
  '办事处',
  '管委会',
  '管理局',
  '研究院',
  '设计院',
  '团委',
  '工会',
  '妇联',
]

/**
 * 检查节点是否可能为发文机关署名
 * 条件：类型为 PARAGRAPH，内容长度不超过 24 字，不以特定标点结尾
 */
function isPossibleSignature(node: DocumentNode | undefined): boolean {
  if (!node || node.type !== NodeType.PARAGRAPH || node.overridden) return false
  const content = node.content.trim()
  if (content.length === 0 || content.length > 24) return false
  return !SIGNATURE_EXCLUDE_ENDINGS.some((ending) => content.endsWith(ending))
}

/**
 * 从 body 末尾去掉连续 ATTACHMENT / ATTACHMENT_PAGE_HEADER 节点，返回逻辑文末索引
 */
function findLogicalBodyEnd(body: DocumentNode[]): number {
  let i = body.length - 1
  while (
    i >= 0
    && (body[i].type === NodeType.ATTACHMENT || body[i].type === NodeType.ATTACHMENT_PAGE_HEADER)
  ) {
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

function isPossibleAddressee(line: string, parserConfig?: Partial<ParserConfig>): boolean {
  if (!(line.endsWith('：') || line.endsWith(':'))) return false
  if (line.length > ADDRESSEE_MAX_LENGTH) return false
  if (HEADING_1_RE.test(line) || ATTACHMENT_RE.test(line)) return false
  if (detectNodeType(line, parserConfig) === NodeType.MINUTES_ATTENDANCE) return false
  return true
}

const PREAMBLE_MAX_LINES = 4
const TITLE_FRAGMENT_MAX_LEN = 40
const TITLE_MERGED_MAX_LEN = 120
const ORG_PREFIX_MAX_LEN = 20
const TITLE_STRONG_ENDINGS = ['。', '；', ';', '！', '!', '？', '?']

function isStructuralPreambleStop(line: string, parserConfig?: Partial<ParserConfig>): boolean {
  if (isPossibleAddressee(line, parserConfig)) return true
  const t = detectNodeType(line, parserConfig)
  return t !== NodeType.PARAGRAPH
}

function isOrgPrefixLine(line: string, parserConfig?: Partial<ParserConfig>): boolean {
  const text = line.trim()
  if (text.length === 0 || text.length > ORG_PREFIX_MAX_LEN) return false
  if (isPossibleAddressee(text, parserConfig)) return false
  if (detectNodeType(text, parserConfig) !== NodeType.PARAGRAPH) return false
  if (SIGNATURE_EXCLUDE_ENDINGS.some((e) => text.endsWith(e))) return false
  return hasSignatureOrgHint(text)
}

/** 多行拆分时的标题片段（较短） */
function isTitleFragment(line: string, parserConfig?: Partial<ParserConfig>): boolean {
  const text = line.trim()
  if (text.length === 0 || text.length > TITLE_FRAGMENT_MAX_LEN) return false
  if (isPossibleAddressee(text, parserConfig)) return false
  if (detectNodeType(text, parserConfig) !== NodeType.PARAGRAPH) return false
  if (TITLE_STRONG_ENDINGS.some((e) => text.endsWith(e))) return false
  return true
}

/** 可作为完整单行标题（允许更长） */
function isStandaloneTitleLine(line: string, parserConfig?: Partial<ParserConfig>): boolean {
  const text = line.trim()
  if (text.length === 0 || text.length > TITLE_MERGED_MAX_LEN) return false
  if (isPossibleAddressee(text, parserConfig)) return false
  if (detectNodeType(text, parserConfig) !== NodeType.PARAGRAPH) return false
  if (TITLE_STRONG_ENDINGS.some((e) => text.endsWith(e))) return false
  return true
}

function isOverriddenAsNonTitle(overrides: NodeTypeOverrides | undefined, lineNumber: number): boolean {
  if (!overrides) return false
  const override = overrides[lineNumber]
  return override !== undefined && override !== NodeType.DOCUMENT_TITLE
}

/**
 * 从文首提取公文标题：
 * - 可识别文头机关前缀行，与后续标题一起作为公文标题（机关行保留在 title.content 中，用 \n 连接）
 * - 可合并连续多行标题片段
 */
function extractPreamble(
  lines: string[],
  overrides?: NodeTypeOverrides,
  parserConfig?: Partial<ParserConfig>,
): { title: DocumentNode | null; startIndex: number } {
  let i = 0
  while (i < lines.length && lines[i].trim().length === 0) i++
  if (i >= lines.length) {
    return { title: null, startIndex: lines.length }
  }

  const firstLineNumber = i + 1
  if (isOverriddenAsNonTitle(overrides, firstLineNumber)) {
    return { title: null, startIndex: i }
  }

  const first = lines[i].trim()
  if (
    overrides?.[firstLineNumber] !== NodeType.DOCUMENT_TITLE
    && isStructuralPreambleStop(first, parserConfig)
  ) {
    return { title: null, startIndex: i }
  }

  let orgPrefix: string | null = null
  let orgLineNumber = 0

  if (overrides?.[firstLineNumber] !== NodeType.DOCUMENT_TITLE && isOrgPrefixLine(first, parserConfig)) {
    let j = i + 1
    while (j < lines.length && lines[j].trim().length === 0) j++
    if (j < lines.length) {
      const nextLineNumber = j + 1
      const next = lines[j].trim()
      if (
        !isOverriddenAsNonTitle(overrides, nextLineNumber)
        && !isStructuralPreambleStop(next, parserConfig)
        && (isTitleFragment(next, parserConfig) || isStandaloneTitleLine(next, parserConfig))
      ) {
        orgPrefix = first
        orgLineNumber = firstLineNumber
        i = j
      } else {
        return {
          title: {
            type: NodeType.DOCUMENT_TITLE,
            content: first,
            lineNumber: firstLineNumber,
          },
          startIndex: i + 1,
        }
      }
    } else {
      return {
        title: {
          type: NodeType.DOCUMENT_TITLE,
          content: first,
          lineNumber: firstLineNumber,
        },
        startIndex: i + 1,
      }
    }
  }

  const firstTitle = lines[i].trim()
  const titleLineNumber = i + 1
  const explicitlyTitled = overrides?.[titleLineNumber] === NodeType.DOCUMENT_TITLE

  if (
    !explicitlyTitled
    && !isStandaloneTitleLine(firstTitle, parserConfig)
    && !isTitleFragment(firstTitle, parserConfig)
  ) {
    if (TITLE_STRONG_ENDINGS.some((e) => firstTitle.endsWith(e)) || firstTitle.length > TITLE_MERGED_MAX_LEN) {
      return { title: null, startIndex: i }
    }
    return {
      title: { type: NodeType.DOCUMENT_TITLE, content: firstTitle, lineNumber: titleLineNumber },
      startIndex: i + 1,
    }
  }

  const parts: string[] = [firstTitle]
  let cursor = i + 1

  while (parts.length < PREAMBLE_MAX_LINES && cursor < lines.length) {
    const raw = lines[cursor]
    if (raw.trim().length === 0) break
    const cursorLineNumber = cursor + 1
    if (isOverriddenAsNonTitle(overrides, cursorLineNumber)) break
    const t = raw.trim()
    if (overrides?.[cursorLineNumber] !== NodeType.DOCUMENT_TITLE) {
      if (isStructuralPreambleStop(t, parserConfig)) break
      if (!isTitleFragment(t, parserConfig)) break
    }
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
      overridden: overrides?.[orgPrefix ? orgLineNumber : titleLineNumber] === NodeType.DOCUMENT_TITLE || undefined,
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
  currentIndex: number,
  overrides?: NodeTypeOverrides,
): { node: AttachmentNode; nextIndex: number } {
  const colonMatch = line.match(/^附件[：:](.*)$/)
  if (!colonMatch) {
    throw new Error('Invalid attachment line')
  }
  const contentAfterColon = colonMatch[1].trim()

  const firstItemMatch = contentAfterColon.match(/^(\d+)[.．]/)
  if (!firstItemMatch || firstItemMatch[1] !== '1') {
    return {
      node: buildSingleAttachmentNode(line, contentAfterColon, currentIndex),
      nextIndex: currentIndex + 1,
    }
  }

  const items: AttachmentNode['items'] = []
  let remainingText = contentAfterColon
  let expectedIndex = 1
  let lastConsumedIndex = currentIndex

  while (true) {
    const { items: foundItems, remaining } = extractAttachmentItemsFromLine(
      remainingText,
      expectedIndex,
    )

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

    const nextLineIndex = lastConsumedIndex + 1
    if (nextLineIndex < lines.length) {
      // 如果下一行被用户手动覆写，则不再作为续行附件吞并
      if (overrides?.[nextLineIndex + 1] !== undefined) {
        break
      }
      const nextLine = lines[nextLineIndex].trim()
      if (nextLine.length === 0) {
        lastConsumedIndex = nextLineIndex
        continue
      }
      const nextItemMatch = nextLine.match(/^(\d+)[.．]/)
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
 */
export function parseGongwen(text: string, options?: ParseGongwenOptions): GongwenAST {
  const overrides = options?.overrides
  const parserConfig = options?.parserConfig
  const lines = text.split('\n')
  const { title, startIndex } = extractPreamble(lines, overrides, parserConfig)
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
    const overriddenType = overrides?.[lineNumber]

    if (overriddenType !== undefined) {
      if (overriddenType === NodeType.ATTACHMENT && ATTACHMENT_RE.test(trimmed)) {
        const { node, nextIndex } = parseAttachment(trimmed, lines, i, overrides)
        body.push({ ...node, overridden: true })
        i = nextIndex
      } else if (overriddenType === NodeType.ATTACHMENT) {
        body.push({
          type: NodeType.ATTACHMENT,
          content: trimmed,
          lineNumber,
          overridden: true,
          isMultiple: false,
          items: [{ index: 0, name: trimmed.replace(/^附件[：:]\s*/, '') }],
        } as AttachmentNode)
        i++
      } else {
        body.push({
          type: overriddenType,
          content: trimmed,
          lineNumber,
          overridden: true,
        })
        i++
      }
      addresseeChecked = true
      continue
    }

    if (!addresseeChecked) {
      addresseeChecked = true
      if (isPossibleAddressee(trimmed, parserConfig)) {
        body.push({ type: NodeType.ADDRESSEE, content: trimmed, lineNumber })
        i++
        continue
      }
    }

    if (ATTACHMENT_RE.test(trimmed)) {
      const { node, nextIndex } = parseAttachment(trimmed, lines, i, overrides)
      body.push(node)
      i = nextIndex
      continue
    }

    // §7.3.7 附件另面标识：正文中出现独立短行 "附件" / "附件1"
    if (body.length > 0 && ATTACHMENT_PAGE_HEADER_RE.test(trimmed)) {
      body.push({ type: NodeType.ATTACHMENT_PAGE_HEADER, content: trimmed, lineNumber })
      i++
      continue
    }

    const type = detectNodeType(trimmed, parserConfig)
    body.push({ type, content: trimmed, lineNumber })
    i++
  }

  // 1. 先去尾部连续附件，定位逻辑文末
  let logicalEnd = findLogicalBodyEnd(body)

  // 2. 识别 §7.3.6 附注：紧跟在 DATE 后且为括号包裹短行「（...）」
  if (
    logicalEnd >= 2
    && body[logicalEnd - 2].type === NodeType.DATE
    && body[logicalEnd - 1].type === NodeType.PARAGRAPH
    && !body[logicalEnd - 1].overridden
    && POSTSCRIPT_RE.test(body[logicalEnd - 1].content.trim())
  ) {
    body[logicalEnd - 1] = { ...body[logicalEnd - 1], type: NodeType.POSTSCRIPT }
    logicalEnd -= 1
  }

  // 3. 识别发文机关署名：先于 DATE 的相邻单位名，或逻辑文末末尾只有单位无日期
  if (logicalEnd >= 2 && body[logicalEnd - 1].type === NodeType.DATE) {
    const prev = body[logicalEnd - 2]
    if (isPossibleSignature(prev) && hasSignatureOrgHint(prev.content)) {
      body[logicalEnd - 2] = { ...prev, type: NodeType.SIGNATURE }
    }
  } else if (logicalEnd >= 1) {
    const last = body[logicalEnd - 1]
    if (isPossibleSignature(last) && hasSignatureOrgHint(last.content)) {
      body[logicalEnd - 1] = { ...last, type: NodeType.SIGNATURE }
    }
  }

  return { title, body }
}
