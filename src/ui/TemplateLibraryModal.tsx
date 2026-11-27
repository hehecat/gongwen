import { useEffect, useMemo, useRef, useState } from 'react'
import type { DocumentConfig } from '../types/documentConfig'
import type {
  DocumentTemplate,
  ImportedDocumentTemplateCollectionDraft,
} from '../types/documentTemplate'
import type { BuiltinTemplate } from '../utils/builtinTemplates'
import {
  buildTemplateSummary,
  suggestUniqueTemplateName,
} from '../utils/documentTemplates'
import { SegmentedControl } from './FormControls'
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  DownloadIcon,
  PinIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from './icons'
import { formatShortTimestamp } from './nodeMeta'

interface ConflictState {
  existingTemplate: DocumentTemplate
  suggestedName: string
}

interface TemplateLibraryModalProps {
  initialMode: 'list' | 'create'
  config: DocumentConfig
  builtinTemplates: BuiltinTemplate[]
  activeBuiltinId: string | null
  onApplyBuiltin: (preset: BuiltinTemplate) => void

  templates: DocumentTemplate[]
  activeTemplate: DocumentTemplate | null
  isActiveTemplateDirty: boolean
  pinnedTemplateIds: string[]
  onApplyTemplate: (templateId: string) => void
  onSaveCurrentAsTemplate: (input: {
    name: string
    description: string
    overwriteTemplateId?: string
  }) =>
    | { status: 'conflict'; conflict: ConflictState }
    | { status: 'success'; result: { action: 'created' | 'updated'; template: DocumentTemplate } }
  onUpdateTemplateMeta: (
    templateId: string,
    values: { name: string; description: string },
  ) =>
    | { status: 'conflict'; conflict: ConflictState }
    | { status: 'success'; result: { action: 'created' | 'updated'; template: DocumentTemplate } }
  onCopyTemplate: (templateId: string) => DocumentTemplate
  onDeleteTemplate: (templateId: string) => void
  onPinTemplate: (templateId: string) => void
  onUnpinTemplate: (templateId: string) => void
  onExportAllTemplates: () => Promise<void>
  onReadTemplateCollectionFile: (
    file: File,
  ) => Promise<ImportedDocumentTemplateCollectionDraft>
  onImportTemplateCollectionDraft: (
    collection: ImportedDocumentTemplateCollectionDraft,
  ) => { importedTemplates: DocumentTemplate[]; skippedNames: string[] }

  onClose: () => void
  onNotifySuccess: (msg: string, detail?: string) => void
  onNotifyError: (msg: string) => void
}

