import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useDocumentTemplates } from '../../hooks/useDocumentTemplates'
import type { DocumentTemplate } from '../../types/documentTemplate'
import { buildTemplateSummary, suggestUniqueTemplateName } from '../../utils/documentTemplates'

interface FlashMessage {
  text: string
  type: 'error' | 'success'
}

interface TemplateEditorState {
  description: string
  kind: 'edit-meta' | 'save-current'
  name: string
  overwriteTemplateId?: string
  pendingApplyTemplateId?: string
  submitLabel: string
  title: string
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatNameList(names: string[], limit = 5): string {
  const uniqueNames = Array.from(new Set(names))
  if (uniqueNames.length <= limit) {
    return uniqueNames.join('、')
  }

  return `${uniqueNames.slice(0, limit).join('、')} 等${uniqueNames.length}个`
}

function FlashNotice({
  message,
  onClose,
}: {
  message: FlashMessage
  onClose: () => void
}) {
  return (
    <div className={`settings-template-toast settings-template-toast--${message.type}`}>
      <span>{message.text}</span>
      <button type="button" className="settings-template-flash-close" onClick={onClose} aria-label="关闭提示">
        ✕
      </button>
    </div>
  )
}

function DialogShell({
  actions,
  bodyClassName,
  children,
  dialogClassName,
  floatingNotice,
  onClose,
  title,
}: {
  actions?: ReactNode
  bodyClassName?: string
  children: ReactNode
  dialogClassName?: string
  floatingNotice?: ReactNode
  onClose: () => void
  title: string
}) {
  const dialogClassNames = ['settings-subdialog', dialogClassName].filter(Boolean).join(' ')
  const bodyClassNames = ['settings-subdialog-body', bodyClassName].filter(Boolean).join(' ')

  return (
    <div className="settings-subdialog-backdrop" onClick={onClose}>
      <div
        className={dialogClassNames}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="settings-subdialog-header">
          <h4 className="settings-subdialog-title">{title}</h4>
          <button className="settings-subdialog-close" type="button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        {floatingNotice && (
          <div className="settings-template-toast-anchor settings-template-toast-anchor--dialog">
            {floatingNotice}
          </div>
        )}
        <div className={bodyClassNames}>
          {children}
        </div>
        {actions && (
          <div className="settings-subdialog-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export function TemplateManagerSection() {
  const { config, replaceConfig } = useDocumentConfig()
  const {
    activeTemplate,
    activeTemplateMeta,
    applyTemplate,
    commonTemplates,
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
    templateCount,
    templates,
    unpinTemplate,
    updateTemplateMeta,
  } = useDocumentTemplates(config, replaceConfig)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null)
  const [editorState, setEditorState] = useState<TemplateEditorState | null>(null)
  const [editorError, setEditorError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null)
  const [applyConfirmTarget, setApplyConfirmTarget] = useState<DocumentTemplate | null>(null)
  const [openTemplateMenuId, setOpenTemplateMenuId] = useState<string | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const activeMenuRef = useRef<HTMLDivElement | null>(null)
  const knownTemplateNames = useMemo(() => templates.map((template) => template.name), [templates])
  const pinnedTemplateIdSet = useMemo(() => new Set(pinnedTemplateIds), [pinnedTemplateIds])
  const filteredTemplates = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase()
    if (!keyword) return templates

    return templates.filter((template) => (
      template.name.toLowerCase().includes(keyword)
      || template.description.toLowerCase().includes(keyword)
    ))
  }, [searchQuery, templates])

  useEffect(() => {
    if (!flashMessage) return

    const timer = window.setTimeout(() => {
      setFlashMessage(null)
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [flashMessage])

  useEffect(() => {
    if (!openTemplateMenuId) return

    function handlePointerDown(event: MouseEvent) {
      if (activeMenuRef.current?.contains(event.target as Node)) {
        return
      }

      setOpenTemplateMenuId(null)
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenTemplateMenuId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openTemplateMenuId])

  function clearFlash() {
    setFlashMessage(null)
  }

  function openCreateEditor(pendingApplyTemplateId?: string) {
    clearFlash()
    const draftName = suggestUniqueTemplateName(
      activeTemplateMeta
        ? `${activeTemplateMeta.templateName} 调整版`
        : '新建模板',
      knownTemplateNames,
    )

    setEditorError('')
    setEditorState({
      kind: 'save-current',
      title: pendingApplyTemplateId ? '先保存当前设置' : '保存当前设置为模板',
      submitLabel: pendingApplyTemplateId ? '保存并继续' : '保存模板',
      name: draftName,
      description: '',
      pendingApplyTemplateId,
    })
  }

  function openUpdateCurrentTemplate() {
    if (!activeTemplate) return

    clearFlash()
    setEditorError('')
    setEditorState({
      kind: 'save-current',
      title: '更新模板',
      submitLabel: '更新模板',
      name: activeTemplate.name,
      description: activeTemplate.description,
      overwriteTemplateId: activeTemplate.id,
    })
  }

  function openEditTemplate(template: DocumentTemplate) {
    clearFlash()
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

  function closeEditor() {
    setEditorError('')
    setEditorState(null)
  }

  function closeLibrary() {
    setOpenTemplateMenuId(null)
    setShowLibrary(false)
    setSearchQuery('')
  }

  function handleEditorFieldChange(field: 'description' | 'name', value: string) {
    setEditorError('')
    setEditorState((current) => (
      current ? { ...current, [field]: value } : current
    ))
  }

  function handleEditorUseSuggestedName() {
    if (!editorError || !editorState) return

    const suggestion = suggestUniqueTemplateName(editorState.name, knownTemplateNames)
    setEditorState({ ...editorState, name: suggestion })
    setEditorError('')
  }

  function handleEditorOverwriteConflict() {
    if (!editorState || editorState.kind !== 'save-current' || editorState.overwriteTemplateId) return

    const existingTemplate = templates.find((template) => template.name === editorState.name.trim())
    if (!existingTemplate) return

    setEditorError('')
    setEditorState({
      ...editorState,
      overwriteTemplateId: existingTemplate.id,
      title: `覆盖模板「${existingTemplate.name}」`,
      submitLabel: '覆盖模板',
    })
  }

  function handleEditorSubmit() {
    if (!editorState) return

    clearFlash()
    try {
      if (editorState.kind === 'edit-meta') {
        const result = updateTemplateMeta(editorState.overwriteTemplateId!, {
          name: editorState.name,
          description: editorState.description,
        })

        if (result.status === 'conflict') {
          setEditorError(`模板名已存在，建议改为「${result.conflict.suggestedName}」。`)
          return
        }

        setFlashMessage({
          type: 'success',
          text: `已更新模板「${result.result.template.name}」。`,
        })
        closeEditor()
        return
      }

      const result = saveCurrentAsTemplate({
        name: editorState.name,
        description: editorState.description,
        overwriteTemplateId: editorState.overwriteTemplateId,
      })

      if (result.status === 'conflict') {
        setEditorError(`模板名已存在，建议改为「${result.conflict.suggestedName}」。`)
        return
      }

      const pendingApplyTarget = editorState.pendingApplyTemplateId
      const savedTemplateName = result.result.template.name

      if (pendingApplyTarget) {
        const targetTemplate = templates.find((template) => template.id === pendingApplyTarget)
        closeEditor()
        try {
          applyTemplate(pendingApplyTarget)
        } catch (error) {
          setFlashMessage({
            type: 'error',
            text: error instanceof Error
              ? `当前设置已保存，但套用模板失败：${error.message}`
              : '当前设置已保存，但套用模板失败。',
          })
          return
        }
        setFlashMessage({
          type: 'success',
          text: targetTemplate
            ? `已保存当前设置，并套用模板「${targetTemplate.name}」。`
            : '已保存当前设置，并继续套用目标模板。',
        })
        return
      }

      closeEditor()
      setFlashMessage({
        type: 'success',
        text: result.result.action === 'created'
          ? `已保存模板「${savedTemplateName}」。`
          : `已更新模板「${savedTemplateName}」。`,
      })
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : '模板保存失败。')
    }
  }

  function handleApplyRequest(template: DocumentTemplate) {
    clearFlash()
    setOpenTemplateMenuId(null)
    const shouldProtectCurrentConfig = hasUnsavedCurrentConfig
      && currentMatchingTemplate?.id !== template.id

    if (!shouldProtectCurrentConfig) {
      try {
        applyTemplate(template.id)
        setFlashMessage({
          type: 'success',
          text: `已套用模板「${template.name}」。`,
        })
      } catch (error) {
        setFlashMessage({
          type: 'error',
          text: error instanceof Error ? error.message : '套用模板失败。',
        })
      }
      return
    }

    setApplyConfirmTarget(template)
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return

    const targetName = deleteTarget.name
    try {
      setOpenTemplateMenuId((current) => (current === deleteTarget.id ? null : current))
      deleteTemplate(deleteTarget.id)
      setDeleteTarget(null)
      setFlashMessage({
        type: 'success',
        text: `已删除模板「${targetName}」。`,
      })
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '删除模板失败。',
      })
    }
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!file) return

    clearFlash()

    try {
      const collection = await readTemplateCollectionFile(file)
      const { importedTemplates, skippedNames } = importTemplateCollectionDraft(collection)

      if (importedTemplates.length === 0 && skippedNames.length === 0) {
        setFlashMessage({
          type: 'error',
          text: '模板包中没有可导入的模板。',
        })
        return
      }

      if (importedTemplates.length === 0) {
        setFlashMessage({
          type: 'error',
          text: `未新增模板，已跳过 ${skippedNames.length} 个重名模板：${formatNameList(skippedNames)}。`,
        })
        return
      }

      if (skippedNames.length > 0) {
        setFlashMessage({
          type: 'success',
          text: `已导入 ${importedTemplates.length} 个模板，跳过 ${skippedNames.length} 个重名模板：${formatNameList(skippedNames)}。`,
        })
        return
      }

      setFlashMessage({
        type: 'success',
        text: `已导入 ${importedTemplates.length} 个模板。`,
      })
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '导入模板失败。',
      })
    }
  }

  async function handleExportAll() {
    clearFlash()
    try {
      await exportAllTemplates()
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '导出模板失败。',
      })
    }
  }

  function handleCopyTemplate(template: DocumentTemplate) {
    clearFlash()
    setOpenTemplateMenuId(null)
    try {
      const copiedTemplate = copyTemplate(template.id)
      setFlashMessage({
        type: 'success',
        text: `已复制模板为「${copiedTemplate.name}」。`,
      })
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '复制模板失败。',
      })
    }
  }

  function handlePinToggle(template: DocumentTemplate) {
    clearFlash()
    setOpenTemplateMenuId(null)

    try {
      if (pinnedTemplateIdSet.has(template.id)) {
        unpinTemplate(template.id)
        setFlashMessage({
          type: 'success',
          text: `已取消置顶模板「${template.name}」。`,
        })
        return
      }

      pinTemplate(template.id)
      setFlashMessage({
        type: 'success',
        text: `已置顶模板「${template.name}」。`,
      })
    } catch (error) {
      setFlashMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '置顶模板失败。',
      })
    }
  }

  function toggleTemplateMenu(templateId: string) {
    setOpenTemplateMenuId((current) => (current === templateId ? null : templateId))
  }

  return (
    <>
      <section className="settings-section settings-template-section">
        {flashMessage && !showLibrary && (
          <div className="settings-template-toast-anchor">
            <FlashNotice message={flashMessage} onClose={clearFlash} />
          </div>
        )}

        <div className="settings-template-header">
          <div>
            <h3 className="settings-section-title">模板</h3>
          </div>
        </div>

        <div className="settings-template-common-box">
          <div className="settings-template-status-row">
            <div className="settings-template-status-copy">
              <span className="settings-template-subsection-title">常用模板</span>
            </div>
            <div className="settings-template-toolbar settings-template-toolbar--section">
              {activeTemplate && (
                <button className="settings-btn settings-btn--info" type="button" onClick={openUpdateCurrentTemplate}>
                  更新当前模板
                </button>
              )}
              <button className="settings-btn settings-btn--info" type="button" onClick={() => openCreateEditor()}>
                保存当前为模板
              </button>
              <button className="settings-btn settings-btn--download" type="button" onClick={() => setShowLibrary(true)}>
                全部模板
              </button>
            </div>
          </div>

          {commonTemplates.length === 0 ? (
            <div className="settings-template-empty settings-template-empty--compact">
              <p className="settings-template-empty-title">还没有保存的模板</p>
              <p className="settings-hint settings-hint--tight">
                {templateCount === 0 ? '先保存一个模板，它就会出现在这里。' : '模板加载中，请稍后再试。'}
              </p>
            </div>
          ) : (
            <div className="settings-template-recent-row">
              {commonTemplates.map(({ template }) => {
                const isCurrentTemplate = activeTemplateMeta?.templateId === template.id
                  || (!activeTemplateMeta && currentMatchingTemplate?.id === template.id)
                const isPinnedTemplate = pinnedTemplateIdSet.has(template.id)
                const compactStatusLabel = isPinnedTemplate && isCurrentTemplate
                  ? '置顶·当前'
                  : isPinnedTemplate
                    ? '置顶'
                    : isCurrentTemplate
                      ? '当前'
                      : ''

                return (
                  <article key={template.id} className="settings-template-quick-card">
                    <div className="settings-template-card-title-row settings-template-card-title-row--quick">
                      <span className="settings-template-card-title settings-template-card-title--quick">
                        {compactStatusLabel && (
                          <span className="settings-template-badge settings-template-badge--compact settings-template-badge--leading">
                            {compactStatusLabel}
                          </span>
                        )}
                        <span className="settings-template-card-title-text">{template.name}</span>
                      </span>
                    </div>
                    <p
                      className={[
                        'settings-template-description',
                        'settings-template-description--single-line',
                        !template.description ? 'settings-template-description--placeholder' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {template.description || ' '}
                    </p>
                    <div className="settings-template-quick-actions">
                      <button className="settings-btn settings-btn--download" type="button" onClick={() => handleApplyRequest(template)}>
                        套用
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {showLibrary && (
        <DialogShell
          title={`全部模板（${templateCount}）`}
          onClose={closeLibrary}
          dialogClassName="settings-subdialog--wide"
          bodyClassName="settings-subdialog-body--wide"
          floatingNotice={flashMessage ? <FlashNotice message={flashMessage} onClose={clearFlash} /> : undefined}
        >
          <div className="settings-template-library-toolbar">
            <label className="settings-field settings-template-search-field">
              <span className="settings-field-label">搜索模板</span>
              <div className="settings-template-search-input-wrap">
                <span className="settings-template-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <path
                      d="M14.5 14.5L18 18M16.4 9.2C16.4 13.1765 13.1765 16.4 9.2 16.4C5.22355 16.4 2 13.1765 2 9.2C2 5.22355 5.22355 2 9.2 2C13.1765 2 16.4 5.22355 16.4 9.2Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  className="settings-input settings-template-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="输入模板名称或备注..."
                />
              </div>
            </label>
            <div className="settings-template-toolbar settings-template-toolbar--library">
              <button className="settings-btn settings-btn--info" type="button" onClick={() => openCreateEditor()}>
                保存当前为模板
              </button>
              <button
                className="settings-btn settings-btn--info"
                type="button"
                onClick={() => importInputRef.current?.click()}
              >
                导入模板库
              </button>
              <button className="settings-btn settings-btn--download" type="button" onClick={handleExportAll}>
                导出全部
              </button>
              <input
                ref={importInputRef}
                className="settings-template-import"
                type="file"
                accept=".json,application/json"
                onChange={handleImportChange}
              />
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="settings-template-empty settings-template-empty--compact">
              <p className="settings-template-empty-title">没有匹配的模板</p>
              <p className="settings-hint settings-hint--tight">
                {templateCount === 0 ? '当前模板库为空。' : '换个关键词试试，搜索仅匹配模板名称和备注。'}
              </p>
            </div>
          ) : (
            <div className="settings-template-library-grid">
              {filteredTemplates.map((template) => {
                const summary = buildTemplateSummary(template.config)
                const isCurrentTemplate = activeTemplateMeta?.templateId === template.id
                  || (!activeTemplateMeta && currentMatchingTemplate?.id === template.id)
                const isPinnedTemplate = pinnedTemplateIdSet.has(template.id)
                const isTemplateMenuOpen = openTemplateMenuId === template.id

                return (
                  <article key={template.id} className="settings-template-card">
                    <div className="settings-template-card-top">
                      <div className="settings-template-card-heading">
                        <div className="settings-template-card-title-row">
                          <span className="settings-template-card-title settings-template-card-title--clamp">{template.name}</span>
                          <div className="settings-template-card-title-badges">
                            {isPinnedTemplate && <span className="settings-template-badge settings-template-badge--pin">已置顶</span>}
                            {isCurrentTemplate && <span className="settings-template-badge">当前模板</span>}
                          </div>
                        </div>
                        <p
                          className={[
                            'settings-template-description',
                            !template.description ? 'settings-template-description--placeholder' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {template.description || '无备注'}
                        </p>
                      </div>
                      <div className="settings-template-primary-actions">
                        <button
                          className="settings-btn settings-btn--download"
                          type="button"
                          onClick={() => handleApplyRequest(template)}
                        >
                          套用
                        </button>
                        <button className="settings-template-link-action" type="button" onClick={() => handlePinToggle(template)}>
                          {isPinnedTemplate ? '取消置顶' : '置顶'}
                        </button>
                        <div
                          className="settings-template-menu"
                          ref={isTemplateMenuOpen ? activeMenuRef : undefined}
                        >
                          <button
                            className="settings-template-menu-trigger"
                            type="button"
                            aria-label="更多操作"
                            aria-expanded={isTemplateMenuOpen}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleTemplateMenu(template.id)
                            }}
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor">
                              <path d="M4.5 10a1.5 1.5 0 1 0 0.001-3.001A1.5 1.5 0 0 0 4.5 10Zm5.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm5.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                            </svg>
                          </button>
                          {isTemplateMenuOpen && (
                            <div className="settings-template-menu-popover">
                              <button
                                className="settings-template-menu-item"
                                type="button"
                                onClick={() => {
                                  setOpenTemplateMenuId(null)
                                  openEditTemplate(template)
                                }}
                              >
                                编辑
                              </button>
                              <button
                                className="settings-template-menu-item"
                                type="button"
                                onClick={() => handleCopyTemplate(template)}
                              >
                                复制
                              </button>
                              <div className="settings-template-menu-divider" />
                              <button
                                className="settings-template-menu-item settings-template-menu-item--danger"
                                type="button"
                                onClick={() => {
                                  setOpenTemplateMenuId(null)
                                  setDeleteTarget(template)
                                }}
                              >
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="settings-template-detail-grid">
                      <span className="settings-template-detail-label">标题排版</span>
                      <div className="settings-template-detail-content">
                        <span className="settings-template-detail-font-name">{summary.titleStyle.fontFamily}</span>
                        <span className="settings-template-detail-separator" aria-hidden="true" />
                        <span className="settings-template-detail-font-prop">{summary.titleStyle.fontSizeLabel}</span>
                        <span className="settings-template-detail-separator" aria-hidden="true" />
                        <span className="settings-template-detail-font-prop">{summary.titleStyle.lineSpacingLabel}</span>
                      </div>
                      <span className="settings-template-detail-label">正文排版</span>
                      <div className="settings-template-detail-content">
                        <span className="settings-template-detail-font-name">
                          {summary.bodyStyle.fontFamily}
                          {summary.bodyStyle.auxiliaryFontFamily && (
                            <>
                              <span className="settings-template-detail-font-divider">/</span>
                              {summary.bodyStyle.auxiliaryFontFamily}
                            </>
                          )}
                        </span>
                        <span className="settings-template-detail-separator" aria-hidden="true" />
                        <span className="settings-template-detail-font-prop">{summary.bodyStyle.fontSizeLabel}</span>
                        <span className="settings-template-detail-separator" aria-hidden="true" />
                        <span className="settings-template-detail-font-prop">{summary.bodyStyle.lineSpacingLabel}</span>
                        {summary.bodyStyle.firstLineIndentLabel && (
                          <>
                            <span className="settings-template-detail-separator" aria-hidden="true" />
                            <span className="settings-template-detail-font-prop">{summary.bodyStyle.firstLineIndentLabel}</span>
                          </>
                        )}
                      </div>
                      <span className="settings-template-detail-label">标题层级</span>
                      <div className="settings-template-detail-content settings-template-detail-content--headings">
                        {summary.headingStyles.map((heading) => (
                          <span key={heading.levelLabel} className="settings-template-detail-subgroup">
                            <span className="settings-template-detail-inline-label">{heading.levelLabel}</span>
                            <span className="settings-template-detail-font-name">{heading.fontFamily}</span>
                            <span className="settings-template-detail-font-prop">{heading.fontSizeLabel}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="settings-template-tags-row">
                      {summary.featureTags.map((tag) => (
                        <span
                          key={tag}
                          className={`settings-template-tag ${tag.includes('开启') ? 'settings-template-tag--enabled' : 'settings-template-tag--disabled'}`}
                        >
                          <span className="settings-template-tag-dot" aria-hidden="true" />
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="settings-template-time settings-template-time--muted">更新于 {formatTimestamp(template.updatedAt)}</p>
                  </article>
                )
              })}
            </div>
          )}
        </DialogShell>
      )}

      {editorState && (
        <DialogShell
          title={editorState.title}
          onClose={closeEditor}
          actions={(
            <>
              <button className="settings-btn settings-btn--close" type="button" onClick={closeEditor}>
                取消
              </button>
              <button className="settings-btn settings-btn--download" type="button" onClick={handleEditorSubmit}>
                {editorState.submitLabel}
              </button>
            </>
          )}
        >
          <label className="settings-field">
            <span className="settings-field-label">模板名称</span>
            <input
              className="settings-input"
              type="text"
              value={editorState.name}
              onChange={(event) => handleEditorFieldChange('name', event.target.value)}
              placeholder="如：XX单位公文模板"
            />
          </label>
          <label className="settings-field">
            <span className="settings-field-label">备注</span>
            <textarea
              className="settings-textarea"
              value={editorState.description}
              onChange={(event) => handleEditorFieldChange('description', event.target.value)}
              placeholder="可选，记录适用单位、场景或注意事项"
              rows={4}
            />
          </label>
          {editorError && (
            <div className="settings-template-error">
              <p>{editorError}</p>
              <div className="settings-template-dialog-actions">
                <button className="settings-btn settings-btn--info" type="button" onClick={handleEditorUseSuggestedName}>
                  使用建议名
                </button>
                {editorState.kind === 'save-current' && !editorState.overwriteTemplateId && (
                  <button className="settings-btn settings-btn--download" type="button" onClick={handleEditorOverwriteConflict}>
                    覆盖同名模板
                  </button>
                )}
              </div>
            </div>
          )}
        </DialogShell>
      )}

      {deleteTarget && (
        <DialogShell
          title="删除模板"
          onClose={() => setDeleteTarget(null)}
          actions={(
            <>
              <button className="settings-btn settings-btn--close" type="button" onClick={() => setDeleteTarget(null)}>
                取消
              </button>
              <button className="settings-btn settings-btn--reset" type="button" onClick={handleDeleteConfirm}>
                删除
              </button>
            </>
          )}
        >
          <p className="settings-template-dialog-text">删除后模板将从本地模板库移除，不能恢复。</p>
          <p className="settings-template-dialog-text">确认删除「{deleteTarget.name}」？</p>
        </DialogShell>
      )}

      {applyConfirmTarget && (
        <DialogShell
          title="当前设置尚未保存"
          onClose={() => setApplyConfirmTarget(null)}
          actions={(
            <>
              <button className="settings-btn settings-btn--close" type="button" onClick={() => setApplyConfirmTarget(null)}>
                取消
              </button>
              <button
                className="settings-btn settings-btn--info"
                type="button"
                onClick={() => {
                  const targetId = applyConfirmTarget.id
                  setApplyConfirmTarget(null)
                  openCreateEditor(targetId)
                }}
              >
                先保存当前设置
              </button>
              <button
                className="settings-btn settings-btn--download"
                type="button"
                onClick={() => {
                  applyTemplate(applyConfirmTarget.id)
                  setApplyConfirmTarget(null)
                  setFlashMessage({
                    type: 'success',
                    text: `已套用模板「${applyConfirmTarget.name}」。`,
                  })
                }}
              >
                直接套用
              </button>
            </>
          )}
        >
          <p className="settings-template-dialog-text">当前设置尚未保存为模板，直接套用会覆盖现有格式。</p>
          <p className="settings-template-dialog-text">目标模板：{applyConfirmTarget.name}</p>
        </DialogShell>
      )}
    </>
  )
}
