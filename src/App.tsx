import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from './components/Editor/Editor'
import { Preview, type ViewLayoutMode } from './components/Preview/Preview'
import { Toolbar } from './components/Toolbar/Toolbar'
import { Inspector, type InspectorTabId } from './components/Inspector/Inspector'
import type { TypoSectionId } from './components/Inspector/TypographyTab'
import { TemplateManagerModal } from './components/Modals/TemplateManagerModal'
import { AboutSpecModal } from './components/Modals/AboutSpecModal'
import { StatusBar } from './components/StatusBar/StatusBar'
import { Toast, type ToastItem } from './components/common/Toast'
import { ConfirmDialog, type ConfirmDialogState } from './components/common/ConfirmDialog'
import { useDocumentParser } from './hooks/useDocumentParser'
import { useDocumentDrafts } from './hooks/useDocumentDrafts'
import { useDocumentTemplates } from './hooks/useDocumentTemplates'
import type { PageSlice } from './hooks/usePagination'
import { useDocumentConfig } from './contexts/useDocumentConfig'
import { applyLineFixToText, checkGongwen, type CheckIssue } from './checker'
import { BUILTIN_TEMPLATES } from './utils/builtinTemplates'
import type { SampleDocument } from './utils/sampleDocuments'
import { sanitizeText } from './utils/sanitize'
import { isChunkLoadError, reloadOnceOnChunkError } from './utils/lazyImport'
import './App.css'

const SPLIT_STORAGE_KEY = 'gongwen-split-percent'

function loadSplitPercent(): number {
  try {
    const raw = Number(localStorage.getItem(SPLIT_STORAGE_KEY))
    if (Number.isFinite(raw) && raw >= 25 && raw <= 70) return raw
  } catch {
    // 忽略读取异常
  }
  return 44
}

