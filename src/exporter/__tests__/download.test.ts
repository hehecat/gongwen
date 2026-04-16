import { describe, expect, it } from 'vitest'
import { NodeType, type GongwenAST } from '../../types/ast'
import { splitAstForLargeExport } from '../download'

describe('splitAstForLargeExport', () => {
  it('超大文档按块拆分，并给每部分标题追加序号', () => {
    const ast: GongwenAST = {
      title: { type: NodeType.DOCUMENT_TITLE, content: '关于测试拆分导出的通知', lineNumber: 1 },
      body: Array.from({ length: 5 }, (_, index) => ({
        type: NodeType.PARAGRAPH,
        content: `第${index + 1}段`,
        lineNumber: index + 2,
      })),
    }

    const parts = splitAstForLargeExport(ast, 2)

    expect(parts).toHaveLength(3)
    expect(parts[0].title?.content).toBe('关于测试拆分导出的通知（第1部分/共3部分）')
    expect(parts[1].title?.content).toBe('关于测试拆分导出的通知（第2部分/共3部分）')
    expect(parts[2].title?.content).toBe('关于测试拆分导出的通知（第3部分/共3部分）')
    expect(parts.map((part) => part.body.length)).toEqual([2, 2, 1])
  })

  it('不会把署名和日期拆到两个文件中', () => {
    const ast: GongwenAST = {
      title: { type: NodeType.DOCUMENT_TITLE, content: '关于测试署名日期的通知', lineNumber: 1 },
      body: [
        { type: NodeType.PARAGRAPH, content: '正文1', lineNumber: 2 },
        { type: NodeType.SIGNATURE, content: '某某单位', lineNumber: 3 },
        { type: NodeType.DATE, content: '2026年4月16日', lineNumber: 4 },
        { type: NodeType.PARAGRAPH, content: '正文2', lineNumber: 5 },
      ],
    }

    const parts = splitAstForLargeExport(ast, 2)

    expect(parts).toHaveLength(3)
    expect(parts[0].body.map((node) => node.type)).toEqual([NodeType.PARAGRAPH])
    expect(parts[1].body.map((node) => node.type)).toEqual([NodeType.SIGNATURE, NodeType.DATE])
    expect(parts[2].body.map((node) => node.type)).toEqual([NodeType.PARAGRAPH])
  })
})
