import { Packer } from 'docx'
import { saveAs } from 'file-saver'
import type { GongwenAST } from '../types/ast'
import type { DocumentConfig } from '../types/documentConfig'
import { buildDocument } from './docxBuilder'

/**
 * 将 AST 导出为 .docx 文件并触发浏览器下载
 * 文件名取公文标题，若无标题则用默认名
 */
export async function downloadDocx(ast: GongwenAST, config: DocumentConfig): Promise<void> {
  const doc = buildDocument(ast, config)
  const blob = await Packer.toBlob(doc)
  const fileName = ast.title?.content
    ? `${ast.title.content}.docx`
    : '公文.docx'
  saveAs(blob, fileName)
}
