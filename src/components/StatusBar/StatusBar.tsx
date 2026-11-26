import { useMemo } from 'react'
import { NodeType, type GongwenAST } from '../../types/ast'
import './StatusBar.css'

interface StatusBarProps {
  rawText: string
  ast: GongwenAST
  pageCount: number
  sanitizeCount: number
  sanitizeEnabled: boolean
  overrideCount: number
  saveState: 'saved' | 'saving'
  onOpenSanitizeSettings: () => void
}

export function StatusBar({
  rawText,
  ast,
  pageCount,
  sanitizeCount,
  sanitizeEnabled,
  overrideCount,
  saveState,
  onOpenSanitizeSettings,
}: StatusBarProps) {
  const stats = useMemo(() => {
    const cjkChars = (rawText.match(/[\u4e00-\u9fff]/g) ?? []).length
    const nonSpaceChars = rawText.replace(/\s+/g, '').length
    let h1 = 0
    let h2 = 0
    let h3 = 0
    let h4 = 0
    let attachments = 0
    for (const node of ast.body) {
      if (node.type === NodeType.HEADING_1) h1++
      else if (node.type === NodeType.HEADING_2) h2++
      else if (node.type === NodeType.HEADING_3) h3++
      else if (node.type === NodeType.HEADING_4) h4++
      else if (node.type === NodeType.ATTACHMENT) attachments++
    }
    return {
      cjkChars,
      nonSpaceChars,
      nodeCount: (ast.title ? 1 : 0) + ast.body.length,
      h1,
      h2,
      h3,
      h4,
      attachments,
    }
  }, [ast.body, ast.title, rawText])

  return (
    <footer className="status-bar" aria-label="文档状态栏">
      <div className="status-bar-left">
        <span className="status-item">字数 {stats.nonSpaceChars}（汉字 {stats.cjkChars}）</span>
        <span className="status-sep">·</span>
        <span className="status-item">段落 {stats.nodeCount}</span>
        <span className="status-sep">·</span>
        <span className="status-item">共 {pageCount} 页</span>
        {(stats.h1 > 0 || stats.h2 > 0 || stats.h3 > 0 || stats.attachments > 0) && (
          <>
            <span className="status-sep">·</span>
            <span className="status-item status-item--muted">
              结构：一级 {stats.h1} / 二级 {stats.h2} / 三级 {stats.h3}
              {stats.attachments > 0 ? ` / 附件 ${stats.attachments}` : ''}
            </span>
          </>
        )}
      </div>
      <div className="status-bar-right">
        {overrideCount > 0 && (
          <span className="status-pill status-pill--info">
            手动标注 {overrideCount} 处
          </span>
        )}
        <button
          type="button"
          className="status-pill status-pill--clickable"
          onClick={onOpenSanitizeSettings}
          title="点击调整标点净化与解析规则"
        >
          {sanitizeEnabled
            ? `标点净化：已启用（优化 ${sanitizeCount} 处）`
            : '标点净化：已关闭'}
        </button>
        <span className="status-save">
          {saveState === 'saving' ? '正在保存…' : '已自动保存'}
        </span>
      </div>
    </footer>
  )
}
