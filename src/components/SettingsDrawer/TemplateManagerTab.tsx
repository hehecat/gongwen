import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates'
import type { DocumentTemplate } from '../../types/documentTemplate'
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from '../../utils/builtinTemplates'
import { buildTemplateSummary, suggestUniqueTemplateName } from '../../utils/documentTemplates'

interface TemplateEditorState {
  kind: 'save-current' | 'edit-meta'
  title: string
  submitLabel: string
  name: string
  description: string
  overwriteTemplateId?: string
  pendingApplyTemplateId?: string
}

export function TemplateManagerTab() {
  const { config, replaceConfig } = useDocumentConfig()
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
  } = useDocumentTemplates(config, replaceConfig)

  const importInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [editorState, setEditorState] = useState<TemplateEditorState | null>(null)
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

  function handleApplyBuiltin(preset: BuiltinTemplate) {
    setNotice(null)
    replaceConfig(preset.config)
    setNotice({ type: 'success', text: `已套用国标预设「${preset.name}」。` })
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
    <div className="settings-tab-stack">
      {notice && (
        <div className={`settings-inline-notice settings-inline-notice--${notice.type}`}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="关闭提示">✕</button>
        </div>
      )}

      {/* GB/T 9704 内置国标预设 */}
      <section className="settings-section">
        <div className="settings-section-header-row">
          <h3 className="settings-section-title settings-section-title--inline">GB/T 9704 国标预设</h3>
          <span className="settings-hint settings-hint--tight">开箱即用，一键套用或复制微调</span>
        </div>
        <div className="settings-preset-grid">
          {BUILTIN_TEMPLATES.map((preset) => (
            <article key={preset.id} className="settings-preset-card">
              <div className="settings-preset-top">
                <strong className="settings-preset-name">{preset.name}</strong>
                <span className="settings-preset-badge">{preset.badge}</span>
              </div>
              <p className="settings-preset-desc">{preset.description}</p>
              <div className="settings-preset-actions">
                <button
                  type="button"
                  className="settings-btn settings-btn--primary"
                  onClick={() => handleApplyBuiltin(preset)}
                >
                  套用
                </button>
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost"
                  onClick={() => handleCloneBuiltin(preset)}
                >
                  存为我的模板
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 我的模板库 */}
      <section className="settings-section">
        <div className="settings-section-header-row">
          <h3 className="settings-section-title settings-section-title--inline">
            我的模板 ({templates.length})
          </h3>
          <div className="settings-inline-actions">
            {activeTemplate && (
              <button type="button" className="settings-btn settings-btn--ghost" onClick={openUpdateActive}>
                更新当前
              </button>
            )}
            <button type="button" className="settings-btn settings-btn--primary" onClick={() => openCreateEditor()}>
              保存当前设置
            </button>
            <button
              type="button"
              className="settings-btn settings-btn--ghost"
              onClick={() => importInputRef.current?.click()}
            >
              导入
            </button>
            <button
              type="button"
              className="settings-btn settings-btn--ghost"
              onClick={handleExportTemplates}
              disabled={templates.length === 0}
            >
              导出
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

        {/* 内联保存/编辑表单 */}
        {editorState && (
          <div className="settings-inline-editor">
            <div className="settings-inline-editor-header">
              <strong>{editorState.title}</strong>
            </div>
            <label className="settings-field">
              <span className="settings-field-label">模板名称</span>
              <input
                className="settings-input"
                type="text"
                value={editorState.name}
                onChange={(e) => {
                  setEditorError('')
                  setEditorState((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                }}
                placeholder="如：XX局正式发文模板"
              />
            </label>
            <label className="settings-field">
              <span className="settings-field-label">备注（可选）</span>
              <input
                className="settings-input"
                type="text"
                value={editorState.description}
                onChange={(e) => {
                  setEditorState((prev) => (prev ? { ...prev, description: e.target.value } : prev))
                }}
                placeholder="记录适用单位或场景"
              />
            </label>
            {editorError && (
              <div className="settings-inline-error">
                <span>{editorError}</span>
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost"
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
            <div className="settings-inline-editor-actions">
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                onClick={() => {
                  setEditorState(null)
                  setEditorError('')
                }}
              >
                取消
              </button>
              <button type="button" className="settings-btn settings-btn--primary" onClick={handleEditorSubmit}>
                {editorState.submitLabel}
              </button>
            </div>
          </div>
        )}

        {/* 内联套用冲突确认 */}
        {pendingApplyTarget && (
          <div className="settings-inline-warning">
            <p className="settings-inline-warning-text">
              当前格式设置尚未保存为模板，直接套用「{pendingApplyTarget.name}」会覆盖当前调整。
            </p>
            <div className="settings-inline-editor-actions">
              <button type="button" className="settings-btn settings-btn--ghost" onClick={() => setPendingApplyTarget(null)}>
                取消
              </button>
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
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
                className="settings-btn settings-btn--primary"
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
            className="settings-input settings-template-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索已保存模板名称或备注…"
          />
        )}

        {filteredTemplates.length === 0 ? (
          <div className="settings-empty-box">
            {templates.length === 0
              ? '还没有自定义模板。调好右侧排版后，点击「保存当前设置」即可随时复用。'
              : '没有匹配的模板。'}
          </div>
        ) : (
          <div className="settings-my-templates">
            {filteredTemplates.map((tpl) => {
              const summary = buildTemplateSummary(tpl.config)
              const isPinned = pinnedSet.has(tpl.id)
              const isCurrent = activeTemplateMeta?.templateId === tpl.id
                || (!activeTemplateMeta && currentMatchingTemplate?.id === tpl.id)

              return (
                <article key={tpl.id} className="settings-user-tpl-card">
                  <div className="settings-user-tpl-top">
                    <div className="settings-user-tpl-title-wrap">
                      <strong className="settings-user-tpl-name">{tpl.name}</strong>
                      {isPinned && <span className="settings-preset-badge settings-preset-badge--pin">置顶</span>}
                      {isCurrent && <span className="settings-preset-badge settings-preset-badge--current">当前</span>}
                    </div>
                    <div className="settings-inline-actions">
                      <button
                        type="button"
                        className="settings-btn settings-btn--primary"
                        onClick={() => handleApplyUserTemplate(tpl)}
                      >
                        套用
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--ghost"
                        onClick={() => (isPinned ? unpinTemplate(tpl.id) : pinTemplate(tpl.id))}
                      >
                        {isPinned ? '取消置顶' : '置顶'}
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--ghost"
                        onClick={() => openEditMeta(tpl)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="settings-btn settings-btn--ghost"
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
                            className="settings-btn settings-btn--danger"
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
                            className="settings-btn settings-btn--ghost"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="settings-btn settings-btn--ghost settings-btn--danger-text"
                          onClick={() => setConfirmDeleteId(tpl.id)}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                  {tpl.description && (
                    <p className="settings-preset-desc">{tpl.description}</p>
                  )}
                  <div className="settings-user-tpl-meta">
                    <span>标题 {summary.titleStyle.fontFamily} {summary.titleStyle.fontSizeLabel}</span>
                    <span>正文 {summary.bodyStyle.fontFamily} {summary.bodyStyle.fontSizeLabel} · {summary.bodyStyle.lineSpacingLabel}</span>
                  </div>
                  <div className="settings-user-tpl-tags">
                    {summary.featureTags.map((tag) => (
                      <span key={tag} className="settings-mini-tag">{tag}</span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
