import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { DocumentTemplate } from '../../types/documentTemplate'
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from '../../utils/builtinTemplates'
import { buildTemplateSummary, suggestUniqueTemplateName } from '../../utils/documentTemplates'
import type { DocumentTemplateStore } from '../Inspector/FormatTab'
import { ModalDialog } from '../common/ModalDialog'
import './TemplateManagerModal.css'

interface TemplateEditorState {
  kind: 'save-current' | 'edit-meta'
  title: string
  submitLabel: string
  name: string
  description: string
  overwriteTemplateId?: string
  pendingApplyTemplateId?: string
}

interface TemplateManagerModalProps {
  open: boolean
  initialAction?: 'browse' | 'create'
  templateStore: DocumentTemplateStore
  onApplyBuiltinTemplate: (templateId: string) => void
  onClose: () => void
}

function buildInitialCreateState(templateStore: DocumentTemplateStore): TemplateEditorState {
  const knownNames = templateStore.templates.map((t) => t.name)
  return {
    kind: 'save-current',
    title: '保存当前设置为模板',
    submitLabel: '保存模板',
    name: suggestUniqueTemplateName(
      templateStore.activeTemplateMeta
        ? `${templateStore.activeTemplateMeta.templateName} 调整版`
        : '新建公文模板',
      knownNames,
    ),
    description: '',
  }
}

