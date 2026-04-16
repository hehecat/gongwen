import { describe, expect, it } from 'vitest'
import {
  createCharacterFirstLineIndent,
  getAttachmentParagraphStyle,
  getParagraphStyle,
  getRunStyle,
  shouldUseCharacterFirstLineIndent,
} from '../styleFactory'
import { NodeType } from '../../types/ast'
import { DEFAULT_CONFIG } from '../../types/documentConfig'

describe('getParagraphStyle', () => {
  it('正文段落保留首行缩进', () => {
    const style = getParagraphStyle(NodeType.PARAGRAPH, DEFAULT_CONFIG)

    expect(style.indent).toMatchObject({ left: 0 })
    expect(style.indent).toHaveProperty('firstLine')
  })

  it('主送机关默认不再额外设置段前', () => {
    const style = getParagraphStyle(NodeType.ADDRESSEE, DEFAULT_CONFIG)

    expect(style.spacing).toMatchObject({ before: 0, after: 0 })
  })

  it('正文类段落使用字符级首行缩进', () => {
    expect(shouldUseCharacterFirstLineIndent(NodeType.PARAGRAPH)).toBe(true)
    expect(shouldUseCharacterFirstLineIndent(NodeType.HEADING_1)).toBe(true)
    expect(shouldUseCharacterFirstLineIndent(NodeType.ADDRESSEE)).toBe(false)
  })

  it('字符级首行缩进组件输出 firstLineChars', () => {
    const indent = createCharacterFirstLineIndent(DEFAULT_CONFIG)
    const xml = indent.prepForXml({ stack: [] } as never)

    expect(xml).toMatchObject({
      'w:ind': {
        _attr: {
          'w:left': 0,
          'w:firstLineChars': 200,
        },
      },
    })
  })
})

describe('getAttachmentParagraphStyle', () => {
  it('附件默认保留段前空一行', () => {
    const style = getAttachmentParagraphStyle(false, false, DEFAULT_CONFIG)

    expect(style.spacing).toHaveProperty('before')
  })

  it('标题后首个附件可去掉段前', () => {
    const style = getAttachmentParagraphStyle(false, false, DEFAULT_CONFIG, true)

    expect(style.spacing).not.toHaveProperty('before')
  })
})

describe('getRunStyle', () => {
  it('一级标题显式使用黑色文字，避免继承 Word 默认蓝色标题样式', () => {
    const style = getRunStyle(NodeType.HEADING_1, DEFAULT_CONFIG)

    expect(style.color).toBe('000000')
  })

  it('四级标题显式关闭斜体，避免继承 Word Heading4 默认斜体', () => {
    const style = getRunStyle(NodeType.HEADING_4, DEFAULT_CONFIG)

    expect(style.italics).toBe(false)
  })

  it('三级标题默认加粗', () => {
    const style = getRunStyle(NodeType.HEADING_3, DEFAULT_CONFIG)

    expect(style.bold).toBe(true)
  })

  it('可关闭三级标题加粗', () => {
    const style = getRunStyle(NodeType.HEADING_3, {
      ...DEFAULT_CONFIG,
      specialOptions: {
        ...DEFAULT_CONFIG.specialOptions,
        boldHeading3: false,
      },
    })

    expect(style.bold).toBe(false)
  })

  it('附件说明显式使用黑色文字', () => {
    const style = getRunStyle(NodeType.PARAGRAPH, DEFAULT_CONFIG)

    expect(style.color).toBe('000000')
  })
})
