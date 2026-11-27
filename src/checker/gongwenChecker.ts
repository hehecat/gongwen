import { NodeType, type AttachmentNode, type GongwenAST } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { normalizeDocNumberText } from '../layout/typography'

export type CheckSeverity = 'error' | 'warning' | 'info'

export type CheckRuleId =
  | 'title-trailing-period'
  | 'heading-sequence'
  | 'attachment-trailing-punct'
  | 'date-format'
  | 'doc-number-brackets'
  | 'unpaired-punctuation'
  | 'orphan-signature'
  | 'first-page-no-body'

export interface CheckFixAction {
  label: string
  kind: 'replace-line' | 'update-doc-number' | 'adjust-line-spacing'
  lineNumber?: number
  replacementText?: string
  nextDocNumber?: string
  nextLineSpacing?: number
}

export interface CheckIssue {
  id: string
  ruleId: CheckRuleId
  severity: CheckSeverity
  clause: string
  title: string
  detail: string
  lineNumber?: number
  fix?: CheckFixAction
}

export interface CheckPageSnapshot {
  nodeTypes: NodeType[]
  suggestedLineSpacing?: number
  suggestedLineSpacingDirection?: 'tighten' | 'loosen'
  orphanFixChecked?: boolean
}

export interface CheckGongwenInput {
  ast: GongwenAST
  rawText: string
  config: DocumentConfig
  pages?: CheckPageSnapshot[]
}

const CN_DIGIT_MAP: Record<string, string> = {
  '〇': '0',
  '零': '0',
  '一': '1',
  '二': '2',
  '三': '3',
  '四': '4',
  '五': '5',
  '六': '6',
  '七': '7',
  '八': '8',
  '九': '9',
}

function parseChineseMonthOrDay(raw: string): number | null {
  if (!raw) return null
  if (/^\d+$/.test(raw)) return Number(raw)
  if (raw === '十') return 10
  if (raw.startsWith('十') && raw.length === 2) {
    const ones = CN_DIGIT_MAP[raw[1]]
    return ones ? 10 + Number(ones) : null
  }
  if (raw.endsWith('十') && raw.length === 2) {
    const tens = CN_DIGIT_MAP[raw[0]]
    return tens ? Number(tens) * 10 : null
  }
  if (raw.length === 3 && raw[1] === '十') {
    const tens = CN_DIGIT_MAP[raw[0]]
    const ones = CN_DIGIT_MAP[raw[2]]
    return tens && ones ? Number(tens) * 10 + Number(ones) : null
  }
  if (raw.length === 1 && CN_DIGIT_MAP[raw]) {
    return Number(CN_DIGIT_MAP[raw])
  }
  return null
}

