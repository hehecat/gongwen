import { describe, expect, it } from 'vitest'
import { AlignmentType, HeadingLevel, Packer } from 'docx'
import JSZip from 'jszip'
import { NodeType, type GongwenAST } from '../../types/ast'
import { DEFAULT_CONFIG } from '../../types/documentConfig'
import { buildDocument, getPageNumberParagraphOptions, getWordHeadingMeta } from '../docxBuilder'

describe('getPageNumberParagraphOptions', () => {
  it('国标样式使用单右双左', () => {
    const options = getPageNumberParagraphOptions('mirrored', 280)

    expect(options).toEqual({
      evenAndOddHeaderAndFooters: true,
      defaultOptions: {
        alignment: AlignmentType.RIGHT,
        indent: { right: 280 },
      },
      evenOptions: {
        alignment: AlignmentType.LEFT,
        indent: { left: 280 },
      },
    })
  })

  it('全居中样式关闭奇偶页差异', () => {
    const options = getPageNumberParagraphOptions('center', 280)

    expect(options).toEqual({
      evenAndOddHeaderAndFooters: false,
      defaultOptions: {
        alignment: AlignmentType.CENTER,
        indent: {},
      },
    })
  })
})

describe('getWordHeadingMeta', () => {
  it('一级到四级标题映射到 Word 标题层级', () => {
    expect(getWordHeadingMeta(NodeType.HEADING_1)).toEqual({
      heading: HeadingLevel.HEADING_1,
      outlineLevel: 0,
    })
    expect(getWordHeadingMeta(NodeType.HEADING_2)).toEqual({
      heading: HeadingLevel.HEADING_2,
      outlineLevel: 1,
    })
    expect(getWordHeadingMeta(NodeType.HEADING_3)).toEqual({
      heading: HeadingLevel.HEADING_3,
      outlineLevel: 2,
    })
    expect(getWordHeadingMeta(NodeType.HEADING_4)).toEqual({
      heading: HeadingLevel.HEADING_4,
      outlineLevel: 3,
    })
    expect(getWordHeadingMeta(NodeType.PARAGRAPH)).toBeUndefined()
  })

  it('导出的标题段落带有 Word 标题样式', async () => {
    const ast: GongwenAST = {
      title: null,
      body: [
        { type: NodeType.HEADING_1, content: '一、总体要求。后续内容', lineNumber: 1 },
        { type: NodeType.HEADING_2, content: '（一）工作目标。后续内容', lineNumber: 2 },
        { type: NodeType.HEADING_4, content: '（1）执行要求。后续内容', lineNumber: 3 },
        { type: NodeType.PARAGRAPH, content: '这是正文。', lineNumber: 4 },
      ],
    }

    const buffer = await Packer.toBuffer(buildDocument(ast, DEFAULT_CONFIG))
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')?.async('string')

    expect(xml).toBeDefined()
    expect(xml).toContain('w:pStyle w:val="Heading1"')
    expect(xml).toContain('w:pStyle w:val="Heading2"')
    expect(xml).toContain('w:pStyle w:val="Heading4"')
    expect(xml).toContain('w:outlineLvl w:val="0"')
    expect(xml).toContain('w:outlineLvl w:val="1"')
    expect(xml).toContain('w:i w:val="false"')
  })
})
