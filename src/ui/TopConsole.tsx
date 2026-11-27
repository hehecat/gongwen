import { useEffect, useRef, useState } from 'react'
import type { ExportStatus } from '../exporter/download'
import type { DocumentDraft } from '../hooks/useDocumentDrafts'
import type { BuiltinTemplate } from '../utils/builtinTemplates'
import type { DocumentTemplate, RecentTemplateItem } from '../types/documentTemplate'
import { SegmentedControl } from './FormControls'
import {
  AlertIcon,
  BookSpecIcon,
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileDocIcon,
  PinIcon,
  PlusIcon,
  PrinterIcon,
  SearchCommandIcon,
  ShieldCheckIcon,
  SidebarRightIcon,
  SwatchTemplateIcon,
  TrashIcon,
} from './icons'
import { formatShortcut, formatShortTimestamp } from './nodeMeta'

export type DesktopViewMode = 'split' | 'write' | 'preview'
export type MobileTabMode = 'write' | 'preview' | 'studio'

interface TopConsoleProps {
  drafts: DocumentDraft[]
  activeDraft: DocumentDraft
  saveState: 'saved' | 'saving'
  onSelectDraft: (id: string) => void
  onCreateDraft: () => void
  onDeleteDraft: (id: string) => void

  activePresetLabel: string
  isPresetModified: boolean
  builtinTemplates: BuiltinTemplate[]
  activeBuiltinId: string | null
  commonTemplates: RecentTemplateItem[]
  activeCustomTemplateId: string | null
  pinnedTemplateIds: string[]
  templateCount: number
  onApplyBuiltin: (preset: BuiltinTemplate) => void
  onApplyCustomTemplate: (templateId: string) => void
  onOpenTemplateModal: (initialMode?: 'list' | 'create') => void

  desktopMode: DesktopViewMode
  onChangeDesktopMode: (mode: DesktopViewMode) => void
  mobileTab: MobileTabMode
  onChangeMobileTab: (tab: MobileTabMode) => void

  issueCount: number
  errorCount: number
  hasContent: boolean
  onOpenChecker: () => void

  inspectorOpen: boolean
  onToggleInspector: () => void
  onOpenCommandPalette: () => void
  onOpenSpecModal: () => void
  onPrint: () => void
  onExportDocx: () => void
  exportStatus: ExportStatus | null
}

const EXPORT_STAGE_LABELS: Record<ExportStatus['stage'], string> = {
  building: '生成结构…',
  packing: '打包文档…',
  saving: '触发下载…',
}

