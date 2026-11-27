import { useEffect, useRef, useState } from 'react'
import type { ExportStatus } from '../exporter/download'
import type { DocumentDraft } from '../hooks/useDocumentDrafts'
import type { SampleDocument } from '../utils/sampleDocuments'
import {
  AlertIcon,
  BookSpecIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FileDocIcon,
  MoreHorizontalIcon,
  PlusIcon,
  PrinterIcon,
  SidebarRightIcon,
  TrashIcon,
  UploadIcon,
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

  desktopMode: DesktopViewMode
  onChangeDesktopMode: (mode: DesktopViewMode) => void

  issueCount: number
  errorCount: number
  hasContent: boolean
  onOpenChecker: () => void

  inspectorOpen: boolean
  onToggleInspector: () => void

  onImportFiles: (files: FileList | null) => void
  onClearText: () => void
  onCopySanitized: () => Promise<boolean>
  samples: SampleDocument[]
  onLoadSample: (sample: SampleDocument) => void

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

const DESKTOP_MODE_OPTIONS: { value: DesktopViewMode; label: string }[] = [
  { value: 'split', label: '双栏对照' },
  { value: 'write', label: '专注起草' },
  { value: 'preview', label: '版面审阅' },
]

export function TopConsole({
  drafts,
  activeDraft,
  saveState,
  onSelectDraft,
  onCreateDraft,
  onDeleteDraft,
  desktopMode,
  onChangeDesktopMode,
  issueCount,
  errorCount,
  hasContent,
  onOpenChecker,
  inspectorOpen,
  onToggleInspector,
  onImportFiles,
  onClearText,
  onCopySanitized,
  samples,
  onLoadSample,
  onOpenSpecModal,
  onPrint,
  onExportDocx,
  exportStatus,
}: TopConsoleProps) {
  const [openMenu, setOpenMenu] = useState<'drafts' | 'more' | null>(null)
  const [confirmDeleteDraftId, setConfirmDeleteDraftId] = useState<string | null>(null)
  const leftClusterRef = useRef<HTMLDivElement | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!openMenu) return

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      const insideLeft = Boolean(leftClusterRef.current?.contains(target))
      const insideMore = Boolean(moreMenuRef.current?.contains(target))
      if (!insideLeft && !insideMore) {
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

  return (
    <header className="cb-topbar cb-no-print">
      {/* Left Cluster: Brand Mark + Draft Switcher */}
      <div className="cb-topbar-left" ref={leftClusterRef}>
        <div className="cb-brand" title="GB/T 9704—2012 公文排版工作台">
          <span className="cb-brand-seal">
            <SealMarkLogo />
          </span>
          <span className="cb-brand-name">公文纸案</span>
        </div>

        <span className="cb-topbar-sep" aria-hidden="true" />

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
            {saveState === 'saving' && (
              <span className="cb-save-indicator is-saving" title="正在自动保存至本地">
                保存中
              </span>
            )}
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
      </div>

      {/* Right Cluster: Import, Clear, Conditional Issues (Desktop), Inspector Toggle, Primary Export, More */}
      <div className="cb-topbar-right">
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.txt"
          className="cb-sr-only"
          onChange={(e) => {
            onImportFiles(e.target.files)
            e.target.value = ''
          }}
        />

        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--ghost"
          title="导入本地 .docx 或 .txt 公文原稿（也支持直接拖拽至窗口）"
          aria-label="导入文稿"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon size={14} />
          <span className="cb-hide-mobile">导入</span>
        </button>

        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--ghost cb-ctrl-btn--muted cb-hide-mobile"
          disabled={!hasContent}
          title="清空当前文稿（可一键撤销）"
          onClick={onClearText}
        >
          <TrashIcon size={14} />
          <span>清空</span>
        </button>

        {hasContent && issueCount > 0 && (
          <button
            type="button"
            className={`cb-compliance-pill cb-tabular cb-hide-mobile ${errorCount > 0 ? 'is-err' : 'is-warn'}`}
            title="查看 GB/T 9704 规范校对详情"
            onClick={onOpenChecker}
          >
            <AlertIcon size={14} />
            <span>{issueCount} 项待规范</span>
          </button>
        )}

        <button
          type="button"
          className={`cb-ctrl-btn cb-ctrl-btn--ghost cb-hide-mobile${inspectorOpen ? ' is-active' : ''}`}
          title={inspectorOpen ? '收起右侧排版台' : '展开右侧排版台'}
          aria-label={inspectorOpen ? '收起右侧排版台' : '展开右侧排版台'}
          aria-pressed={inspectorOpen}
          onClick={onToggleInspector}
        >
          <SidebarRightIcon size={14.5} />
          <span>排版</span>
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
              <span>
                导出<span className="cb-hide-xs"> Word</span>
              </span>
            </>
          )}
        </button>

        <div className="cb-popover-anchor" ref={moreMenuRef}>
          <button
            type="button"
            className={`cb-ctrl-btn cb-ctrl-btn--icon${openMenu === 'more' ? ' is-open' : ''}`}
            aria-expanded={openMenu === 'more'}
            aria-label="更多操作"
            title="更多操作"
            onClick={() => setOpenMenu((prev) => (prev === 'more' ? null : 'more'))}
          >
            <MoreHorizontalIcon size={16} />
          </button>

          {openMenu === 'more' && (
            <div className="cb-popover cb-popover--right cb-popover--more" role="dialog" aria-label="更多操作">
              <div className="cb-more-list">
                <button
                  type="button"
                  className="cb-more-item"
                  onClick={() => {
                    setOpenMenu(null)
                    onPrint()
                  }}
                >
                  <span className="cb-more-item-left">
                    <PrinterIcon size={14} className="cb-more-icon" />
                    <span>打印 / 另存为 PDF</span>
                  </span>
                  <span className="cb-more-hint cb-hide-mobile">{formatShortcut('P')}</span>
                </button>

                <button
                  type="button"
                  className="cb-more-item"
                  disabled={!hasContent}
                  onClick={() => {
                    setOpenMenu(null)
                    void onCopySanitized()
                  }}
                >
                  <span className="cb-more-item-left">
                    <CopyIcon size={14} className="cb-more-icon" />
                    <span>复制净化后纯文本</span>
                  </span>
                </button>

                <button
                  type="button"
                  className="cb-more-item cb-show-mobile"
                  disabled={!hasContent}
                  onClick={() => {
                    setOpenMenu(null)
                    onClearText()
                  }}
                >
                  <span className="cb-more-item-left">
                    <TrashIcon size={14} className="cb-more-icon" />
                    <span>清空当前文稿</span>
                  </span>
                </button>
              </div>

              <div className="cb-popover-divider" />
              <div className="cb-popover-section-label">载入标准范文</div>
              <div className="cb-more-list">
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="cb-more-item"
                    title={sample.description}
                    onClick={() => {
                      onLoadSample(sample)
                      setOpenMenu(null)
                    }}
                  >
                    <span className="cb-more-item-left">
                      <FileDocIcon size={13.5} className="cb-more-icon" />
                      <span>{sample.label}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="cb-popover-divider cb-hide-mobile" />
              <div className="cb-popover-section-label cb-hide-mobile">工作区视图</div>
              <div className="cb-more-list cb-hide-mobile">
                {DESKTOP_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`cb-more-item${desktopMode === opt.value ? ' is-selected' : ''}`}
                    onClick={() => {
                      onChangeDesktopMode(opt.value)
                      setOpenMenu(null)
                    }}
                  >
                    <span className="cb-more-item-left">
                      <span>{opt.label}</span>
                    </span>
                    {desktopMode === opt.value && <CheckIcon size={13.5} className="cb-menu-check" />}
                  </button>
                ))}
              </div>

              <div className="cb-popover-divider" />
              <div className="cb-more-list">
                <button
                  type="button"
                  className="cb-more-item"
                  onClick={() => {
                    setOpenMenu(null)
                    onOpenSpecModal()
                  }}
                >
                  <span className="cb-more-item-left">
                    <BookSpecIcon size={14} className="cb-more-icon" />
                    <span>GB/T 9704 速查与关于</span>
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
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