function parseLooseDateLine(trimmed: string): string | null {
  // 1. 已是中文数字日期：二〇二六年四月十六日
  const cnMatch = trimmed.match(/^([〇零一二三四五六七八九]{4})年([一二三四五六七八九十]{1,3})月([一二三四五六七八九十]{1,3})日$/)
  if (cnMatch) {
    const year = cnMatch[1].split('').map((c) => CN_DIGIT_MAP[c] ?? '').join('')
    const month = parseChineseMonthOrDay(cnMatch[2])
    const day = parseChineseMonthOrDay(cnMatch[3])
    if (year.length === 4 && month && day) {
      return `${year}年${month}月${day}日`
    }
  }

  // 2. 编虚位的阿拉伯数字日期：2026年04月06日
  const paddedMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
  if (paddedMatch) {
    const month = Number(paddedMatch[2])
    const day = Number(paddedMatch[3])
    if (
      (paddedMatch[2].startsWith('0') || paddedMatch[3].startsWith('0'))
      && month >= 1 && month <= 12 && day >= 1 && day <= 31
    ) {
      return `${paddedMatch[1]}年${month}月${day}日`
    }
  }

  // 3. 点/横杠/斜杠日期：2026.04.06 / 2026-4-6 / 2026/04/06
  const sepMatch = trimmed.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/)
  if (sepMatch) {
    const month = Number(sepMatch[2])
    const day = Number(sepMatch[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${sepMatch[1]}年${month}月${day}日`
    }
  }

  return null
}

const CN_NUM_VALUES: Record<string, number> = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
}

function parseChineseOrdinal(raw: string): number | null {
  if (!raw) return null
  if (raw.length === 1) return CN_NUM_VALUES[raw] ?? null
  if (raw.length === 2 && raw[0] === '十') {
    const v = CN_NUM_VALUES[raw[1]]
    return v ? 10 + v : null
  }
  if (raw.length === 2 && raw[1] === '十') {
    const v = CN_NUM_VALUES[raw[0]]
    return v ? v * 10 : null
  }
  if (raw.length === 3 && raw[1] === '十') {
    const t = CN_NUM_VALUES[raw[0]]
    const o = CN_NUM_VALUES[raw[2]]
    return t && o ? t * 10 + o : null
  }
  return null
}

function extractHeadingOrdinal(type: NodeType, content: string): number | null {
  if (type === NodeType.HEADING_1) {
    const m = content.match(/^([一二三四五六七八九十]+)、/)
    return m ? parseChineseOrdinal(m[1]) : null
  }
  if (type === NodeType.HEADING_2) {
    const m = content.match(/^[（(]([一二三四五六七八九十]+)[）)]/)
    return m ? parseChineseOrdinal(m[1]) : null
  }
  if (type === NodeType.HEADING_3) {
    const m = content.match(/^(\d+)[.．]/)
    if (m) return Number(m[1])
    const cm = content.match(/^([一二三四五六七八九十]+)[是要]/)
    return cm ? parseChineseOrdinal(cm[1]) : null
  }
  return null
}

function hasUnpairedBracketsOrQuotes(line: string): string | null {
  let parenDepth = 0
  let doubleQuotes = 0
  for (const ch of line) {
    if (ch === '（' || ch === '(') parenDepth++
    else if (ch === '）' || ch === ')') {
      parenDepth--
      if (parenDepth < 0) return '存在多余的右括号'
    } else if (ch === '“' || ch === '”') {
      doubleQuotes++
    }
  }
  if (parenDepth > 0) return '圆括号未成对闭合'
  if (doubleQuotes % 2 !== 0) return '中文双引号未成对闭合'
  return null
}

/**
 * 纯前端公文规范体检（零 AI 依赖，基于 GB/T 9704—2012）
 */
export function checkGongwen({
  ast,
  rawText,
  config,
  pages,
}: CheckGongwenInput): CheckIssue[] {
  const issues: CheckIssue[] = []
  const lines = rawText.split('\n')

  // 1. 标题末尾标点（§7.3.1）
  if (ast.title) {
    const lastTitleLine = ast.title.content.split('\n').pop() ?? ''
    if (/[。；;]$/.test(lastTitleLine.trim())) {
      const titleLines = ast.title.content.split('\n')
      const targetLineNumber = ast.title.lineNumber + titleLines.length - 1
      const rawLine = lines[targetLineNumber - 1] ?? lastTitleLine
      issues.push({
        id: `title-period-${targetLineNumber}`,
        ruleId: 'title-trailing-period',
        severity: 'warning',
        clause: 'GB/T 9704 §7.3.1',
        title: '公文标题末尾不应加句号或分号',
        detail: `第 ${targetLineNumber} 行标题末尾存在标点「${lastTitleLine.trim().slice(-1)}」。`,
        lineNumber: targetLineNumber,
        fix: {
          label: '去除末尾标点',
          kind: 'replace-line',
          lineNumber: targetLineNumber,
          replacementText: rawLine.replace(/[。；;]+$/, ''),
        },
      })
    }
  } else if (ast.body.length > 0 && ast.body[0].type === NodeType.PARAGRAPH) {
    const firstLine = ast.body[0].content.trim()
    const looksLikeTitleWithPeriod =
      firstLine.length <= 60
      && /[。；;]$/.test(firstLine)
      && (
        /^关于.+(?:通知|报告|请示|决定|意见|函|纪要|通告|公告|批复|命令|通报)[。；;]$/.test(firstLine)
        || ast.body[1]?.type === NodeType.ADDRESSEE
      )
    if (looksLikeTitleWithPeriod) {
      const targetLineNumber = ast.body[0].lineNumber
      const rawLine = lines[targetLineNumber - 1] ?? firstLine
      issues.push({
        id: `title-period-${targetLineNumber}`,
        ruleId: 'title-trailing-period',
        severity: 'warning',
        clause: 'GB/T 9704 §7.3.1',
        title: '疑似公文标题末尾误加句号或分号（导致未能识别为标题）',
        detail: `第 ${targetLineNumber} 行末尾存在标点「${firstLine.slice(-1)}」，去除后将自动按公文标题居中排版。`,
        lineNumber: targetLineNumber,
        fix: {
          label: '去除末尾标点',
          kind: 'replace-line',
          lineNumber: targetLineNumber,
          replacementText: rawLine.replace(/[。；;]+$/, ''),
        },
      })
    }
  }

  // 2. 标题序号跳级 / 重复（§7.3.3）
  let expectedH1 = 1
  let expectedH2 = 1
  let expectedH3 = 1

  for (const node of ast.body) {
    if (node.type === NodeType.HEADING_1) {
      expectedH2 = 1
      expectedH3 = 1
      const ord = extractHeadingOrdinal(node.type, node.content)
      if (ord !== null) {
        if (ord !== expectedH1) {
          issues.push({
            id: `h1-seq-${node.lineNumber}`,
            ruleId: 'heading-sequence',
            severity: 'warning',
            clause: 'GB/T 9704 §7.3.3',
            title: '一级标题序号不连续',
            detail: `第 ${node.lineNumber} 行期望「第 ${expectedH1} 项」，实际为第 ${ord} 项。`,
            lineNumber: node.lineNumber,
          })
        }
        expectedH1 = ord + 1
      }
    } else if (node.type === NodeType.HEADING_2) {
      expectedH3 = 1
      const ord = extractHeadingOrdinal(node.type, node.content)
      if (ord !== null) {
        if (ord !== expectedH2) {
          issues.push({
            id: `h2-seq-${node.lineNumber}`,
            ruleId: 'heading-sequence',
            severity: 'warning',
            clause: 'GB/T 9704 §7.3.3',
            title: '二级标题序号不连续',
            detail: `第 ${node.lineNumber} 行期望「（第 ${expectedH2} 项）」，实际为第 ${ord} 项。`,
            lineNumber: node.lineNumber,
          })
        }
        expectedH2 = ord + 1
      }
    } else if (node.type === NodeType.HEADING_3) {
      const ord = extractHeadingOrdinal(node.type, node.content)
      if (ord !== null) {
        if (ord !== expectedH3) {
          issues.push({
            id: `h3-seq-${node.lineNumber}`,
            ruleId: 'heading-sequence',
            severity: 'warning',
            clause: 'GB/T 9704 §7.3.3',
            title: '三级标题序号不连续',
            detail: `第 ${node.lineNumber} 行期望序号 ${expectedH3}，实际为 ${ord}。`,
            lineNumber: node.lineNumber,
          })
        }
        expectedH3 = ord + 1
      }
    }
  }

  // 3. 附件名称末尾标点（§7.3.4）
  for (const node of ast.body) {
    if (node.type === NodeType.ATTACHMENT) {
      const att = node as AttachmentNode
      const lastItem = att.items[att.items.length - 1]
      if (lastItem && /[。；;.，,]$/.test(lastItem.name)) {
        const rawLine = lines[node.lineNumber - 1] ?? node.content
        issues.push({
          id: `att-punct-${node.lineNumber}`,
          ruleId: 'attachment-trailing-punct',
          severity: 'warning',
          clause: 'GB/T 9704 §7.3.4',
          title: '附件名称末尾不应加标点符号',
          detail: `第 ${node.lineNumber} 行附件名称以「${lastItem.name.slice(-1)}」结尾，国标规定附件名称后不加标点。`,
          lineNumber: node.lineNumber,
          fix: !att.isMultiple
            ? {
                label: '去除附件末标点',
                kind: 'replace-line',
                lineNumber: node.lineNumber,
                replacementText: rawLine.replace(/[。；;.，,]+$/, ''),
              }
            : undefined,
        })
      }
    }
  }

  // 4. 成文日期格式检查（§7.3.5.4）：扫描文本末尾 6 个非空行中的日期写法
  let tailChecked = 0
  for (let i = lines.length - 1; i >= 0 && tailChecked < 6; i--) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    tailChecked++
    const normalized = parseLooseDateLine(trimmed)
    if (normalized && normalized !== trimmed) {
      issues.push({
        id: `date-fmt-${i + 1}`,
        ruleId: 'date-format',
        severity: 'error',
        clause: 'GB/T 9704 §7.3.5.4',
        title: '成文日期不符合阿拉伯数字/不编虚位规范',
        detail: `第 ${i + 1} 行「${trimmed}」应规范为「${normalized}」。`,
        lineNumber: i + 1,
        fix: {
          label: `改为 ${normalized}`,
          kind: 'replace-line',
          lineNumber: i + 1,
          replacementText: normalized,
        },
      })
    }
  }

  // 5. 发文字号六角括号与「第」字/虚位检查（§7.2.5）
  if (config.header.enabled && config.header.docNumber.trim()) {
    const rawDocNum = config.header.docNumber.trim()
    const normalizedDocNum = normalizeDocNumberText(rawDocNum)
    if (normalizedDocNum !== rawDocNum) {
      issues.push({
        id: 'doc-number-brackets',
        ruleId: 'doc-number-brackets',
        severity: 'warning',
        clause: 'GB/T 9704 §7.2.5',
        title: '发文字号括号或顺序号不规范',
        detail: `年份应使用六角括号「〔〕」，顺序号不加「第」字且不编虚位。建议改为「${normalizedDocNum}」。`,
        fix: {
          label: `改为 ${normalizedDocNum}`,
          kind: 'update-doc-number',
          nextDocNumber: normalizedDocNum,
        },
      })
    }
  }

  // 6. 标点未成对闭合（§9）
  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim()
    if (!trimmed) return
    const problem = hasUnpairedBracketsOrQuotes(trimmed)
    if (problem) {
      issues.push({
        id: `unpaired-${idx + 1}`,
        ruleId: 'unpaired-punctuation',
        severity: 'info',
        clause: 'GB/T 9704 §9',
        title: problem,
        detail: `第 ${idx + 1} 行可能存在未配对的括号或引号。`,
        lineNumber: idx + 1,
      })
    }
  })

  // 7. 分页体检：末页孤行落款（§7.3.5.5）& 首页无正文（§7.3.3）
  if (pages && pages.length > 0) {
    const firstTypes = pages[0].nodeTypes
    const hasBodyOnFirstPage = firstTypes.some(
      (t) => t !== NodeType.DOCUMENT_TITLE && t !== NodeType.ADDRESSEE,
    )
    if (ast.body.length > 0 && !hasBodyOnFirstPage) {
      issues.push({
        id: 'first-page-no-body',
        ruleId: 'first-page-no-body',
        severity: 'warning',
        clause: 'GB/T 9704 §7.3.3',
        title: '公文首页未显示正文',
        detail: '国标要求公文首页必须显示正文；若主送机关过多，可在版记设置中将主送机关移至版记。',
      })
    }

    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1]
      const lastTypes = lastPage.nodeTypes
      const onlyTailMeta =
        lastTypes.length > 0
        && lastTypes.every(
          (t) =>
            t === NodeType.SIGNATURE
            || t === NodeType.DATE
            || t === NodeType.POSTSCRIPT,
        )
      if (onlyTailMeta) {
        let fix: CheckFixAction | undefined
        let detail = '建议微调正文行距或上下页边距，使落款与末行正文同页显示。'

        if (lastPage.suggestedLineSpacing !== undefined) {
          const target = lastPage.suggestedLineSpacing
          const isLoosen = lastPage.suggestedLineSpacingDirection === 'loosen'
          fix = {
            label: isLoosen
              ? `正文行距调至 ${target} 磅（带入末行正文）`
              : `正文行距收紧至 ${target} 磅（并入上页）`,
            kind: 'adjust-line-spacing',
            nextLineSpacing: target,
          }
          detail = isLoosen
            ? `已计算可一次性消除孤行落款的目标行距：略微放宽至 ${target} 磅，使末行正文随落款同页显示。`
            : `已计算可一次性消除孤行落款的目标行距：收紧至 ${target} 磅，使落款并入上一页显示。`
        } else if (lastPage.orphanFixChecked) {
          detail = '仅靠常规行距微调无法消除本页孤行落款，建议在「排版 → 页面与版心」适当调整上下页边距。'
        } else {
          const fallbackLineSpacing = Number(
            Math.max(config.body.fontSize, config.body.lineSpacing - 0.3).toFixed(1),
          )
          if (fallbackLineSpacing < config.body.lineSpacing) {
            fix = {
              label: `正文行距微调至 ${fallbackLineSpacing} 磅`,
              kind: 'adjust-line-spacing',
              nextLineSpacing: fallbackLineSpacing,
            }
          }
        }

        issues.push({
          id: 'orphan-signature',
          ruleId: 'orphan-signature',
          severity: 'warning',
          clause: 'GB/T 9704 §7.3.5.5',
          title: '末页仅剩落款/成文日期（另页单印落款）',
          detail,
          fix,
        })
      }
    }
  }

  return issues
}

/** 根据修复动作更新指定行文本 */
export function applyLineFixToText(
  rawText: string,
  lineNumber: number,
  replacementText: string,
): string {
  const lines = rawText.split('\n')
  if (lineNumber < 1 || lineNumber > lines.length) return rawText
  lines[lineNumber - 1] = replacementText
  return lines.join('\n')
}