export function TopConsole({
  drafts,
  activeDraft,
  saveState,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  activePresetLabel,
  isPresetModified,
  builtinTemplates,
  activeBuiltinId,
  commonTemplates,
  activeCustomTemplateId,
  pinnedTemplateIds,
  templateCount,
  onApplyBuiltin,
  onApplyCustomTemplate,
  onOpenTemplateModal,
  desktopMode,
  onChangeDesktopMode,
  mobileTab,
  onChangeMobileTab,
  issueCount,
  errorCount,
  hasContent,
  onOpenChecker,
  inspectorOpen,
  onToggleInspector,
  onOpenCommandPalette,
  onOpenSpecModal,
  onPrint,
  onExportDocx,
  exportStatus,
}: TopConsoleProps) {
  const [openMenu, setOpenMenu] = useState<'drafts' | 'templates' | null>(null)
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState<string | null>(null)
  const leftClusterRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!openMenu) return

    const handlePointerDown = (e: MouseEvent) => {
      if (leftClusterRef.current && !leftClusterRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setConfirmDeleteDraftId(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null)
        setConfirmDeleteDraftId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMenu])

  const renderCustomTemplateItem = (tpl: DocumentTemplate) => {
    const isCurrent = tpl.id === activeCustomTemplateId && !isPresetModified
    const isPinned = pinnedTemplateIds.includes(tpl.id)
    return (
      <button
        key={tpl.id}
        type="button"
        className={`cb-menu-item${isCurrent ? ' is-selected' : ''}`}
        onClick={() => {
          onApplyCustomTemplate(tpl.id)
          setOpenMenu(null)
        }}
      >
        <div className="cb-menu-item-main">
          <span className="cb-menu-item-title">
            {isPinned && <PinIcon size={12} filled className="cb-pin-inline" />}
            {tpl.name}
          </span>
          {tpl.description && (
            <span className="cb-menu-item-sub">{tpl.description}</span>
          )}
        </div>
        {isCurrent && <CheckIcon size={14} className="cb-menu-check" />}
      </button>
    )
  }

  return (
    <header className="cb-topbar cb-no-print">
      {/* Left Cluster: Brand Mark + Drafts + Active Preset */}
      <div className="cb-topbar-left" ref={leftClusterRef}>
        <div className="cb-brand" title="GB/T 9704—2012 公文排版工作台">
          <span className="cb-brand-seal">
            <SealMarkLogo />
          </span>
          <span className="cb-brand-name">公文纸案</span>
        </div>

        <span className="cb-topbar-sep" aria-hidden="true" />

        {/* Draft Switcher */}
        <div className="cb-popover-anchor">
          <button
            type="button"
            className={`cb-draft-trigger${openMenu === 'drafts' ? ' is-open' : ''}`}
            aria-expanded={openMenu === 'drafts'}
            onClick={() => {
              setConfirmDeleteDraftId(null)
              setOpenMenu((prev) => (prev === 'drafts' ? null : 'drafts'))
            }}
          >
            <FileDocIcon size={14} className="cb-trigger-icon" />
            <span className="cb-draft-title">{activeDraft.title}</span>
            <span
              className={`cb-save-indicator${saveState === 'saving' ? ' is-saving' : ''}`}
              title={saveState === 'saving' ? '正在自动保存至本地' : '已自动保存至浏览器本地'}
            >
              {saveState === 'saving' ? '保存中' : '已存'}
            </span>
            <ChevronDownIcon size={13} className="cb-trigger-chevron" />
          </button>

          {openMenu === 'drafts' && (
            <div className="cb-popover cb-popover--left cb-popover--drafts" role="dialog" aria-label="文稿列表">
              <div className="cb-popover-head">
                <span className="cb-popover-title cb-tabular">本地文稿（{drafts.length}）</span>
                <button
                  type="button"
                  className="cb-btn-inline-primary"
                  onClick={() => {
                    onCreateDraft()
                    setOpenMenu(null)
                  }}
                >
                  <PlusIcon size={13} />
                  <span>新建文稿</span>
                </button>
              </div>
              <div className="cb-draft-list">
                {drafts.map((draft) => {
                  const active = draft.id === activeDraft.id
                  const charCount = draft.text.replace(/\s/g, '').length
                  const isConfirming = confirmDeleteDraftId === draft.id

                  return (
                    <div
                      key={draft.id}
                      className={`cb-draft-row${active ? ' is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="cb-draft-select"
                        onClick={() => {
                          onSelectDraft(draft.id)
                          setOpenMenu(null)
                        }}
                      >
                        <span className="cb-draft-row-title">{draft.title}</span>
                        <span className="cb-draft-row-meta cb-tabular">
                          {charCount} 字 · {formatShortTimestamp(draft.updatedAt)}
                        </span>
                      </button>

                      {isConfirming ? (
                        <button
                          type="button"
                          className="cb-draft-del-confirm"
                          onClick={() => {
                            onDeleteDraft(draft.id)
                            setConfirmDeleteDraftId(null)
                          }}
                        >
                          {drafts.length <= 1 ? '确认清空' : '确认删除'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cb-draft-del"
                          aria-label={drafts.length <= 1 ? '重置此草稿' : '删除此草稿'}
                          title={drafts.length <= 1 ? '清空重置此草稿' : '删除此草稿'}
                          onClick={() => setConfirmDeleteDraftId(draft.id)}
                        >
                          <TrashIcon size={13} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="cb-popover-foot">
                全部文稿自动离线存储于本机浏览器，不上传任何服务器
              </div>
            </div>
          )}
        </div>

        {/* Preset / Template Quick Switcher */}
        <div className="cb-popover-anchor cb-hide-narrow">
          <button
            type="button"
            className={`cb-preset-trigger${openMenu === 'templates' ? ' is-open' : ''}`}
            aria-expanded={openMenu === 'templates'}
            onClick={() => setOpenMenu((prev) => (prev === 'templates' ? null : 'templates'))}
          >
            <SwatchTemplateIcon size={14} className="cb-trigger-icon" />
            <span className="cb-preset-name">{activePresetLabel}</span>
            {isPresetModified && (
              <span className="cb-dirty-dot" title="当前版式参数有未保存的微调" />
            )}
            <ChevronDownIcon size={13} className="cb-trigger-chevron" />
          </button>

          {openMenu === 'templates' && (
            <div className="cb-popover cb-popover--left cb-popover--templates" role="dialog" aria-label="版式预设与模板">
              <div className="cb-popover-section-label">GB/T 9704 法定预设</div>
              <div className="cb-menu-list">
                {builtinTemplates.map((preset) => {
                  const selected = preset.id === activeBuiltinId
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`cb-menu-item${selected ? ' is-selected' : ''}`}
                      onClick={() => {
                        onApplyBuiltin(preset)
                        setOpenMenu(null)
                      }}
                    >
                      <div className="cb-menu-item-main">
                        <span className="cb-menu-item-title">
                          {preset.name}
                          <span className="cb-menu-tag">{preset.badge}</span>
                        </span>
                        <span className="cb-menu-item-sub">{preset.description}</span>
                      </div>
                      {selected && <CheckIcon size={14} className="cb-menu-check" />}
                    </button>
                  )
                })}
              </div>

              {commonTemplates.length > 0 && (
                <>
                  <div className="cb-popover-divider" />
                  <div className="cb-popover-section-label">常用自建模板</div>
                  <div className="cb-menu-list">
                    {commonTemplates.map((item) => renderCustomTemplateItem(item.template))}
                  </div>
                </>
              )}

              <div className="cb-popover-divider" />
              <div className="cb-popover-actions-row">
                <button
                  type="button"
                  className="cb-popover-action-btn"
                  onClick={() => {
                    setOpenMenu(null)
                    onOpenTemplateModal('create')
                  }}
                >
                  <PlusIcon size={13} />
                  <span>将当前版式存为模板…</span>
                </button>
                <button
                  type="button"
                  className="cb-popover-action-btn cb-tabular"
                  onClick={() => {
                    setOpenMenu(null)
                    onOpenTemplateModal('list')
                  }}
                >
                  <span>管理模板库（{templateCount}）</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Cluster: Desktop View Mode / Mobile Tab Switcher */}
      <div className="cb-topbar-center">
        <div className="cb-desktop-modes">
          <SegmentedControl<DesktopViewMode>
            ariaLabel="工作台视图模式"
            size="sm"
            value={desktopMode}
            onChange={onChangeDesktopMode}
            options={[
              { value: 'split', label: '双栏对照' },
              { value: 'write', label: '专注起草' },
              { value: 'preview', label: '版面审阅' },
            ]}
          />
        </div>
        <div className="cb-mobile-modes">
          <SegmentedControl<MobileTabMode>
            ariaLabel="移动视图切换"
            size="sm"
            value={mobileTab}
            onChange={onChangeMobileTab}
            options={[
              { value: 'write', label: '文稿' },
              { value: 'preview', label: 'A4 预览' },
              {
                value: 'studio',
                label: issueCount > 0 ? `排版 · ${issueCount}` : '排版校对',
              },
            ]}
          />
        </div>
      </div>

      {/* Right Cluster: Command, Compliance, Reference, Print, Primary Export */}
      <div className="cb-topbar-right">
        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--ghost cb-hide-mobile"
          title={`命令面板 (${formatShortcut('K')})`}
          onClick={onOpenCommandPalette}
        >
          <SearchCommandIcon size={14} />
          <kbd className="cb-kbd">{formatShortcut('K')}</kbd>
        </button>

        {/* Compliance Status Pill */}
        <button
          type="button"
          className={`cb-compliance-pill cb-tabular ${
            issueCount === 0
              ? hasContent
                ? 'is-ok'
                : 'is-idle'
              : errorCount > 0
                ? 'is-err'
                : 'is-warn'
          }`}
          title="查看 GB/T 9704 规范校对详情"
          onClick={onOpenChecker}
        >
          {issueCount === 0 ? (
            <>
              <ShieldCheckIcon size={14} />
              <span className="cb-hide-mobile">{hasContent ? '符合国标' : '国标校对'}</span>
            </>
          ) : (
            <>
              <AlertIcon size={14} />
              <span>{issueCount} 项待规范</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--icon"
          title="GB/T 9704—2012 速查手册与关于"
          aria-label="GB/T 9704 速查与关于"
          onClick={onOpenSpecModal}
        >
          <BookSpecIcon size={15} />
        </button>

        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--icon cb-hide-mobile"
          title={inspectorOpen ? '收起右侧排版台' : '展开右侧排版台'}
          aria-label={inspectorOpen ? '收起右侧排版台' : '展开右侧排版台'}
          aria-pressed={inspectorOpen}
          onClick={onToggleInspector}
        >
          <SidebarRightIcon size={15} />
        </button>

        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--secondary"
          title={`打印或另存为 PDF (${formatShortcut('P')})`}
          aria-label="打印或另存为 PDF"
          onClick={onPrint}
        >
          <PrinterIcon size={14} />
          <span className="cb-hide-mobile">打印 / PDF</span>
        </button>

        <button
          type="button"
          className={`cb-ctrl-btn cb-ctrl-btn--primary${exportStatus ? ' is-busy' : ''}`}
          disabled={Boolean(exportStatus)}
          title={`导出标准 Word 公文 (${formatShortcut('S')})`}
          onClick={onExportDocx}
        >
          {exportStatus ? (
            <>
              <span className="cb-spinner" aria-hidden="true" />
              <span>{EXPORT_STAGE_LABELS[exportStatus.stage]}</span>
            </>
          ) : (
            <>
              <DownloadIcon size={14} />
              <span>导出 Word</span>
            </>
          )}
        </button>
      </div>
    </header>
  )
}

function SealMarkLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="2.25"
        y="2.25"
        width="15.5"
        height="15.5"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6.5 7h7M10 5.5v9M6.2 13h7.6"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  )
}
