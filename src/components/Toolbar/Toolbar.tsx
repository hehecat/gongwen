import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { GongwenAST } from '../../types/ast'
import type { DocumentDraft } from '../../hooks/useDocumentDrafts'
import { SAMPLE_DOCUMENTS, type SampleDocument } from '../../utils/sampleDocuments'
import type { ViewLayoutMode } from '../Preview/Preview'
import './Toolbar.css'

interface ToolbarProps {
  ast: GongwenAST
  drafts: DocumentDraft[]
  activeDraft: DocumentDraft
  layoutMode: ViewLayoutMode
  onChangeLayoutMode: (mode: ViewLayoutMode) => void
  onSelectDraft: (draftId: string) => void
  onCreateDraft: () => void
  onDeleteDraft: (draftId: string) => void
  onLoadSample: (sample: SampleDocument) => void
  onClear: () => void
  onCopySanitized: () => void
  onImport: (file: File) => void
  onPrint: () => void
  onExport: () => void
  inspectorOpen: boolean
  onToggleInspector: () => void
  issueCount: number
  onOpenTemplatesModal: () => void
  onOpenAboutModal: () => void
  importing?: boolean
  exporting?: boolean
  exportStatusMessage?: string
}

const LAYOUT_OPTIONS: { value: ViewLayoutMode; label: string; title: string }[] = [
  { value: 'split', label: '双栏', title: '左右对照编辑与 A4 预览' },
  { value: 'editor', label: '写作', title: '专注正文编写' },
  { value: 'preview', label: '纯预览', title: '全幅查看 A4 排版效果' },
]