function TemplateManagerModalContent({
  initialAction = 'browse',
  templateStore,
  onApplyBuiltinTemplate,
  onClose,
}: Omit<TemplateManagerModalProps, 'open'>) {
  const {
    activeTemplate,
    activeTemplateMeta,
    applyTemplate,
    copyTemplate,
    currentMatchingTemplate,
    deleteTemplate,
    exportAllTemplates,
    hasUnsavedCurrentConfig,
    importTemplateCollectionDraft,
    pinTemplate,
    pinnedTemplateIds,
    readTemplateCollectionFile,
    saveCurrentAsTemplate,
    templates,
    unpinTemplate,
    updateTemplateMeta,
  } = templateStore

  const importInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editorState, setEditorState] = useState<TemplateEditorState | null>(() => (
    initialAction === 'create' ? buildInitialCreateState(templateStore) : null
  ))
  const [editorError, setEditorError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingApplyTarget, setPendingApplyTarget] = useState<DocumentTemplate | null>(null)

  const knownNames = useMemo(() => templates.map((t) => t.name), [templates])
  const pinnedSet = useMemo(() => new Set(pinnedTemplateIds), [pinnedTemplateIds])
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    )
  }, [searchQuery, templates])

  function openCreateEditor(applyAfterSaveId?: string) {
    setNotice(null)
    setEditorError('')
    const draftName = suggestUniqueTemplateName(
      activeTemplateMeta ? `${activeTemplateMeta.templateName} 调整版` : '新建公文模板',
      knownNames,
    )
    setEditorState({
      kind: 'save-current',
      title: applyAfterSaveId ? '先保存当前设置再套用' : '保存当前设置为模板',
      submitLabel: applyAfterSaveId ? '保存并套用' : '保存模板',
      name: draftName,
      description: '',
      pendingApplyTemplateId: applyAfterSaveId,
    })
  }

  function openUpdateActive() {
    if (!activeTemplate) return
    setNotice(null)
    setEditorError('')
    setEditorState({
      kind: 'save-current',
      title: `更新模板「${activeTemplate.name}」`,
      submitLabel: '覆盖更新',
      name: activeTemplate.name,
      description: activeTemplate.description,
      overwriteTemplateId: activeTemplate.id,
    })
  }

  function openEditMeta(template: DocumentTemplate) {
    setNotice(null)
    setEditorError('')
    setEditorState({
      kind: 'edit-meta',
      title: `编辑模板「${template.name}」`,
      submitLabel: '保存修改',
      name: template.name,
      description: template.description,
      overwriteTemplateId: template.id,
    })
  }

  function handleEditorSubmit() {
    if (!editorState) return
    setEditorError('')

    try {
      if (editorState.kind === 'edit-meta') {
        const res = updateTemplateMeta(editorState.overwriteTemplateId!, {
          name: editorState.name,
          description: editorState.description,
        })
        if (res.status === 'conflict') {
          setEditorError(`模板名已存在，建议改为「${res.conflict.suggestedName}」。`)
          return
        }
        setNotice({ type: 'success', text: `已更新模板「${res.result.template.name}」。` })
        setEditorState(null)
        return
      }

      const res = saveCurrentAsTemplate({
        name: editorState.name,
        description: editorState.description,
        overwriteTemplateId: editorState.overwriteTemplateId,
      })
      if (res.status === 'conflict') {
        setEditorError(`模板名已存在，建议改为「${res.conflict.suggestedName}」。`)
        return
      }

      const nextApplyId = editorState.pendingApplyTemplateId
      setEditorState(null)

      if (nextApplyId) {
        applyTemplate(nextApplyId)
        setNotice({ type: 'success', text: '已保存当前设置并套用目标模板。' })
        return
      }

      setNotice({
        type: 'success',
        text: res.result.action === 'created'
          ? `已保存模板「${res.result.template.name}」。`
          : `已更新模板「${res.result.template.name}」。`,
      })
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : '操作失败')
    }
  }

  function handleApplyUserTemplate(template: DocumentTemplate) {
    setNotice(null)
    const needsProtect = hasUnsavedCurrentConfig && currentMatchingTemplate?.id !== template.id
    if (needsProtect) {
      setPendingApplyTarget(template)
      return
    }
    applyTemplate(template.id)
    setNotice({ type: 'success', text: `已套用模板「${template.name}」。` })
  }

  function handleCloneBuiltin(preset: BuiltinTemplate) {
    setNotice(null)
    const now = new Date().toISOString()
    const uniqueName = suggestUniqueTemplateName(preset.name, knownNames)
    const { importedTemplates } = importTemplateCollectionDraft({
      templates: [
        {
          name: uniqueName,
          description: preset.description,
          config: preset.config,
          createdAt: now,
          updatedAt: now,
        },
      ],
    })
    if (importedTemplates.length > 0) {
      setNotice({ type: 'success', text: `已复制「${importedTemplates[0].name}」到我的模板。` })
    }
  }

  async function handleImportTemplates(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setNotice(null)

    try {
      const collection = await readTemplateCollectionFile(file)
      const { importedTemplates, skippedNames } = importTemplateCollectionDraft(collection)
      if (importedTemplates.length === 0 && skippedNames.length === 0) {
        setNotice({ type: 'error', text: '文件中没有可导入的模板。' })
        return
      }
      if (importedTemplates.length === 0) {
        setNotice({ type: 'error', text: `全部重名跳过：${skippedNames.join('、')}` })
        return
      }
      setNotice({
        type: 'success',
        text: skippedNames.length > 0
          ? `已导入 ${importedTemplates.length} 个模板，跳过 ${skippedNames.length} 个重名模板。`
          : `已导入 ${importedTemplates.length} 个模板。`,
      })
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : '导入失败' })
    }
  }

  async function handleExportTemplates() {
    setNotice(null)
    try {
      await exportAllTemplates()
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : '导出失败' })
    }
  }

  return (
    <ModalDialog
      open
      title="模板管理"
      subtitle="统一管理本地公文版式模板与 GB/T 9704 国标预设，支持 JSON 导入导出与团队共享"
      maxWidth={680}
      onClose={onClose}
      footer={(
        <button type="button" className="tpl-btn tpl-btn--ghost" onClick={onClose}>
          关闭
        </button>
      )}
    >
      <div className="tpl-modal-stack">
        {notice && (
          <div className={`tpl-notice tpl-notice--${notice.type}`}>
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">✕</button>
          </div>
        )}

        {/* 我的模板库 */}
        <section className="tpl-section">
          <div className="tpl-section-head">
            <h3 className="tpl-section-title">我的模板 ({templates.length})</h3>
            <div className="tpl-actions">
              {activeTemplate && (
                <button type="button" className="tpl-btn tpl-btn--ghost" onClick={openUpdateActive}>
                  更新当前
                </button>
              )}
              <button type="button" className="tpl-btn tpl-btn--primary" onClick={() => openCreateEditor()}>
                + 保存当前设置
              </button>
              <button
                type="button"
                className="tpl-btn tpl-btn--ghost"
                onClick={() => importInputRef.current?.click()}
              >
                导入 JSON
              </button>
              <button
                type="button"
                className="tpl-btn tpl-btn--ghost"
                onClick={handleExportTemplates}
                disabled={templates.length === 0}
              >
                导出 JSON
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleImportTemplates}
              />
            </div>
          </div>

          {editorState && (
            <div className="tpl-inline-editor">
              <div className="tpl-inline-editor-title">{editorState.title}</div>
              <label className="tpl-field">
                <span>模板名称</span>
                <input
                  className="tpl-input"
                  type="text"
                  value={editorState.name}
                  onChange={(e) => {
                    setEditorError('')
                    setEditorState((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }}
                  placeholder="如：XX局正式发文模板"
                />
              </label>
              <label className="tpl-field">
                <span>备注（可选）</span>
                <input
                  className="tpl-input"
                  type="text"
                  value={editorState.description}
                  onChange={(e) => {
                    setEditorState((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                  }}
                  placeholder="记录适用单位或场景"
                />
              </label>
              {editorError && (
                <div className="tpl-inline-error">
                  <span>{editorError}</span>
                  <button
                    type="button"
                    className="tpl-btn tpl-btn--ghost"
                    onClick={() => {
                      const nextName = suggestUniqueTemplateName(editorState.name, knownNames)
                      setEditorState({ ...editorState, name: nextName })
                      setEditorError('')
                    }}
                  >
                    使用建议名
                  </button>
                </div>
              )}
              <div className="tpl-inline-actions-end">
                <button
                  type="button"
                  className="tpl-btn tpl-btn--ghost"
                  onClick={() => {
                    setEditorState(null)
                    setEditorError('')
                  }}
                >
                  取消
                </button>
                <button type="button" className="tpl-btn tpl-btn--primary" onClick={handleEditorSubmit}>
                  {editorState.submitLabel}
                </button>
              </div>
            </div>
          )}

          {pendingApplyTarget && (
            <div className="tpl-inline-warning">
              <p>
                当前格式设置尚未保存为模板，直接套用「{pendingApplyTarget.name}」会覆盖当前调整。
              </p>
              <div className="tpl-inline-actions-end">
                <button type="button" className="tpl-btn tpl-btn--ghost" onClick={() => setPendingApplyTarget(null)}>
                  取消
                </button>
                <button
                  type="button"
                  className="tpl-btn tpl-btn--ghost"
                  onClick={() => {
                    const id = pendingApplyTarget.id
                    setPendingApplyTarget(null)
                    openCreateEditor(id)
                  }}
                >
                  先保存再套用
                </button>
                <button
                  type="button"
                  className="tpl-btn tpl-btn--primary"
                  onClick={() => {
                    applyTemplate(pendingApplyTarget.id)
                    setNotice({ type: 'success', text: `已套用模板「${pendingApplyTarget.name}」。` })
                    setPendingApplyTarget(null)
                  }}
                >
                  直接套用
                </button>
              </div>
            </div>
          )}

          {templates.length > 0 && (
            <input
              type="text"
              className="tpl-input tpl-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索已保存模板名称或备注…"
            />
          )}

          {filteredTemplates.length === 0 ? (
            <div className="tpl-empty">
              {templates.length === 0
                ? '还没有自定义模板。调好右侧「版式 / 排版」参数后，点击「+ 保存当前设置」即可随时复用。'
                : '没有匹配的模板。'}
            </div>
          ) : (
            <div className="tpl-list">
              {filteredTemplates.map((tpl) => {
                const summary = buildTemplateSummary(tpl.config)
                const isPinned = pinnedSet.has(tpl.id)
                const isCurrent = activeTemplateMeta?.templateId === tpl.id
                  || (!activeTemplateMeta && currentMatchingTemplate?.id === tpl.id)

                return (
                  <article key={tpl.id} className="tpl-card">
                    <div className="tpl-card-top">
                      <div className="tpl-card-title-wrap">
                        <strong>{tpl.name}</strong>
                        {isPinned && <span className="tpl-badge tpl-badge--pin">置顶</span>}
                        {isCurrent && <span className="tpl-badge tpl-badge--current">当前</span>}
                      </div>
                      <div className="tpl-actions">
                        <button
                          type="button"
                          className={`tpl-btn ${isCurrent ? 'tpl-btn--primary' : 'tpl-btn--ghost'}`}
                          onClick={() => handleApplyUserTemplate(tpl)}
                        >
                          {isCurrent ? '使用中' : '套用'}
                        </button>
                        <button
                          type="button"
                          className="tpl-btn tpl-btn--ghost"
                          onClick={() => (isPinned ? unpinTemplate(tpl.id) : pinTemplate(tpl.id))}
                        >
                          {isPinned ? '取消置顶' : '置顶'}
                        </button>
                        <button
                          type="button"
                          className="tpl-btn tpl-btn--ghost"
                          onClick={() => openEditMeta(tpl)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="tpl-btn tpl-btn--ghost"
                          onClick={() => {
                            const copied = copyTemplate(tpl.id)
                            setNotice({ type: 'success', text: `已复制为「${copied.name}」。` })
                          }}
                        >
                          复制
                        </button>
                        {confirmDeleteId === tpl.id ? (
                          <>
                            <button
                              type="button"
                              className="tpl-btn tpl-btn--danger"
                              onClick={() => {
                                deleteTemplate(tpl.id)
                                setConfirmDeleteId(null)
                                setNotice({ type: 'success', text: `已删除「${tpl.name}」。` })
                              }}
                            >
                              确认删
                            </button>
                            <button
                              type="button"
                              className="tpl-btn tpl-btn--ghost"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="tpl-btn tpl-btn--ghost tpl-btn--danger-text"
                            onClick={() => setConfirmDeleteId(tpl.id)}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </div>
                    {tpl.description && <p className="tpl-desc">{tpl.description}</p>}
                    <div className="tpl-meta">
                      <span>标题 {summary.titleStyle.fontFamily} {summary.titleStyle.fontSizeLabel}</span>
                      <span>正文 {summary.bodyStyle.fontFamily} {summary.bodyStyle.fontSizeLabel} · {summary.bodyStyle.lineSpacingLabel}</span>
                    </div>
                    <div className="tpl-tags">
                      {summary.featureTags.map((tag) => (
                        <span key={tag} className="tpl-tag">{tag}</span>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* GB/T 9704 国标预设库 */}
        <section className="tpl-section">
          <div className="tpl-section-head">
            <h3 className="tpl-section-title">GB/T 9704 国标预设</h3>
            <span className="tpl-hint">可直接套用或复制一份到「我的模板」修改</span>
          </div>
          <div className="tpl-preset-grid">
            {BUILTIN_TEMPLATES.map((preset) => (
              <article key={preset.id} className="tpl-card">
                <div className="tpl-card-top">
                  <strong>{preset.name}</strong>
                  <span className="tpl-badge tpl-badge--std">{preset.badge}</span>
                </div>
                <p className="tpl-desc">{preset.description}</p>
                <div className="tpl-actions">
                  <button
                    type="button"
                    className="tpl-btn tpl-btn--ghost"
                    onClick={() => {
                      onApplyBuiltinTemplate(preset.id)
                      setNotice({ type: 'success', text: `已套用国标预设「${preset.name}」。` })
                    }}
                  >
                    套用预设
                  </button>
                  <button
                    type="button"
                    className="tpl-btn tpl-btn--ghost"
                    onClick={() => handleCloneBuiltin(preset)}
                  >
                    复制为我的模板
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </ModalDialog>
  )
}

export function TemplateManagerModal(props: TemplateManagerModalProps) {
  if (!props.open) return null
  return (
    <TemplateManagerModalContent
      key={props.initialAction ?? 'browse'}
      initialAction={props.initialAction}
      templateStore={props.templateStore}
      onApplyBuiltinTemplate={props.onApplyBuiltinTemplate}
      onClose={props.onClose}
    />
  )
}
