import { describe, expect, it } from 'vitest'
import {
  autoFixDocumentText,
  removeRedundantSpaces,
  replaceEnglishPunctuation,
  sanitizeText,
} from './sanitize'

describe('replaceEnglishPunctuation', () => {
  it('将中文语境中的英文标点替换为中文标点', () => {
    const result = replaceEnglishPunctuation('各单位: 请认真贯彻落实, 确保执行到位!')

    expect(result.text).toBe('各单位： 请认真贯彻落实， 确保执行到位！')
    expect(result.count).toBe(3)
  })

  it('保留英文语句中的英文标点', () => {
    const result = replaceEnglishPunctuation('Hello, world! Version 2.0 is ready.')

    expect(result.text).toBe('Hello, world! Version 2.0 is ready.')
    expect(result.count).toBe(0)
  })

  it('将中文标题中的半角括号替换为全角括号', () => {
    const result = replaceEnglishPunctuation('(一) 工作要求')

    expect(result.text).toBe('（一） 工作要求')
    expect(result.count).toBe(2)
  })
})

describe('removeRedundantSpaces', () => {
  it('清理中文之间和标点附近的多余空格', () => {
    const result = removeRedundantSpaces('各 单位 ： 请 认真 落实 。')

    expect(result.text).toBe('各单位：请认真落实。')
    expect(result.count).toBeGreaterThan(0)
  })

  it('保留英文短语内部的正常空格', () => {
    const result = removeRedundantSpaces('请使用 OpenAI API 进行测试')

    expect(result.text).toBe('请使用 OpenAI API 进行测试')
  })

  it('清理行首尾空格和连续空行', () => {
    const result = removeRedundantSpaces('  标题  \n\n\n  正文  ')

    expect(result.text).toBe('标题\n\n正文')
    expect(result.count).toBeGreaterThanOrEqual(3)
  })
})

describe('autoFixDocumentText', () => {
  it('组合修复英文标点和多余空格', () => {
    const result = autoFixDocumentText('各 单位: 请 认真 贯彻 落实, 确保成效!')

    expect(result.text).toBe('各单位：请认真贯彻落实，确保成效！')
    expect(result.punctuationCount).toBe(3)
    expect(result.whitespaceCount).toBeGreaterThan(0)
    expect(result.count).toBe(result.punctuationCount + result.whitespaceCount)
  })

  it('支持按配置关闭部分修复能力', () => {
    const result = autoFixDocumentText('各 单位: 请 认真 落实!', {
      convertEnglishPunctuation: false,
      removeRedundantSpaces: true,
    })

    expect(result.text).toBe('各单位: 请认真落实!')
    expect(result.punctuationCount).toBe(0)
    expect(result.whitespaceCount).toBeGreaterThan(0)
  })
})

describe('sanitizeText', () => {
  it('保持与组合修复结果一致', () => {
    expect(sanitizeText('附件: 1. 实施 方案').text).toBe('附件： 1. 实施方案')
  })
})
