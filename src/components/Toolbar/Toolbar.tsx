import { useState } from 'react'
import type { GongwenAST } from '../../types/ast'
import { SettingsModal } from '../SettingsModal/SettingsModal'
import './Toolbar.css'

interface ToolbarProps {
  ast: GongwenAST
  onExport: () => void
  onClear: () => void
}

export function Toolbar({ ast, onExport, onClear }: ToolbarProps) {
  const hasContent = ast.title !== null || ast.body.length > 0
  const nodeCount = (ast.title ? 1 : 0) + ast.body.length
  const [showSettings, setShowSettings] = useState(false)

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <h1 className="toolbar-title">公文排版工具</h1>
        <span className="toolbar-badge">GB/T 9704</span>
      </div>
      <div className="toolbar-right">
        {hasContent && (
          <span className="toolbar-stats">
            已识别 {nodeCount} 个段落
          </span>
        )}
        <button
          className="toolbar-btn toolbar-btn--settings"
          onClick={() => setShowSettings(true)}
          title="格式设置"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.5 1L6.87 2.96C6.08 3.24 5.37 3.67 4.77 4.22L2.87 3.5L1.37 6.1L2.93 7.4C2.85 7.76 2.8 8.12 2.8 8.5C2.8 8.88 2.85 9.24 2.93 9.6L1.37 10.9L2.87 13.5L4.77 12.78C5.37 13.33 6.08 13.76 6.87 14.04L7.25 16H9.75L10.13 14.04C10.92 13.76 11.63 13.33 12.23 12.78L14.13 13.5L15.63 10.9L14.07 9.6C14.15 9.24 14.2 8.88 14.2 8.5C14.2 8.12 14.15 7.76 14.07 7.4L15.63 6.1L14.13 3.5L12.23 4.22C11.63 3.67 10.92 3.24 10.13 2.96L9.75 1H6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            <circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
          <span>格式设置</span>
        </button>
        <button
          className="toolbar-btn toolbar-btn--clear"
          onClick={onClear}
          disabled={!hasContent}
        >
          清空
        </button>
        <button
          className="toolbar-btn toolbar-btn--export"
          onClick={onExport}
          disabled={!hasContent}
        >
          导出 Word
        </button>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
