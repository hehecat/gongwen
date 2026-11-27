import { describe, expect, it } from 'vitest'
import { NodeType } from '../../types/ast'
import { DEFAULT_CONFIG } from '../../types/documentConfig'
import { parseGongwen } from '../../parser'
import { applyLineFixToText, checkGongwen } from '../gongwenChecker'

describe('gongwenChecker', () => {
  it('检测并可修复标题末标点、附件末标点、日期不规范和字号括号', () => {
    const rawText = [
      '关于开展检查的通知。',
      '各部门：',
      '一、要求',
      '三、漏了第二条',
      '（未闭合括号示例',
      '附件：实施方案。',
      'XX中心',
      '2026.04.06',
    ].join('\n')

    const ast = parseGongwen(rawText)
    const config = {
      ...DEFAULT_CONFIG,
      header: {
        ...DEFAULT_CONFIG.header,
        enabled: true,
        orgName: 'XX中心',
        docNumber: '中办发[2026]第03号',
      },
    }

    const issues = checkGongwen({ ast, rawText, config })
    const rules = issues.map((item) => item.ruleId)

    expect(rules).toContain('title-trailing-period')
    expect(rules).toContain('heading-sequence')
    expect(rules).toContain('attachment-trailing-punct')
    expect(rules).toContain('date-format')
    expect(rules).toContain('doc-number-brackets')
    expect(rules).toContain('unpaired-punctuation')

    const dateIssue = issues.find((i) => i.ruleId === 'date-format')!
    expect(dateIssue.fix?.replacementText).toBe('2026年4月6日')
    expect(applyLineFixToText(rawText, dateIssue.lineNumber!, dateIssue.fix!.replacementText!)).toContain('2026年4月6日')
  })

  it('检测末页孤行落款 (§7.3.5.5) 和首页无正文 (§7.3.3)', () => {
    const ast = parseGongwen('关于通知\n各部门：\n一、内容\n正文\n国务院办公厅\n2026年11月26日')
    const issues = checkGongwen({
      ast,
      rawText: '关于通知\n各部门：\n一、内容\n正文\n国务院办公厅\n2026年11月26日',
      config: DEFAULT_CONFIG,
      pages: [
        { nodeTypes: [NodeType.DOCUMENT_TITLE, NodeType.ADDRESSEE] },
        { nodeTypes: [NodeType.SIGNATURE, NodeType.DATE] },
      ],
    })

    expect(issues.some((i) => i.ruleId === 'first-page-no-body')).toBe(true)
    expect(issues.some((i) => i.ruleId === 'orphan-signature')).toBe(true)
  })

  it('优先使用分页求解器给出的一次性目标行距与文案', () => {
    const ast = parseGongwen('关于通知\n各部门：\n一、内容\n正文\n国务院办公厅\n2026年11月26日')
    const tightenIssues = checkGongwen({
      ast,
      rawText: '关于通知\n各部门：\n一、内容\n正文\n国务院办公厅\n2026年11月26日',
      config: DEFAULT_CONFIG,
      pages: [
        { nodeTypes: [NodeType.DOCUMENT_TITLE, NodeType.ADDRESSEE, NodeType.PARAGRAPH] },
        {
          nodeTypes: [NodeType.SIGNATURE, NodeType.DATE],
          orphanFixChecked: true,
          suggestedLineSpacing: 27.2,
          suggestedLineSpacingDirection: 'tighten',
        },
      ],
    })

    const tightenIssue = tightenIssues.find((i) => i.ruleId === 'orphan-signature')!
    expect(tightenIssue.fix?.nextLineSpacing).toBe(27.2)
    expect(tightenIssue.fix?.label).toContain('27.2 磅')
    expect(tightenIssue.fix?.label).toContain('并入上页')

    const loosenIssues = checkGongwen({
      ast,
      rawText: '关于通知\n各部门：\n一、内容\n正文\n国务院办公厅\n2026年11月26日',
      config: DEFAULT_CONFIG,
      pages: [
        { nodeTypes: [NodeType.DOCUMENT_TITLE, NodeType.ADDRESSEE, NodeType.PARAGRAPH] },
        {
          nodeTypes: [NodeType.SIGNATURE, NodeType.DATE],
          orphanFixChecked: true,
          suggestedLineSpacing: 30.8,
          suggestedLineSpacingDirection: 'loosen',
        },
      ],
    })

    const loosenIssue = loosenIssues.find((i) => i.ruleId === 'orphan-signature')!
    expect(loosenIssue.fix?.nextLineSpacing).toBe(30.8)
    expect(loosenIssue.fix?.label).toContain('30.8 磅')
    expect(loosenIssue.fix?.label).toContain('带入末行正文')
  })
})