function App() {
  const {
    drafts,
    activeDraft,
    saveState,
    updateActiveText,
    setActiveOverride,
    clearActiveOverrides,
    restoreActiveSnapshot,
    createDraft,
    selectDraft,
    deleteDraft,
  } = useDocumentDrafts()

  const { config, updateConfig, replaceConfig } = useDocumentConfig()
  const templateStore = useDocumentTemplates(config, replaceConfig)
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportStatusMessage, setExportStatusMessage] = useState('')
  const [layoutMode, setLayoutMode] = useState<ViewLayoutMode>('split')
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor')
  const [splitPercent, setSplitPercent] = useState<number>(loadSplitPercent)

  // 右侧停靠检查器默认收起
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('format')
  const [typoOpenSection, setTypoOpenSection] = useState<TypoSectionId | null>(null)
  const [templateModalState, setTemplateModalState] = useState<{
    open: boolean
    initialAction: 'browse' | 'create'
  }>({ open: false, initialAction: 'browse' })
  const [aboutModalOpen, setAboutModalOpen] = useState(false)

  const [pages, setPages] = useState<PageSlice[]>([])
  const [highlightRequest, setHighlightRequest] = useState<{ lineNumber: number; seq: number } | null>(null)
  const [toast, setToast] = useState<ToastItem | null>(null)

  const [confirmState, setConfirmState] = useState<{
    dialog: ConfirmDialogState
    onConfirm: () => void
    onCancel?: () => void
  } | null>(null)

  const mainContainerRef = useRef<HTMLDivElement>(null)
  const seqRef = useRef(0)

  const showToast = useCallback((next: Omit<ToastItem, 'id'>) => {
    setToast({ ...next, id: String(Date.now() + Math.random()) })
  }, [])

  const sanitizeResult = useMemo(
    () => sanitizeText(activeDraft.text, config.sanitize),
    [activeDraft.text, config.sanitize],
  )

  const ast = useDocumentParser(sanitizeResult.text, {
    overrides: activeDraft.overrides,
    parserConfig: config.parser,
  })

  const checkIssues = useMemo(
    () =>
      checkGongwen({
        ast,
        rawText: sanitizeResult.text,
        config,
        pages,
      }),
    [ast, config, pages, sanitizeResult.text],
  )

  const askConfirm = useCallback(
    (dialog: ConfirmDialogState): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmState({
          dialog,
          onConfirm: () => {
            setConfirmState(null)
            resolve(true)
          },
          onCancel: () => {
            setConfirmState(null)
            resolve(false)
          },
        })
      })
    },
    [],
  )

  const handleLocateLine = useCallback((lineNumber: number) => {
    seqRef.current += 1
    setHighlightRequest({ lineNumber, seq: seqRef.current })
    setMobilePane('editor')
    if (layoutMode === 'preview') {
      setLayoutMode('split')
    }
  }, [layoutMode])

  const handleExport = useCallback(async () => {
    if (ast.title === null && ast.body.length === 0) return
    setExporting(true)
    setExportStatusMessage('正在准备导出…')

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    try {
      const { downloadDocx } = await import('./exporter/download')
      try {
        sessionStorage.removeItem('chunk-reload-export')
      } catch {
        // 忽略 sessionStorage 异常
      }
      await downloadDocx(ast, configRef.current, {
        onStatusChange: (status) => setExportStatusMessage(status.message),
        onConfirmMultipart: (count, parts) => askConfirm({
          title: '超大文档分片导出确认',
          message: `当前文档共 ${count} 段，单文件打包可能导致浏览器内存占用过高。\n\n将自动拆分为 ${parts} 个 Word 文件依次下载，是否继续？`,
          confirmLabel: '继续分片导出',
        }),
      })
      showToast({ type: 'success', message: 'Word 文档已生成并开始下载。' })
    } catch (err) {
      if (reloadOnceOnChunkError(err, 'chunk-reload-export')) return
      console.error('导出失败:', err)
      showToast({
        type: 'error',
        message: isChunkLoadError(err)
          ? '导出模块加载失败，可能是网页版本已更新，请强制刷新页面后重试。'
          : '导出失败，请检查文档内容或浏览器权限后重试。',
      })
    } finally {
      setExporting(false)
      setExportStatusMessage('')
    }
  }, [askConfirm, ast, showToast])

  // 全局快捷键：Esc 依次关闭弹窗 / 窄屏检查器；Cmd/Ctrl+S 导出 Word；Cmd/Ctrl+\ 切换面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmState) {
          confirmState.onCancel?.()
          setConfirmState(null)
          return
        }
        if (templateModalState.open) {
          setTemplateModalState((prev) => ({ ...prev, open: false }))
          return
        }
        if (aboutModalOpen) {
          setAboutModalOpen(false)
          return
        }
        if (inspectorOpen && window.innerWidth < 1024) {
          setInspectorOpen(false)
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (!exporting && (ast.title !== null || ast.body.length > 0)) {
          void handleExport()
        }
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setInspectorOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    aboutModalOpen,
    ast.body.length,
    ast.title,
    confirmState,
    exporting,
    handleExport,
    inspectorOpen,
    templateModalState.open,
  ])

  const handleClear = useCallback(() => {
    const prevText = activeDraft.text
    const prevOverrides = activeDraft.overrides
    if (!prevText.trim()) return

    updateActiveText('')
    clearActiveOverrides()
    showToast({
      type: 'info',
      message: '已清空当前草稿内容。',
      durationMs: 6000,
      actionLabel: '撤销清空',
      onAction: () => {
        restoreActiveSnapshot(prevText, prevOverrides)
        showToast({ type: 'success', message: '已恢复草稿内容。' })
      },
    })
  }, [activeDraft.overrides, activeDraft.text, clearActiveOverrides, restoreActiveSnapshot, showToast, updateActiveText])

  const handleCopySanitized = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sanitizeResult.text)
      showToast({ type: 'success', message: '已复制规范化纯文本到剪贴板。' })
    } catch {
      showToast({ type: 'error', message: '剪贴板写入失败，请手动全选复制。' })
    }
  }, [sanitizeResult.text, showToast])

  const handleImport = useCallback(async (file: File) => {
    if (activeDraft.text.trim()) {
      const ok = await askConfirm({
        title: '覆盖当前草稿',
        message: `导入「${file.name}」将覆盖当前草稿内容，是否继续？`,
        confirmLabel: '确认覆盖',
      })
      if (!ok) return
    }

    setImporting(true)
    try {
      const { importFile } = await import('./utils/fileImporter')
      try {
        sessionStorage.removeItem('chunk-reload-import')
      } catch {
        // 忽略 sessionStorage 异常
      }
      const result = await importFile(file)
      updateActiveText(result.text)
      clearActiveOverrides()
      showToast({ type: 'success', message: `已导入「${result.fileName}」。` })
    } catch (err) {
      if (reloadOnceOnChunkError(err, 'chunk-reload-import')) return
      showToast({
        type: 'error',
        message: isChunkLoadError(err)
          ? '导入模块加载失败，可能是网页版本已更新，请强制刷新页面后重试。'
          : err instanceof Error ? err.message : '文件导入失败',
      })
    } finally {
      setImporting(false)
    }
  }, [activeDraft.text, askConfirm, clearActiveOverrides, showToast, updateActiveText])

  const handleLoadSample = useCallback(async (sample: SampleDocument) => {
    if (activeDraft.text.trim()) {
      const ok = await askConfirm({
        title: '载入示例公文',
        message: `载入「${sample.label}」将替换当前草稿内容，并切换为匹配的国标版式预设，是否继续？`,
        confirmLabel: '确认载入',
      })
      if (!ok) return
    }

    updateActiveText(sample.text)
    clearActiveOverrides()
    const preset = BUILTIN_TEMPLATES.find((t) => t.id === sample.builtinTemplateId)
    if (preset) {
      replaceConfig(preset.config)
    }
    showToast({ type: 'success', message: `已载入示例「${sample.label}」。` })
  }, [activeDraft.text, askConfirm, clearActiveOverrides, replaceConfig, showToast, updateActiveText])

  const handleApplyBuiltinTemplate = useCallback((templateId: string) => {
    const preset = BUILTIN_TEMPLATES.find((t) => t.id === templateId)
    if (!preset) return
    const prevConfig = configRef.current
    replaceConfig(preset.config)
    showToast({
      type: 'success',
      message: `已套用预设「${preset.name}」。`,
      durationMs: 5000,
      actionLabel: '撤销',
      onAction: () => replaceConfig(prevConfig),
    })
  }, [replaceConfig, showToast])

  const handleDeleteDraft = useCallback(async (draftId: string) => {
    const target = drafts.find((d) => d.id === draftId)
    if (!target) return
    if (target.text.trim()) {
      const ok = await askConfirm({
        title: '删除草稿',
        message: `确认删除草稿「${target.title}」？删除后不可恢复。`,
        confirmLabel: '确认删除',
        danger: true,
      })
      if (!ok) return
    }
    deleteDraft(draftId)
    showToast({ type: 'info', message: `已删除草稿「${target.title}」。` })
  }, [askConfirm, deleteDraft, drafts, showToast])

  const handleApplyCheckFix = useCallback((issue: CheckIssue) => {
    if (!issue.fix) return
    const fix = issue.fix
    if (fix.kind === 'replace-line' && fix.lineNumber && fix.replacementText !== undefined) {
      const rawLineCount = activeDraft.text.split('\n').length
      const sanitizedLineCount = sanitizeResult.text.split('\n').length
      const baseText = rawLineCount === sanitizedLineCount ? activeDraft.text : sanitizeResult.text
      updateActiveText(applyLineFixToText(baseText, fix.lineNumber, fix.replacementText))
      showToast({ type: 'success', message: `已修复第 ${fix.lineNumber} 行。` })
      return
    }
    if (fix.kind === 'update-doc-number' && fix.nextDocNumber) {
      updateConfig({ header: { docNumber: fix.nextDocNumber } })
      showToast({ type: 'success', message: `发文字号已规范为「${fix.nextDocNumber}」。` })
      return
    }
    if (fix.kind === 'adjust-line-spacing' && fix.nextLineSpacing) {
      const prevLineSpacing = configRef.current.body.lineSpacing
      const nextLineSpacing = fix.nextLineSpacing
      updateConfig({ body: { lineSpacing: nextLineSpacing } })
      showToast({
        type: 'success',
        message: `已将正文行距调至 ${nextLineSpacing} 磅。`,
        durationMs: 6000,
        actionLabel: '撤销',
        onAction: () => updateConfig({ body: { lineSpacing: prevLineSpacing } }),
      })
    }
  }, [activeDraft.text, sanitizeResult.text, showToast, updateActiveText, updateConfig])

  const handleApplyAllCheckFixes = useCallback(() => {
    const rawLineCount = activeDraft.text.split('\n').length
    const sanitizedLineCount = sanitizeResult.text.split('\n').length
    let nextText = rawLineCount === sanitizedLineCount ? activeDraft.text : sanitizeResult.text
    let fixedCount = 0

    for (const issue of checkIssues) {
      const fix = issue.fix
      if (!fix) continue
      if (fix.kind === 'replace-line' && fix.lineNumber && fix.replacementText !== undefined) {
        nextText = applyLineFixToText(nextText, fix.lineNumber, fix.replacementText)
        fixedCount++
      } else if (fix.kind === 'update-doc-number' && fix.nextDocNumber) {
        updateConfig({ header: { docNumber: fix.nextDocNumber } })
        fixedCount++
      } else if (fix.kind === 'adjust-line-spacing' && fix.nextLineSpacing) {
        updateConfig({ body: { lineSpacing: fix.nextLineSpacing } })
        fixedCount++
      }
    }

    if (nextText !== activeDraft.text) {
      updateActiveText(nextText)
    }
    if (fixedCount > 0) {
      showToast({ type: 'success', message: `已自动修复 ${fixedCount} 项规范问题。` })
    }
  }, [activeDraft.text, checkIssues, sanitizeResult.text, showToast, updateActiveText, updateConfig])

  const handleOpenTemplatesModal = useCallback((initialCreate = false) => {
    setTemplateModalState({
      open: true,
      initialAction: initialCreate ? 'create' : 'browse',
    })
  }, [])

  const handleOpenSanitizeFromStatus = useCallback(() => {
    setTypoOpenSection('sanitize')
    setInspectorTab('typography')
    setInspectorOpen(true)
  }, [])

  const handleOpenOutlineFromStatus = useCallback(() => {
    setInspectorTab('outline')
    setInspectorOpen(true)
  }, [])

  // 拖拽调节编辑区与预览区宽度（按编辑+预览局部容器宽计算）
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = mainContainerRef.current
    if (!container) return

    const prevUserSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const inspectorReserve = inspectorOpen && window.innerWidth >= 1024 ? 340 : 0
      const canvasWidth = rect.width - inspectorReserve
      if (canvasWidth <= 0) return
      const pct = ((moveEvent.clientX - rect.left) / canvasWidth) * 100
      const clamped = Math.min(70, Math.max(25, Math.round(pct * 10) / 10))
      setSplitPercent(clamped)
    }

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = prevUserSelect
      document.body.style.cursor = prevCursor
      setSplitPercent((latest) => {
        try {
          localStorage.setItem(SPLIT_STORAGE_KEY, String(latest))
        } catch {
          // 忽略存储异常
        }
        return latest
      })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [inspectorOpen])

  const editorStyle = layoutMode === 'split'
    ? {
        width: inspectorOpen
          ? `calc((100% - 340px - 1px) * ${splitPercent / 100})`
          : `calc((100% - 1px) * ${splitPercent / 100})`,
        flex: 'none',
      }
    : undefined

  return (
    <div className="app">
      <Toolbar
        ast={ast}
        drafts={drafts}
        activeDraft={activeDraft}
        layoutMode={layoutMode}
        onChangeLayoutMode={setLayoutMode}
        onSelectDraft={selectDraft}
        onCreateDraft={() => {
          createDraft('')
          showToast({ type: 'info', message: '已新建空白草稿。' })
        }}
        onDeleteDraft={handleDeleteDraft}
        onLoadSample={handleLoadSample}
        onClear={handleClear}
        onCopySanitized={handleCopySanitized}
        onImport={handleImport}
        onPrint={() => window.print()}
        onExport={handleExport}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((prev) => !prev)}
        issueCount={checkIssues.length}
        onOpenTemplatesModal={() => handleOpenTemplatesModal(false)}
        onOpenAboutModal={() => setAboutModalOpen(true)}
        importing={importing}
        exporting={exporting}
        exportStatusMessage={exportStatusMessage}
      />

      {/* 移动端分栏切换条 */}
      <div className="app-mobile-tabs" role="tablist" aria-label="移动端视图切换">
        <button
          type="button"
          className={`app-mobile-tab ${mobilePane === 'editor' ? 'app-mobile-tab--active' : ''}`}
          onClick={() => setMobilePane('editor')}
        >
          正文编辑
        </button>
        <button
          type="button"
          className={`app-mobile-tab ${mobilePane === 'preview' ? 'app-mobile-tab--active' : ''}`}
          onClick={() => setMobilePane('preview')}
        >
          A4 预览 ({pages.length}页)
        </button>
      </div>

      <div
        ref={mainContainerRef}
        className={`app-main app-main--${layoutMode} app-main--mobile-${mobilePane}`}
      >
        {layoutMode !== 'preview' && (
          <div className="app-editor" style={editorStyle}>
            <Editor
              value={activeDraft.text}
              onChange={updateActiveText}
              onFileImport={handleImport}
              importing={importing}
              highlightRequest={highlightRequest}
              layoutMode={layoutMode}
            />
          </div>
        )}

        {layoutMode === 'split' && (
          <div
            className="app-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调节编辑区与预览区宽度"
            onMouseDown={handleDividerMouseDown}
          />
        )}

        {layoutMode !== 'editor' && (
          <div className="app-preview">
            <Preview
              ast={ast}
              onSelectLine={handleLocateLine}
              onPagesChange={setPages}
            />
          </div>
        )}

        <Inspector
          open={inspectorOpen}
          activeTab={inspectorTab}
          onTabChange={(tab) => {
            setInspectorTab(tab)
            if (tab !== 'typography') setTypoOpenSection(null)
          }}
          onClose={() => setInspectorOpen(false)}
          templateStore={templateStore}
          onApplyBuiltinTemplate={handleApplyBuiltinTemplate}
          onOpenTemplatesModal={handleOpenTemplatesModal}
          typoOpenSection={typoOpenSection}
          onToggleTypoSection={(id) => {
            if (typoOpenSection === id) setTypoOpenSection(null)
          }}
          ast={ast}
          overrides={activeDraft.overrides}
          onChangeOverride={setActiveOverride}
          onClearOverrides={clearActiveOverrides}
          issues={checkIssues}
          onLocateLine={handleLocateLine}
          onApplyCheckFix={handleApplyCheckFix}
          onApplyAllCheckFixes={handleApplyAllCheckFixes}
        />
      </div>

      <StatusBar
        rawText={activeDraft.text}
        ast={ast}
        pageCount={pages.length}
        sanitizeCount={sanitizeResult.count}
        sanitizeEnabled={config.sanitize.enabled}
        overrideCount={Object.keys(activeDraft.overrides).length}
        saveState={saveState}
        onOpenOutline={handleOpenOutlineFromStatus}
        onOpenSanitizeSettings={handleOpenSanitizeFromStatus}
      />

      <TemplateManagerModal
        open={templateModalState.open}
        initialAction={templateModalState.initialAction}
        templateStore={templateStore}
        onApplyBuiltinTemplate={handleApplyBuiltinTemplate}
        onClose={() => setTemplateModalState((prev) => ({ ...prev, open: false }))}
      />

      <AboutSpecModal
        open={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />

      <ConfirmDialog
        dialog={confirmState?.dialog ?? null}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => confirmState?.onCancel?.()}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}

export default App