export function TemplateLibraryModal({
  initialMode,
  config,
  builtinTemplates,
  activeBuiltinId,
  onApplyBuiltin,
  templates,
  activeTemplate,
  isActiveTemplateDirty,
  pinnedTemplateIds,
  onApplyTemplate,
  onSaveCurrentAsTemplate,
  onUpdateTemplateMeta,
  onCopyTemplate,
  onDeleteTemplate,
  onPinTemplate,
  onUnpinTemplate,
  onExportAllTemplates,
  onReadTemplateCollectionFile,
  onImportTemplateCollectionDraft,
  onClose,
  onNotifySuccess,
  onNotifyError,
}: TemplateLibraryModalProps) {
  const [tab, setTab] = useState<'list' | 'create'>(initialMode)
  const [draftName, setDraftName] = useState(() =>
    suggestUniqueTemplateName(
      activeTemplate ? `${activeTemplate.name} 新版` : '单位公文标准模板',
      templates.map((t) => t.name),
    ),
  )
  const [draftDesc, setDraftDesc] = useState('')
  const [saveConflict, setSaveConflict] = useState<ConflictState | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editConflict, setEditConflict] = useState<ConflictState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const importInputRef = useRef<HTMLInputElement | null>(null)
  const currentSummary = useMemo(() => buildTemplateSummary(config), [config])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleCreateSubmit = (overwriteTemplateId?: string, overrideName?: string) => {
    try {
      const targetName = overrideName ?? draftName
      const res = onSaveCurrentAsTemplate({
        name: targetName,
        description: draftDesc,
        overwriteTemplateId,
      })
      if (res.status === 'conflict') {
        setSaveConflict(res.conflict)
        return
      }
      setSaveConflict(null)
      onNotifySuccess(
        res.result.action === 'updated'
          ? `已覆盖更新模板「${res.result.template.name}」`
          : `已保存新模板「${res.result.template.name}」`,
      )
      setTab('list')
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : '保存模板失败')
    }
  }

  const handleSaveDirtyBackToActive = () => {
    if (!activeTemplate) return
    try {
      const res = onSaveCurrentAsTemplate({
        name: activeTemplate.name,
        description: activeTemplate.description,
        overwriteTemplateId: activeTemplate.id,
      })
      if (res.status === 'success') {
        onNotifySuccess(`已将最新参数保存回模板「${activeTemplate.name}」`)
      }
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : '更新模板失败')
    }
  }

  const startEdit = (tpl: DocumentTemplate) => {
    setEditingId(tpl.id)
    setEditName(tpl.name)
    setEditDesc(tpl.description)
    setEditConflict(null)
  }

  const commitEdit = (tplId: string, overrideName?: string) => {
    try {
      const res = onUpdateTemplateMeta(tplId, {
        name: overrideName ?? editName,
        description: editDesc,
      })
      if (res.status === 'conflict') {
        setEditConflict(res.conflict)
        return
      }
      setEditingId(null)
      setEditConflict(null)
      onNotifySuccess(`已更新模板「${res.result.template.name}」信息`)
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : '修改模板信息失败')
    }
  }

  const handleOverwriteConfigWithCurrent = (tpl: DocumentTemplate) => {
    try {
      const res = onSaveCurrentAsTemplate({
        name: tpl.name,
        description: tpl.description,
        overwriteTemplateId: tpl.id,
      })
      if (res.status === 'success') {
        onNotifySuccess(`已用当前版式覆盖「${tpl.name}」`)
      }
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : '覆盖模板失败')
    }
  }

  const handleImportJson = async (file: File | undefined) => {
    if (!file) return
    try {
      const collection = await onReadTemplateCollectionFile(file)
      const { importedTemplates, skippedNames } =
        onImportTemplateCollectionDraft(collection)

      if (importedTemplates.length === 0 && skippedNames.length > 0) {
        onNotifyError(`未导入新模板：${skippedNames.length} 个同名模板已存在`)
        return
      }

      const detail =
        skippedNames.length > 0
          ? `已跳过 ${skippedNames.length} 个同名模板：${skippedNames.slice(0, 3).join('、')}`
          : undefined
      onNotifySuccess(`成功导入 ${importedTemplates.length} 个模板`, detail)
      setTab('list')
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : '模板文件解析失败')
    }
  }

  const handleExportJson = async () => {
    try {
      await onExportAllTemplates()
      onNotifySuccess(`已导出全部 ${templates.length} 个自定义模板`)
    } catch (err) {
      onNotifyError(err instanceof Error ? err.message : '导出模板失败')
    }
  }

  return (
    <div
      className="cb-modal-backdrop cb-no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cb-modal cb-modal--lg"
        role="dialog"
        aria-modal="true"
        aria-label="版式预设与模板库管理"
      >
        <header className="cb-modal-head">
          <div>
            <h2 className="cb-modal-title">版式预设与自定义模板库</h2>
            <p className="cb-modal-sub">
              沉淀机关单位常用红头、字距、页边距与版记配置，支持 JSON 离线迁移备份
            </p>
          </div>
          <button
            type="button"
            className="cb-modal-close"
            aria-label="关闭窗口"
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="cb-modal-toolbar">
          <SegmentedControl<'list' | 'create'>
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'list', label: `全部模板（${templates.length + 5}）` },
              { value: 'create', label: '存为新模板' },
            ]}
          />

          <div className="cb-modal-toolbar-right">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="cb-sr-only"
              onChange={(e) => {
                void handleImportJson(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="cb-ctrl-btn cb-ctrl-btn--secondary"
              onClick={() => importInputRef.current?.click()}
            >
              <UploadIcon size={13.5} />
              <span>导入 JSON</span>
            </button>
            <button
              type="button"
              className="cb-ctrl-btn cb-ctrl-btn--secondary"
              disabled={templates.length === 0}
              onClick={() => void handleExportJson()}
            >
              <DownloadIcon size={13.5} />
              <span>导出备份</span>
            </button>
          </div>
        </div>

        <div className="cb-modal-body">
          {tab === 'create' ? (
            <div className="cb-tpl-create-pane">
              <div className="cb-field">
                <label className="cb-label">模板名称</label>
                <input
                  type="text"
                  className="cb-input"
                  placeholder="例如：市政府办公厅通用红头通知"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value)
                    setSaveConflict(null)
                  }}
                />
              </div>

              <div className="cb-field">
                <label className="cb-label">用途说明（选填）</label>
                <input
                  type="text"
                  className="cb-input"
                  placeholder="例如：含发文字号、抄送及加盖印章参数"
                  value={draftDesc}
                  onChange={(e) => setDraftDesc(e.target.value)}
                />
              </div>

              {saveConflict && (
                <div className="cb-conflict-box">
                  <div className="cb-conflict-text">
                    已存在同名模板「{saveConflict.existingTemplate.name}」，请选择处理方式：
                  </div>
                  <div className="cb-conflict-actions">
                    <button
                      type="button"
                      className="cb-ctrl-btn cb-ctrl-btn--secondary"
                      onClick={() =>
                        handleCreateSubmit(saveConflict.existingTemplate.id)
                      }
                    >
                      覆盖同名模板
                    </button>
                    <button
                      type="button"
                      className="cb-ctrl-btn cb-ctrl-btn--primary"
                      onClick={() => {
                        setDraftName(saveConflict.suggestedName)
                        handleCreateSubmit(undefined, saveConflict.suggestedName)
                      }}
                    >
                      改存为「{saveConflict.suggestedName}」
                    </button>
                  </div>
                </div>
              )}

              {/* Live Current Style Summary Preview */}
              <div className="cb-tpl-summary-box">
                <div className="cb-subhead">当前即将保存的版式摘要</div>
                <div className="cb-tpl-summary-lines">
                  <div>
                    <span className="cb-tpl-k">标题：</span>
                    <span>
                      {currentSummary.titleStyle.fontFamily} ·{' '}
                      {currentSummary.titleStyle.fontSizeLabel} · 行距{' '}
                      {currentSummary.titleStyle.lineSpacingLabel}
                    </span>
                  </div>
                  <div>
                    <span className="cb-tpl-k">正文：</span>
                    <span>
                      {currentSummary.bodyStyle.fontFamily}
                      {currentSummary.bodyStyle.auxiliaryFontFamily
                        ? ` + ${currentSummary.bodyStyle.auxiliaryFontFamily}`
                        : ''}{' '}
                      · {currentSummary.bodyStyle.fontSizeLabel} · 行距{' '}
                      {currentSummary.bodyStyle.lineSpacingLabel} ·{' '}
                      {currentSummary.bodyStyle.firstLineIndentLabel}
                    </span>
                  </div>
                  <div className="cb-tpl-tags">
                    {currentSummary.featureTags.map((tag) => (
                      <span key={tag} className="cb-tpl-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="cb-tpl-create-foot">
                <button
                  type="button"
                  className="cb-ctrl-btn cb-ctrl-btn--ghost"
                  onClick={() => setTab('list')}
                >
                  返回列表
                </button>
                <button
                  type="button"
                  className="cb-ctrl-btn cb-ctrl-btn--primary"
                  onClick={() => handleCreateSubmit()}
                >
                  <PlusIcon size={14} />
                  <span>保存为自定义模板</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="cb-tpl-list-pane">
              {/* Dirty Active Template Banner */}
              {activeTemplate && isActiveTemplateDirty && (
                <div className="cb-dirty-banner">
                  <span>
                    当前正在使用「{activeTemplate.name}」，且您对版式参数做了新的微调。
                  </span>
                  <button
                    type="button"
                    className="cb-btn-inline-primary"
                    onClick={handleSaveDirtyBackToActive}
                  >
                    保存修改回此模板
                  </button>
                </div>
              )}

              {/* Custom Templates Section */}
              <div className="cb-tpl-group">
                <div className="cb-tpl-group-head">
                  <span className="cb-subhead">自建模板库（最多可置顶 6 个常用模板）</span>
                  <button
                    type="button"
                    className="cb-link-btn"
                    onClick={() => setTab('create')}
                  >
                    <PlusIcon size={12.5} />
                    <span>保存当前版式</span>
                  </button>
                </div>

                {templates.length === 0 ? (
                  <div className="cb-tpl-empty">
                    尚未保存自建模板。调整好机关红头、字体与版记后，点击「将当前版式存为新模板」即可随时复用。
                  </div>
                ) : (
                  <div className="cb-tpl-cards">
                    {templates.map((tpl) => {
                      const isPinned = pinnedTemplateIds.includes(tpl.id)
                      const isActive = activeTemplate?.id === tpl.id
                      const summary = buildTemplateSummary(tpl.config)
                      const isEditing = editingId === tpl.id
                      const isConfirmDel = confirmDeleteId === tpl.id

                      return (
                        <div
                          key={tpl.id}
                          className={`cb-tpl-card${isActive ? ' is-active' : ''}`}
                        >
                          {isEditing ? (
                            <div className="cb-tpl-edit-form">
                              <div className="cb-grid-2">
                                <input
                                  type="text"
                                  className="cb-input"
                                  value={editName}
                                  placeholder="模板名称"
                                  onChange={(e) => {
                                    setEditName(e.target.value)
                                    setEditConflict(null)
                                  }}
                                />
                                <input
                                  type="text"
                                  className="cb-input"
                                  value={editDesc}
                                  placeholder="模板备注说明"
                                  onChange={(e) => setEditDesc(e.target.value)}
                                />
                              </div>
                              {editConflict && (
                                <div className="cb-conflict-inline">
                                  <span>名称冲突，可改用「{editConflict.suggestedName}」</span>
                                  <button
                                    type="button"
                                    className="cb-link-btn"
                                    onClick={() =>
                                      commitEdit(tpl.id, editConflict.suggestedName)
                                    }
                                  >
                                    使用建议名称保存
                                  </button>
                                </div>
                              )}
                              <div className="cb-tpl-edit-actions">
                                <button
                                  type="button"
                                  className="cb-ctrl-btn cb-ctrl-btn--ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  className="cb-ctrl-btn cb-ctrl-btn--primary"
                                  onClick={() => commitEdit(tpl.id)}
                                >
                                  保存信息
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="cb-tpl-card-top">
                                <div className="cb-tpl-card-title-row">
                                  <button
                                    type="button"
                                    className={`cb-pin-btn${isPinned ? ' is-pinned' : ''}`}
                                    title={isPinned ? '取消常用置顶' : '置顶为常用模板'}
                                    onClick={() => {
                                      try {
                                        if (isPinned) {
                                          onUnpinTemplate(tpl.id)
                                        } else {
                                          onPinTemplate(tpl.id)
                                        }
                                      } catch (err) {
                                        onNotifyError(
                                          err instanceof Error ? err.message : '置顶操作失败',
                                        )
                                      }
                                    }}
                                  >
                                    <PinIcon size={13.5} filled={isPinned} />
                                  </button>
                                  <span className="cb-tpl-card-name">{tpl.name}</span>
                                  {isActive && (
                                    <span className="cb-tpl-active-pill">
                                      {isActiveTemplateDirty ? '当前 · 已微调' : '当前使用'}
                                    </span>
                                  )}
                                  <span className="cb-tpl-time cb-tabular">
                                    {formatShortTimestamp(tpl.updatedAt)}
                                  </span>
                                </div>

                                <div className="cb-tpl-card-btns">
                                  <button
                                    type="button"
                                    className="cb-ctrl-btn cb-ctrl-btn--secondary"
                                    onClick={() => {
                                      onApplyTemplate(tpl.id)
                                      onNotifySuccess(`已套用模板「${tpl.name}」`)
                                    }}
                                  >
                                    <CheckIcon size={13} />
                                    <span>套用</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="cb-bar-btn"
                                    onClick={() => startEdit(tpl)}
                                  >
                                    重命名
                                  </button>
                                  <button
                                    type="button"
                                    className="cb-bar-btn"
                                    title="用当前工作台中的最新排版参数覆盖此模板"
                                    onClick={() => handleOverwriteConfigWithCurrent(tpl)}
                                  >
                                    覆盖参数
                                  </button>
                                  <button
                                    type="button"
                                    className="cb-bar-btn"
                                    title="复制一份副本"
                                    onClick={() => {
                                      const copied = onCopyTemplate(tpl.id)
                                      onNotifySuccess(`已创建副本「${copied.name}」`)
                                    }}
                                  >
                                    <CopyIcon size={13} />
                                  </button>
                                  {isConfirmDel ? (
                                    <button
                                      type="button"
                                      className="cb-draft-del-confirm"
                                      onClick={() => {
                                        onDeleteTemplate(tpl.id)
                                        setConfirmDeleteId(null)
                                        onNotifySuccess(`已删除模板「${tpl.name}」`)
                                      }}
                                    >
                                      确认删除
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="cb-icon-danger-btn"
                                      aria-label="删除模板"
                                      onClick={() => setConfirmDeleteId(tpl.id)}
                                    >
                                      <TrashIcon size={13.5} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {tpl.description && (
                                <div className="cb-tpl-card-desc">{tpl.description}</div>
                              )}

                              <div className="cb-tpl-tags">
                                <span className="cb-tpl-tag">
                                  标题 {summary.titleStyle.fontFamily}{' '}
                                  {summary.titleStyle.fontSizeLabel}
                                </span>
                                <span className="cb-tpl-tag">
                                  正文 {summary.bodyStyle.fontFamily}{' '}
                                  {summary.bodyStyle.lineSpacingLabel}
                                </span>
                                {summary.featureTags.map((tag) => (
                                  <span key={tag} className="cb-tpl-tag">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Built-in GB/T 9704 Presets */}
              <div className="cb-tpl-group">
                <div className="cb-subhead">内置 GB/T 9704—2012 法定预设</div>
                <div className="cb-tpl-cards">
                  {builtinTemplates.map((preset) => {
                    const selected = preset.id === activeBuiltinId
                    return (
                      <div
                        key={preset.id}
                        className={`cb-tpl-card${selected ? ' is-active' : ''}`}
                      >
                        <div className="cb-tpl-card-top">
                          <div className="cb-tpl-card-title-row">
                            <span className="cb-tpl-card-name">{preset.name}</span>
                            <span className="cb-menu-tag">{preset.badge}</span>
                          </div>
                          <button
                            type="button"
                            className="cb-ctrl-btn cb-ctrl-btn--secondary"
                            onClick={() => {
                              onApplyBuiltin(preset)
                              onClose()
                            }}
                          >
                            <span>套用预设</span>
                          </button>
                        </div>
                        <div className="cb-tpl-card-desc">{preset.description}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