export const Toolbar = memo(function Toolbar({
  ast,
  drafts,
  activeDraft,
  layoutMode,
  onChangeLayoutMode,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  onLoadSample,
  onClear,
  onCopySanitized,
  onImport,
  onPrint,
  onExport,
  inspectorOpen,
  onToggleInspector,
  issueCount,
  onOpenTemplatesModal,
  onOpenAboutModal,
  importing,
  exporting,
  exportStatusMessage,
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<'doc' | 'more' | null>(null)
  const docMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasContent = ast.title !== null || ast.body.length > 0
  const hasRawText = activeDraft.text.trim().length > 0
  const displayVersion = __APP_VERSION__.split('-')[0]

  useEffect(() => {
    if (!openMenu) return
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        docMenuRef.current?.contains(target)
        || moreMenuRef.current?.contains(target)
      ) {
        return
      }
      setOpenMenu(null)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleKey)
    }
  }, [openMenu])

  const handleImportClick = useCallback(() => {
    setOpenMenu(null)
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }, [onImport])

  const docTitle = activeDraft.title && activeDraft.title !== '空白草稿'
    ? activeDraft.title
    : '未命名公文'

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-brand" title={`公文排版工具 v${displayVersion}`}>
          <svg className="toolbar-logo" width="24" height="24" viewBox="0 0 512 512" aria-hidden="true">
            <rect width="512" height="512" rx="92" fill="#b91c1c" />
            <rect x="96" y="74" width="320" height="364" rx="18" fill="#ffffff" />
            <line x1="128" y1="154" x2="384" y2="154" stroke="#b91c1c" strokeWidth="14" />
            <rect x="144" y="190" width="224" height="18" rx="4" fill="#0f172a" />
            <rect x="144" y="232" width="224" height="14" rx="4" fill="#94a3b8" />
            <rect x="144" y="268" width="180" height="14" rx="4" fill="#94a3b8" />
            <polygon points="256,88 263,110 286,110 267,124 274,146 256,132 238,146 245,124 226,110 249,110" fill="#b91c1c" />
          </svg>
        </div>

        {/* 文档胶囊菜单：草稿箱 / 导入清理 / 国标示例 */}
        <div className="toolbar-popover-wrap" ref={docMenuRef}>
          <button
            type="button"
            className={`toolbar-doc-pill ${openMenu === 'doc' ? 'toolbar-doc-pill--open' : ''}`}
            onClick={() => setOpenMenu((prev) => (prev === 'doc' ? null : 'doc'))}
            aria-expanded={openMenu === 'doc'}
            title="切换草稿、导入文件或载入 GB/T 9704 示例"
          >
            <span className="toolbar-doc-pill-name">{docTitle}</span>
            {drafts.length > 1 && (
              <span className="toolbar-doc-pill-count">({drafts.length})</span>
            )}
            <svg className="toolbar-caret" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {openMenu === 'doc' && (
            <div className="toolbar-popover toolbar-popover--left" role="menu" aria-label="文档与草稿菜单">
              <div className="toolbar-pop-section">
                <div className="toolbar-pop-head">
                  <span className="toolbar-pop-label">草稿箱 ({drafts.length})</span>
                  <button
                    type="button"
                    className="toolbar-pop-inline-btn"
                    onClick={() => {
                      onCreateDraft()
                      setOpenMenu(null)
                    }}
                  >
                    + 新建草稿
                  </button>
                </div>
                <div className="toolbar-draft-list">
                  {drafts.map((draft, idx) => {
                    const isActive = draft.id === activeDraft.id
                    return (
                      <div
                        key={draft.id}
                        className={`toolbar-draft-row ${isActive ? 'toolbar-draft-row--active' : ''}`}
                      >
                        <button
                          type="button"
                          className="toolbar-draft-select"
                          onClick={() => {
                            onSelectDraft(draft.id)
                            setOpenMenu(null)
                          }}
                        >
                          <span className="toolbar-draft-check" aria-hidden="true">
                            {isActive ? '✓' : ''}
                          </span>
                          <span className="toolbar-draft-name">
                            {draft.title || `草稿 ${idx + 1}`}
                          </span>
                        </button>
                        {drafts.length > 1 && (
                          <button
                            type="button"
                            className="toolbar-draft-delete"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenu(null)
                              onDeleteDraft(draft.id)
                            }}
                            title={`删除草稿「${draft.title}」`}
                            aria-label={`删除草稿「${draft.title}」`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="toolbar-pop-divider" />

              <div className="toolbar-pop-section">
                <span className="toolbar-pop-label toolbar-pop-label--padded">文件与清理</span>
                <button
                  type="button"
                  className="toolbar-pop-item"
                  onClick={handleImportClick}
                  disabled={importing}
                >
                  <span className="toolbar-pop-item-title">
                    {importing ? '正在导入文件…' : '导入 Word / TXT 文件…'}
                  </span>
                  <span className="toolbar-pop-item-desc">支持 .docx / .txt，也可直接拖入编辑区</span>
                </button>
                <button
                  type="button"
                  className="toolbar-pop-item toolbar-pop-item--danger"
                  onClick={() => {
                    setOpenMenu(null)
                    onClear()
                  }}
                  disabled={!hasRawText}
                >
                  <span className="toolbar-pop-item-title">清空当前草稿</span>
                  <span className="toolbar-pop-item-desc">清空后 6 秒内支持撤销恢复</span>
                </button>
              </div>

              <div className="toolbar-pop-divider" />

              <div className="toolbar-pop-section">
                <span className="toolbar-pop-label toolbar-pop-label--padded">从 GB/T 9704 示例起步</span>
                {SAMPLE_DOCUMENTS.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="toolbar-pop-item"
                    onClick={() => {
                      setOpenMenu(null)
                      onLoadSample(sample)
                    }}
                  >
                    <span className="toolbar-pop-item-title">{sample.label}</span>
                    <span className="toolbar-pop-item-desc">{sample.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 全局唯一视图模式切换 */}
      <div className="toolbar-center">
        <div className="toolbar-segmented" role="group" aria-label="视图模式">
          {LAYOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`toolbar-seg-btn ${layoutMode === opt.value ? 'toolbar-seg-btn--active' : ''}`}
              onClick={() => onChangeLayoutMode(opt.value)}
              title={opt.title}
              aria-pressed={layoutMode === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧输出与面板控制 */}
      <div className="toolbar-right">
        <button
          type="button"
          className="toolbar-btn toolbar-btn--flat"
          onClick={onPrint}
          disabled={!hasContent}
          title="打印或另存为标准 A4 PDF"
        >
          打印
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-btn--primary"
          onClick={onExport}
          disabled={!hasContent || exporting}
          title="导出 Word 文档 (Cmd/Ctrl+S)"
        >
          {exporting ? (exportStatusMessage || '导出中…') : '导出 Word'}
        </button>

        <span className="toolbar-sep" aria-hidden="true" />

        <button
          type="button"
          className={`toolbar-btn toolbar-btn--flat ${inspectorOpen ? 'toolbar-btn--active' : ''}`}
          onClick={onToggleInspector}
          aria-expanded={inspectorOpen}
          title="展开或收起版式、结构与校对面板 (Cmd/Ctrl+\)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.35" />
            <line x1="10.2" y1="2.5" x2="10.2" y2="13.5" stroke="currentColor" strokeWidth="1.35" />
          </svg>
          <span>面板</span>
          {issueCount > 0 && (
            <span className="toolbar-badge" aria-label={`${issueCount} 项规范提醒`}>
              {issueCount}
            </span>
          )}
        </button>

        <div className="toolbar-popover-wrap" ref={moreMenuRef}>
          <button
            type="button"
            className={`toolbar-btn toolbar-btn--icon ${openMenu === 'more' ? 'toolbar-btn--active' : ''}`}
            onClick={() => setOpenMenu((prev) => (prev === 'more' ? null : 'more'))}
            aria-expanded={openMenu === 'more'}
            aria-label="更多功能与国标速查"
            title="复制净稿、管理模板、国标速查与关于"
          >
            ⋯
          </button>

          {openMenu === 'more' && (
            <div className="toolbar-popover toolbar-popover--right toolbar-popover--compact" role="menu" aria-label="更多操作">
              <button
                type="button"
                className="toolbar-pop-item"
                disabled={!hasRawText}
                onClick={() => {
                  setOpenMenu(null)
                  onCopySanitized()
                }}
              >
                <span className="toolbar-pop-item-title">复制净稿</span>
                <span className="toolbar-pop-item-desc">复制全角标点净化后的纯文本</span>
              </button>
              <button
                type="button"
                className="toolbar-pop-item"
                onClick={() => {
                  setOpenMenu(null)
                  onOpenTemplatesModal()
                }}
              >
                <span className="toolbar-pop-item-title">管理我的模板…</span>
                <span className="toolbar-pop-item-desc">保存、导入导出、置顶与重命名模板</span>
              </button>

              <div className="toolbar-pop-divider" />

              <button
                type="button"
                className="toolbar-pop-item"
                onClick={() => {
                  setOpenMenu(null)
                  onOpenAboutModal()
                }}
              >
                <span className="toolbar-pop-item-title">GB/T 9704 速查与关于</span>
                <span className="toolbar-pop-item-desc">国标排版参数、单文件离线版与更新说明</span>
              </button>

              <div className="toolbar-pop-version">公文排版工具 v{displayVersion}</div>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.txt,.doc,.wps"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </header>
  )
})
