import { describe, expect, it } from 'vitest'
import { sanitizeText } from '../sanitize'

describe('sanitizeText 双引号转换', () => {
  it('成对半角双引号转为中文左右引号', () => {
    expect(sanitizeText('他说"同意"。').text).toBe('他说\u201c同意\u201d。')
  })

  it('多组引号交替开闭', () => {
    expect(sanitizeText('"甲"和"乙"').text).toBe('\u201c甲\u201d和\u201c乙\u201d')
  })

  it('跨行引文保持配对', () => {
    expect(sanitizeText('他说\n"第一行\n第二行"\n结束').text).toBe(
      '他说\n\u201c第一行\n第二行\u201d\n结束',
    )
  })

  it('引号之间无内容时仍成对转换', () => {
    expect(sanitizeText('""').text).toBe('\u201c\u201d')
  })

  it('已有全角引号保持不变', () => {
    expect(sanitizeText('“已经全角”').text).toBe('“已经全角”')
  })

  it('奇数只时剩余半角引号按左引号处理', () => {
    expect(sanitizeText('未闭合"引文').text).toBe('未闭合\u201c引文')
  })

  it('与半角标点替换共存', () => {
    expect(sanitizeText('他说:"好",然后走。').text).toBe('他说：\u201c好\u201d，然后走。')
  })

  it('计入替换次数', () => {
    expect(sanitizeText('"好"').count).toBe(2)
    expect(sanitizeText('无引号').count).toBe(0)
  })

  it('保护 URL、邮箱、时间与千分位数字不被误转全角', () => {
    const input = '请于14:30前登录https://example.com:8080/a?x=1,2或发邮件至a@b.com,共1,234,567.89元.'
    const out = sanitizeText(input).text
    expect(out).toContain('14:30')
    expect(out).toContain('https://example.com:8080/a?x=1,2')
    expect(out).toContain('a@b.com')
    expect(out).toContain('1,234,567.89')
  })

  it('单段出现未闭合半角引号时按行隔离，不污染后文', () => {
    const input = '第一段未闭合"引文\n第二段"正常"引用'
    expect(sanitizeText(input).text).toBe('第一段未闭合\u201c引文\n第二段\u201c正常\u201d引用')
  })

  it('关闭净化总开关时原样返回', () => {
    const input = '测试:1,2'
    expect(sanitizeText(input, { enabled: false })).toEqual({
      text: input,
      count: 0,
      details: { punctuation: 0, quotes: 0, whitespace: 0 },
    })
  })
})
