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

  it('版记导出包含首末粗线、中间细线和左右空字缩进', async () => {
    const ast: GongwenAST = {
      title: null,
      body: [],
    }
    const config = {
      ...DEFAULT_CONFIG,
      specialOptions: {
        ...DEFAULT_CONFIG.specialOptions,
        showPageNumber: false,
      },
      footerNote: {
        ...DEFAULT_CONFIG.footerNote,
        enabled: true,
        cc: '甲单位',
        printer: '办公室',
        printDate: '2026年5月1日',
      },
    }

    const buffer = await Packer.toBuffer(buildDocument(ast, config))
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')?.async('string')

    expect(xml).toBeDefined()
    expect(xml).toContain('<w:top w:val="single" w:color="000000" w:sz="8"/>')
    expect(xml).toContain('<w:bottom w:val="single" w:color="000000" w:sz="8"/>')
    expect(xml).toContain('<w:insideH w:val="single" w:color="000000" w:sz="6"/>')
    expect(xml).toContain('抄送：甲单位。')
    // GB/T 9704 §7.4.2 四号字 14pt = 280 twips 一字缩进 -> left=1120 right=280 hanging=840
    expect(xml).toMatch(/<w:ind[^>]*w:left="1120"[^>]*w:right="280"[^>]*w:hanging="840"/)
  })

  it('导出页码使用配置的自定义页码字体（修复硬编码宋体 Bug）', async () => {
    const ast: GongwenAST = {
      title: { type: NodeType.DOCUMENT_TITLE, content: '测试页码字体', lineNumber: 1 },
      body: [{ type: NodeType.PARAGRAPH, content: '正文内容。', lineNumber: 2 }],
    }
    const config = {
      ...DEFAULT_CONFIG,
      specialOptions: {
        ...DEFAULT_CONFIG.specialOptions,
        showPageNumber: true,
        pageNumberFont: '仿宋_GB2312',
      },
    }

    const buffer = await Packer.toBuffer(buildDocument(ast, config))
    const zip = await JSZip.loadAsync(buffer)
    const footerXml = await zip.file('word/footer1.xml')?.async('string')

    expect(footerXml).toBeDefined()
    expect(footerXml).toContain('仿宋_GB2312')
  })

  it('多行文头标题仅在末行设置段后空行，行间不插多余空行', async () => {
    const ast: GongwenAST = {
      title: { type: NodeType.DOCUMENT_TITLE, content: '国务院办公厅\n关于测试的通知', lineNumber: 1 },
      body: [{ type: NodeType.PARAGRAPH, content: '正文内容。', lineNumber: 3 }],
    }

    const buffer = await Packer.toBuffer(buildDocument(ast, DEFAULT_CONFIG))
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')?.async('string')

    expect(xml).toBeDefined()
    expect(xml).toContain('w:after="0"')
    expect(xml).toContain('w:after="578"')
  })

  it('信函格式导出首页不显示页码并包含红色双线与版记省略印发信息', async () => {
    const ast: GongwenAST = {
      title: { type: NodeType.DOCUMENT_TITLE, content: '关于征求意见的函', lineNumber: 1 },
      body: [{ type: NodeType.PARAGRAPH, content: '正文。', lineNumber: 2 }],
    }
    const config = {
      ...DEFAULT_CONFIG,
      header: {
        ...DEFAULT_CONFIG.header,
        enabled: true,
        format: 'letter' as const,
        orgName: 'XX委员会',
        docNumber: 'X函〔2026〕1号',
      },
      footerNote: {
        ...DEFAULT_CONFIG.footerNote,
        enabled: true,
        cc: '甲单位',
        printer: '办公室',
        printDate: '2026年11月26日',
      },
    }

    const buffer = await Packer.toBuffer(buildDocument(ast, config))
    const zip = await JSZip.loadAsync(buffer)
    const docXml = await zip.file('word/document.xml')?.async('string')

    expect(docXml).toContain('<w:titlePg/>')
    expect(docXml).toContain('thickThinSmallGap')
    expect(docXml).toContain('抄送：甲单位。')
    expect(docXml).not.toContain('印发')
  })

  it('自定义 PNG 版头图片正确打包到 word/media/', async () => {
    // 1x1 像素透明 PNG
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const ast: GongwenAST = {
      title: { type: NodeType.DOCUMENT_TITLE, content: '测试图片红头', lineNumber: 1 },
      body: [{ type: NodeType.PARAGRAPH, content: '正文。', lineNumber: 2 }],
    }
    const config = {
      ...DEFAULT_CONFIG,
      header: {
        ...DEFAULT_CONFIG.header,
        enabled: true,
        customImageDataUrl: tinyPng,
      },
    }

    const buffer = await Packer.toBuffer(buildDocument(ast, config))
    const zip = await JSZip.loadAsync(buffer)
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'))
    expect(mediaFiles.length).toBeGreaterThan(0)
  })
})
