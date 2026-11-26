import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../types/documentConfig'
import {
  calculateSignatureLayout,
  normalizeDocNumberText,
  parseSigners,
  resolveHeaderRenderPlan,
  sanitizeExportFileName,
  splitFirstSentence,
  splitMinutesAttendance,
} from '../typography'

describe('layout/typography', () => {
  it('加盖印章时日期右空四字、空二行、署名以日期居中 (§7.3.5.1)', () => {
    const layout = calculateSignatureLayout('国务院办公厅', '2026年11月26日', true)
    expect(layout.emptyLinesBefore).toBe(2)
    expect(layout.dateRightIndentEm).toBe(4)
    expect(layout.signatureRightIndentEm).toBeGreaterThan(4)
  })

  it('不加盖印章时空一行，日期短于署名则署名右空二字、日期右移二字 (§7.3.5.2)', () => {
    const layout = calculateSignatureLayout('中华人民共和国国务院办公厅', '2026年5月1日', false)
    expect(layout.emptyLinesBefore).toBe(1)
    expect(layout.signatureRightIndentEm).toBe(2)
    expect(layout.dateRightIndentEm).toBeGreaterThan(2)
  })

  it('不加盖印章且日期长于署名时，日期右空二字、署名左移 (§7.3.5.2)', () => {
    const layout = calculateSignatureLayout('市政府', '2026年11月26日', false)
    expect(layout.emptyLinesBefore).toBe(1)
    expect(layout.dateRightIndentEm).toBe(2)
    expect(layout.signatureRightIndentEm).toBeGreaterThan(2)
  })

  it('多个签发人按每行两人分组 (§7.2.6)', () => {
    expect(parseSigners('张三, 李四、王五 赵六')).toEqual([
      ['张三', '李四'],
      ['王五', '赵六'],
    ])
  })

  it('发文字号括号和顺序号规范化 (§7.2.5)', () => {
    expect(normalizeDocNumberText('国办发[2026]第01号')).toBe('国办发〔2026〕1号')
    expect(normalizeDocNumberText('市发改(2025)008号')).toBe('市发改〔2025〕8号')
  })

  it('无字号且无签发人时不占位空白元信息行，信函首页隐页码', () => {
    const plan = resolveHeaderRenderPlan({
      ...DEFAULT_CONFIG.header,
      enabled: true,
      format: 'letter',
      orgName: 'XX委',
      docNumber: '',
      signer: '',
    })
    expect(plan.shouldRender).toBe(true)
    expect(plan.hasMetaRow).toBe(false)
    expect(plan.hideFirstPageNumber).toBe(true)
    expect(plan.isLetterFooterNote).toBe(true)
  })

  it('清洗导出文件名非法字符', () => {
    expect(sanitizeExportFileName('关于:A/B*测试?的\n"通知"')).toBe('关于-A-B-测试-的-通知')
    expect(sanitizeExportFileName('')).toBe('公文')
  })

  it('拆分首句与纪要出席行', () => {
    expect(splitFirstSentence('一、总体要求。这是后续正文')).toEqual({
      lead: '一、总体要求。',
      rest: '这是后续正文',
    })
    expect(splitMinutesAttendance('出席: 张三、李四')).toEqual({
      label: '出席：',
      names: '张三、李四',
    })
  })
})
