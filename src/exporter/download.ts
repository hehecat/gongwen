import { Packer } from 'docx'
import { saveAs } from 'file-saver'
import { NodeType, type GongwenAST } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { buildDocument } from './docxBuilder'

export interface ExportStatus {
  stage: 'building' | 'packing' | 'saving'
  message: string
}

const MULTIPART_EXPORT_THRESHOLD = 15000
const MULTIPART_EXPORT_CHUNK_SIZE = 8000

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

function getBaseFileName(ast: GongwenAST): string {
  return ast.title?.content || '公文'
}

function getPartFileName(baseName: string, part: number, total: number): string {
  if (total <= 1) return `${baseName}.docx`
  const width = String(total).length
  return `${baseName}-第${String(part).padStart(width, '0')}部分.docx`
}

function getPartTitle(ast: GongwenAST, part: number, total: number): GongwenAST['title'] {
  if (!ast.title) return null
  if (total <= 1) return ast.title
  return {
    ...ast.title,
    content: `${ast.title.content}（第${part}部分/共${total}部分）`,
  }
}

export function splitAstForLargeExport(
  ast: GongwenAST,
  chunkSize = MULTIPART_EXPORT_CHUNK_SIZE,
): GongwenAST[] {
  if (ast.body.length === 0 || ast.body.length <= chunkSize) {
    return [ast]
  }

  const chunks: GongwenAST[] = []
  let start = 0

  while (start < ast.body.length) {
    let end = Math.min(start + chunkSize, ast.body.length)

    // 避免把署名和成文日期拆到两个文件里。
    if (
      end < ast.body.length &&
      ast.body[end - 1]?.type === NodeType.SIGNATURE &&
      ast.body[end]?.type === NodeType.DATE
    ) {
      end -= 1
    }

    if (end <= start) {
      end = Math.min(start + chunkSize, ast.body.length)
    }

    chunks.push({
      title: ast.title,
      body: ast.body.slice(start, end),
    })
    start = end
  }

  const total = chunks.length
  return chunks.map((chunk, index) => ({
    title: getPartTitle(ast, index + 1, total),
    body: chunk.body,
  }))
}

async function saveDocx(
  ast: GongwenAST,
  config: DocumentConfig,
  fileName: string,
  onStatusChange?: (status: ExportStatus) => void,
): Promise<void> {
  onStatusChange?.({ stage: 'building', message: '正在生成文档结构…' })
  await yieldToMainThread()
  const doc = buildDocument(ast, config)

  onStatusChange?.({ stage: 'packing', message: '正在打包 Word 文件…' })
  await yieldToMainThread()
  const blob = await Packer.toBlob(doc)

  onStatusChange?.({ stage: 'saving', message: '正在触发下载…' })
  saveAs(blob, fileName)
}

/**
 * 将 AST 导出为 .docx 文件并触发浏览器下载
 * 文件名取公文标题，若无标题则用默认名
 */
export async function downloadDocx(
  ast: GongwenAST,
  config: DocumentConfig,
  onStatusChange?: (status: ExportStatus) => void,
): Promise<void> {
  if (ast.body.length > MULTIPART_EXPORT_THRESHOLD) {
    const parts = splitAstForLargeExport(ast)
    const confirmed = typeof window === 'undefined' || window.confirm(
      `当前文档共 ${ast.body.length} 段。单个 Word 导出可能导致浏览器卡死或标签页崩溃。\n\n将自动拆分为 ${parts.length} 个 Word 文件分别下载，是否继续？`,
    )

    if (!confirmed) return

    const baseName = getBaseFileName(ast)
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      const current = index + 1
      const total = parts.length

      await saveDocx(
        part,
        config,
        getPartFileName(baseName, current, total),
        ({ stage, message }) => {
          onStatusChange?.({
            stage,
            message: `第 ${current}/${total} 部分：${message}`,
          })
        },
      )

      await yieldToMainThread()
    }
    return
  }

  await saveDocx(
    ast,
    config,
    `${getBaseFileName(ast)}.docx`,
    onStatusChange,
  )
}
