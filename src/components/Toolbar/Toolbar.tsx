import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { GongwenAST } from '../../types/ast'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates'
import type { DocumentDraft } from '../../hooks/useDocumentDrafts'
import { BUILTIN_TEMPLATES } from '../../utils/builtinTemplates'
import { SAMPLE_DOCUMENTS, type SampleDocument } from '../../utils/sampleDocuments'
import type { SettingsTabId } from '../SettingsDrawer/SettingsDrawer'
import './Toolbar.css'

interface ToolbarProps {
  ast: GongwenAST
  drafts: DocumentDraft[]
  activeDraftId: string
  onSelectDraft: (draftId: string) => void
  onCreateDraft: () => void
  onDeleteDraft: (draftId: string) => void
  onLoadSample: (sample: SampleDocument) => void
  onApplyBuiltinTemplate: (templateId: string) => void
  onOpenSettings: (tab?: SettingsTabId) => void
  settingsOpen: boolean
  onToggleChecker: () => void
  checkerOpen: boolean
  issueCount: number
  onImport: (file: File) => void
  onPrint: () => void
  onExport: () => void
  importing?: boolean
  exporting?: boolean
  exportStatusMessage?: string
}

export const Toolbar = memo(function Toolbar({
  ast,
  drafts,
  activeDraftId,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  onLoadSample,
  onApplyBuiltinTemplate,
  onOpenSettings,
  settingsOpen,
  onToggleChecker,
  checkerOpen,
  issueCount,
  onImport,
  onPrint,
  onExport,
  importing,
  exporting,
  exportStatusMessage,
}: ToolbarProps) {
  const { config, updateConfig, replaceConfig } = useDocumentConfig()
  const { activeTemplateMeta, applyTemplate, templates } = useDocumentTemplates(config, replaceConfig)
  const [showSampleMenu, setShowSampleMenu] = useState(false)
  const sampleMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasContent = ast.title !== null || ast.body.length > 0
  const displayVersion = __APP_VERSION__.split('-')[0]

  useEffect(() => {
    if (!showSampleMenu) return
    const handleOutside = (e: MouseEvent) => {
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(e.target as Node)) {
        setShowSampleMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showSampleMenu])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }, [onImport])

  const handleQuickTemplateChange = (value: string) => {
    if (!value) return
    if (value.startsWith('builtin:')) {
      onApplyBuiltinTemplate(value.slice('builtin:'.length))
      return
    }
    if (value.startsWith('user:')) {
      applyTemplate(value.slice('user:'.length))
    }
  }

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-brand">
          <svg className="toolbar-logo" width="22" height="22" viewBox="0 0 512 512" aria-hidden="true">
            <rect width="512" height="512" rx="84" fill="#c0392b" />
            <rect x="96" y="72" width="320" height="368" rx="18" fill="#ffffff" />
            <line x1="128" y1="154" x2="384" y2="154" stroke="#c0392b" strokeWidth="14" />
            <rect x="144" y="188" width="224" height="18" rx="4" fill="#334155" />
            <rect x="144" y="230" width="224" height="14" rx="4" fill="#94a3b8" />
            <rect x="144" y="264" width="180" height="14" rx="4" fill="#94a3b8" />
            <polygon points="256,88 263,110 286,110 267,124 274,146 256,132 238,146 245,124 226,110 249,110" fill="#c0392b" />
          </svg>
          <h1 className="toolbar-title">公文排版工具</h1>
          <span className="toolbar-version">{displayVersion}</span>
        </div>

        {/* 多草稿切换 */}
        <div className="toolbar-group" aria-label="草稿切换">
          <select
            className="toolbar-select"
            aria-label="选择草稿"
            value={activeDraftId}
            onChange={(e) => onSelectDraft(e.target.value)}
          >
            {drafts.map((draft, idx) => (
              <option key={draft.id} value={draft.id}>
                草稿 {idx + 1}: {draft.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={onCreateDraft}
            title="新建空白草稿"
          >
            +
          </button>
          {drafts.length > 1 && (
            <button
              type="button"
              className="toolbar-icon-btn toolbar-icon-btn--danger"
              onClick={() => onDeleteDraft(activeDraftId)}
              title="删除当前草稿"
            >
              ×
            </button>
          )}
        </div>

        {/* 快速套用模板 */}
        <select
          className="toolbar-select toolbar-select--template"
          aria-label="快速套用模板"
          value={activeTemplateMeta ? `user:${activeTemplateMeta.templateId}` : ''}
          onChange={(e) => handleQuickTemplateChange(e.target.value)}
        >
          <option value="" disabled>
            快速套用模板…
          </option>
          <optgroup label="GB/T 9704 国标预设">
            {BUILTIN_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={`builtin:${tpl.id}`}>
                {tpl.name}
              </option>
            ))}
          </optgroup>
          {templates.length > 0 && (
            <optgroup label="我的模板">
              {templates.map((tpl) => (
                <option key={tpl.id} value={`user:${tpl.id}`}>
                  {tpl.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="toolbar-right">
        <button
          type="button"
          className={`toolbar-toggle ${config.header.enabled ? 'toolbar-toggle--active' : ''}`}
          onClick={() => updateConfig({ header: { enabled: !config.header.enabled } })}
          title="快速开启或关闭版头"
        >
          版头
        </button>
        <button
          type="button"
          className={`toolbar-toggle ${config.footerNote.enabled ? 'toolbar-toggle--active' : ''}`}
          onClick={() => updateConfig({ footerNote: { enabled: !config.footerNote.enabled } })}
          title="快速开启或关闭版记"
        >
          版记
        </button>

        <button
          type="button"
          className={`toolbar-btn toolbar-btn--neutral ${checkerOpen ? 'toolbar-btn--active' : ''}`}
          onClick={onToggleChecker}
          title="GB/T 9704 公文规范体检"
        >
          <span>体检</span>
          {issueCount > 0 && <span className="toolbar-badge">{issueCount}</span>}
        </button>

        <div className="toolbar-dropdown" ref={sampleMenuRef}>
          <button
            type="button"
            className="toolbar-btn toolbar-btn--neutral"
            onClick={() => setShowSampleMenu((prev) => !prev)}
            aria-expanded={showSampleMenu}
          >
            示例 ▾
          </button>
          {showSampleMenu && (
            <div className="toolbar-menu">
              {SAMPLE_DOCUMENTS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className="toolbar-menu-item"
                  onClick={() => {
                    setShowSampleMenu(false)
                    onLoadSample(sample)
                  }}
                >
                  <span className="toolbar-menu-item-title">{sample.label}</span>
                  <span className="toolbar-menu-item-desc">{sample.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className={`toolbar-btn toolbar-btn--neutral ${settingsOpen ? 'toolbar-btn--active' : ''}`}
          onClick={() => onOpenSettings()}
          title="格式与版式设置"
        >
          设置
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-btn--import"
          onClick={handleImportClick}
          disabled={importing}
          title="导入 .docx 或 .txt 文件"
        >
          {importing ? '导入中…' : '导入'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.txt,.doc,.wps"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className="toolbar-btn toolbar-btn--neutral"
          onClick={onPrint}
          disabled={!hasContent}
          title="打印或另存为标准 A4 PDF"
        >
          打印 / PDF
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-btn--export"
          onClick={onExport}
          disabled={!hasContent || exporting}
          title="导出 Word 文档 (Cmd/Ctrl+S)"
        >
          {exporting ? (exportStatusMessage || '导出中…') : '导出 Word'}
        </button>
      </div>
    </header>
  )
})
