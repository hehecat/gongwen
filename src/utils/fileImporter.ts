/**
 * 文件导入工具
 *
 * 支持 .docx（mammoth 提取纯文本）和 .txt（直接读取），
 * .doc/.wps 给出明确的格式转换提示。
 */

import mammoth from 'mammoth'

export interface ImportResult {
  /** 提取并规范化后的纯文本 */
  text: string
  /** 源文件名 */
  fileName: string
}

/**
 * 从文件提取纯文本
 * - .docx: mammoth.extractRawText
 * - .txt: FileReader.readAsText
 * - .doc/.wps: 抛出友好错误提示
 */
export async function importFile(file: File): Promise<ImportResult> {
  const ext = getExtension(file.name)

  switch (ext) {
    case '.docx': {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      return {
        text: normalizeImportedText(result.value),
        fileName: file.name,
      }
    }
    case '.txt': {
      const raw = await file.text()
      return {
        text: normalizeImportedText(raw),
        fileName: file.name,
      }
    }
    case '.doc':
    case '.wps':
      throw new Error('不支持 .doc/.wps 格式，请先用 WPS 或 Word 另存为 .docx 文件')
    default:
      throw new Error('不支持的文件格式，仅支持 .docx 和 .txt 文件')
  }
}

/** 提取文件扩展名（小写） */
function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return fileName.slice(dotIndex).toLowerCase()
}

/**
 * 后处理：将 mammoth 输出的双换行段落分隔规范化
 * - 连续 2+ 空行 → 单换行
 * - 行首尾 trim
 */
function normalizeImportedText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
