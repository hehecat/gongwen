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
  onOpenOutline: () => void
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
  onOpenOutline,
  onOpenSanitizeSettings,
}: StatusBarProps) {
  const stats = useMemo(() => {
    const cjkChars = (rawText.match(/[\u4e00-\u9fff]/g) ?? []).length
    const nonSpaceChars = rawText.replace(/\s+/g, '').length
    let h1 = 0
    let h2 = 0
    let h3 = 0
    let attachments = 0
    for (const node of ast.body) {
      if (node.type === NodeType.HEADING_1) h1++
      else if (node.type === NodeType.HEADING_2) h2++
      else if (node.type === NodeType.HEADING_3) h3++
      else if (node.type === NodeType.ATTACHMENT) attachments++
    }
    return {
      cjkChars,
      nonSpaceChars,
      nodeCount: (ast.title ? 1 : 0) + ast.body.length,
      h1,
      h2,
      h3,
      attachments,
    }
  }, [ast.body, ast.title, rawText])

  return (
    <footer className="status-bar" aria-label="文档状态栏">
      <div className="status-bar-left">
        <span className="status-item">字数 {stats.nonSpaceChars}（汉字 {stats.cjkChars}）</span>
        <span className="status-item">段落 {stats.nodeCount}</span>
        <span className="status-item">第 {pageCount} 页</span>
        {(stats.h1 > 0 || stats.h2 > 0 || stats.h3 > 0 || stats.attachments > 0) && (
          <span className="status-item status-item--muted">
            结构 {stats.h1} / {stats.h2} / {stats.h3}
            {stats.attachments > 0 ? ` · 附件 ${stats.attachments}` : ''}
          </span>
        )}
      </div>

      <div className="status-bar-right">
        {overrideCount > 0 && (
          <button
            type="button"
            className="status-action status-action--accent"
            onClick={onOpenOutline}
            title="在右侧检查器查看与管理手动结构标注"
          >
            手动标注 {overrideCount} 处
          </button>
        )}
        <button
          type="button"
          className="status-action"
          onClick={onOpenSanitizeSettings}
          title="点击调整标点净化与解析规则"
        >
          {sanitizeEnabled
            ? `标点净化：已启用 (${sanitizeCount})`
            : '标点净化：已关闭'}
        </button>
        <span className="status-save">
          {saveState === 'saving' ? '正在保存…' : '已保存'}
        </span>
      </div>
    </footer>
  )
}
