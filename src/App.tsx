import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { applyLineFixToText, checkGongwen, type CheckIssue } from './checker'
import { useDocumentConfig } from './contexts/useDocumentConfig'
import type { ExportStatus } from './exporter/download'
import { useCustomFonts } from './hooks/useCustomFonts'
import { useDocumentDrafts } from './hooks/useDocumentDrafts'
import { useDocumentParser } from './hooks/useDocumentParser'
import { useDocumentTemplates } from './hooks/useDocumentTemplates'
import type { PageSlice } from './hooks/usePagination'
import { DEFAULT_CONFIG, type DeepPartial, type DocumentConfig } from './types/documentConfig'
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from './utils/builtinTemplates'
import { getDocumentConfigSignature } from './utils/documentTemplates'
import { reloadOnceOnChunkError } from './utils/lazyImport'
import { SAMPLE_DOCUMENTS, type SampleDocument } from './utils/sampleDocuments'
import { sanitizeText } from './utils/sanitize'
import { CommandPalette, type CommandItem } from './ui/CommandPalette'
import { UploadIcon } from './ui/icons'
import { InspectorStudio, type StudioTab } from './ui/InspectorStudio'
import { ManuscriptEditor, type LineJumpRequest } from './ui/ManuscriptEditor'
import { MultipartConfirmModal } from './ui/MultipartConfirmModal'
import { formatShortcut } from './ui/nodeMeta'
import { PreviewStage } from './ui/PreviewStage'
import { SpecAboutModal } from './ui/SpecAboutModal'
import { TemplateLibraryModal } from './ui/TemplateLibraryModal'
import type { ToastItem } from './ui/toastTypes'
import { ToastViewport } from './ui/ToastViewport'
import {
  TopConsole,
  type DesktopViewMode,
  type MobileTabMode,
} from './ui/TopConsole'

interface MultipartPromptState {
  paragraphCount: number
  totalParts: number
  resolve: (confirmed: boolean) => void
}

function cloneConfig(cfg: DocumentConfig): DocumentConfig {
  return JSON.parse(JSON.stringify(cfg)) as DocumentConfig
}

export default function App() {
  const { config, updateConfig, replaceConfig, resetConfig } = useDocumentConfig()
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

  const {
    activeTemplate,
    applyTemplate,
    commonTemplates,
    copyTemplate,
    currentConfigSignature,
    currentMatchingTemplate,
    deleteTemplate,
    exportAllTemplates,
    importTemplateCollectionDraft,
    isActiveTemplateDirty,
    pinTemplate,
    pinnedTemplateIds,
    readTemplateCollectionFile,
    saveCurrentAsTemplate,
    templateCount,
    templates,
    unpinTemplate,
    updateTemplateMeta,
  } = useDocumentTemplates(config, replaceConfig)

  const { customFonts, addFont, removeFont } = useCustomFonts()

  // Workspace UI states
  const [desktopMode, setDesktopMode] = useState<DesktopViewMode>('split')
  const [mobileTab, setMobileTab] = useState<MobileTabMode>('write')
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true)
  const [studioTab, setStudioTab] = useState<StudioTab>('layout')

  const [templateModalMode, setTemplateModalMode] = useState<'list' | 'create' | null>(null)
  const [specModalOpen, setSpecModalOpen] = useState<boolean>(false)
  const [cmdOpen, setCmdOpen] = useState<boolean>(false)
  const [multipartPrompt, setMultipartPrompt] = useState<MultipartPromptState | null>(null)

  const [pages, setPages] = useState<PageSlice[]>([])
  const [jumpRequest, setJumpRequest] = useState<LineJumpRequest | null>(null)
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dragDepthRef = useRef(0)
  const toastSeqRef = useRef(0)

  const pushToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    toastSeqRef.current += 1
    const id = `toast-${toastSeqRef.current}`
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Sanitize & AST Parse Pipeline
  const sanitizeResult = useMemo(
    () => sanitizeText(activeDraft.text, config.sanitize),
    [activeDraft.text, config.sanitize],
  )

  const ast = useDocumentParser(sanitizeResult.text, {
    overrides: activeDraft.overrides,
    parserConfig: config.parser,
  })

  // Reactive GB/T 9704—2012 Compliance Checker
  const issues = useMemo(
    () =>
      checkGongwen({
        ast,
        rawText: sanitizeResult.text,
        config,
        pages,
      }),
    [ast, config, pages, sanitizeResult.text],
  )

  const errorCount = useMemo(
    () => issues.filter((i) => i.severity === 'error').length,
    [issues],
  )

  const hasContent = activeDraft.text.trim().length > 0
  const paragraphCount = (ast.title ? 1 : 0) + ast.body.length

  // Match active built-in preset or custom template signature
  const builtinSignatures = useMemo(
    () =>
      BUILTIN_TEMPLATES.map((preset) => ({
        preset,
        sig: getDocumentConfigSignature(preset.config),
      })),
    [],
  )
  const defaultSig = useMemo(() => getDocumentConfigSignature(DEFAULT_CONFIG), [])

  const matchedBuiltin = useMemo(
    () => builtinSignatures.find((item) => item.sig === currentConfigSignature)?.preset ?? null,
    [builtinSignatures, currentConfigSignature],
  )

  const { activePresetLabel, isPresetModified } = useMemo(() => {
    if (activeTemplate && !isActiveTemplateDirty) {
      return { activePresetLabel: activeTemplate.name, isPresetModified: false }
    }
    if (currentMatchingTemplate) {
      return { activePresetLabel: currentMatchingTemplate.name, isPresetModified: false }
    }
    if (matchedBuiltin) {
      return {
        activePresetLabel: matchedBuiltin.name.replace(/^GB\/T 9704 /, ''),
        isPresetModified: false,
      }
    }
    if (currentConfigSignature === defaultSig) {
      return { activePresetLabel: '国标默认（无红头）', isPresetModified: false }
    }
    if (activeTemplate && isActiveTemplateDirty) {
      return { activePresetLabel: `${activeTemplate.name} · 已微调`, isPresetModified: true }
    }
    return { activePresetLabel: '自定义版式', isPresetModified: true }
  }, [
    activeTemplate,
    currentConfigSignature,
    currentMatchingTemplate,
    defaultSig,
    isActiveTemplateDirty,
    matchedBuiltin,
  ])

  // Line jump handler (from A4 preview click, Outline click, or Checker click)
  const handleJumpLine = useCallback(
    (lineNumber: number) => {
      if (desktopMode === 'preview') {
        setDesktopMode('split')
      }
      setMobileTab('write')
      setJumpRequest((prev) => ({
        lineNumber,
        seq: (prev?.seq ?? 0) + 1,
      }))
    },
    [desktopMode],
  )

  // Apply Builtin Preset
  const handleApplyBuiltin = useCallback(
    (preset: BuiltinTemplate) => {
      const prevSnapshot = cloneConfig(config)
      replaceConfig(cloneConfig(preset.config))
      pushToast({
        tone: 'success',
        message: `已切换版式预设「${preset.name}」`,
        actionLabel: '撤销',
        onAction: () => replaceConfig(prevSnapshot),
      })
    },
    [config, pushToast, replaceConfig],
  )

  // Load Sample Document + Matching Builtin Preset
  const handleLoadSample = useCallback(
    (sample: SampleDocument) => {
      const prevText = activeDraft.text
      const prevOverrides = { ...activeDraft.overrides }
      const prevConfig = cloneConfig(config)

      const targetBuiltin = BUILTIN_TEMPLATES.find(
        (b) => b.id === sample.builtinTemplateId,
      )
      if (targetBuiltin) {
        replaceConfig(cloneConfig(targetBuiltin.config))
      }
      restoreActiveSnapshot(sample.text, {})
      setMobileTab('preview')

      pushToast({
        tone: 'success',
        message: `已载入范文「${sample.label}」`,
        actionLabel: prevText.trim() ? '撤销' : undefined,
        onAction: prevText.trim()
          ? () => {
              restoreActiveSnapshot(prevText, prevOverrides)
              replaceConfig(prevConfig)
            }
          : undefined,
      })
    },
    [activeDraft.overrides, activeDraft.text, config, pushToast, replaceConfig, restoreActiveSnapshot],
  )

  // File Import (.docx / .txt)
  const handleImportFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return

      try {
        const mod = await import('./utils/fileImporter')
        const result = await mod.importFile(file)
        const prevText = activeDraft.text
        const prevOverrides = { ...activeDraft.overrides }

        restoreActiveSnapshot(result.text, {})
        pushToast({
          tone: 'success',
          message: `已导入「${result.fileName}」`,
          detail: `共提取 ${result.text.replace(/\s/g, '').length.toLocaleString()} 字`,
          actionLabel: prevText.trim() ? '撤销' : undefined,
          onAction: prevText.trim()
            ? () => restoreActiveSnapshot(prevText, prevOverrides)
            : undefined,
        })
      } catch (err) {
        if (reloadOnceOnChunkError(err, 'chunk-reload-importer')) return
        const msg = err instanceof Error ? err.message : '导入文件失败'
        pushToast({ tone: 'error', message: msg })
      }
    },
    [activeDraft.overrides, activeDraft.text, pushToast, restoreActiveSnapshot],
  )

  // Commit Sanitized Text Back to Raw Editor
  const handleCommitSanitizedToRaw = useCallback(() => {
    if (sanitizeResult.count === 0) return
    const prevText = activeDraft.text
    const prevOverrides = { ...activeDraft.overrides }
    updateActiveText(sanitizeResult.text)
    pushToast({
      tone: 'success',
      message: `已将 ${sanitizeResult.count} 处标点与空白净化写回原文`,
      actionLabel: '撤销',
      onAction: () => restoreActiveSnapshot(prevText, prevOverrides),
    })
  }, [
    activeDraft.overrides,
    activeDraft.text,
    pushToast,
    restoreActiveSnapshot,
    sanitizeResult.count,
    sanitizeResult.text,
    updateActiveText,
  ])

  // Copy Sanitized Text
  const handleCopySanitized = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(sanitizeResult.text)
      pushToast({ tone: 'success', message: '已复制净化后的公文纯文本' })
      return true
    } catch {
      pushToast({ tone: 'error', message: '复制失败，请检查浏览器剪贴板权限' })
      return false
    }
  }, [pushToast, sanitizeResult.text])

  // Clear Active Draft with 1-Click Undo
  const handleClearText = useCallback(() => {
    if (!activeDraft.text.trim()) return
    const prevText = activeDraft.text
    const prevOverrides = { ...activeDraft.overrides }
    restoreActiveSnapshot('', {})
    pushToast({
      tone: 'neutral',
      message: '已清空当前文稿',
      actionLabel: '撤销',
      onAction: () => restoreActiveSnapshot(prevText, prevOverrides),
    })
  }, [activeDraft.overrides, activeDraft.text, pushToast, restoreActiveSnapshot])

  // Reset Config to GB/T 9704 Default with 1-Click Undo
  const handleResetConfig = useCallback(() => {
    const prevConfig = cloneConfig(config)
    resetConfig()
    pushToast({
      tone: 'neutral',
      message: '已恢复 GB/T 9704—2012 国标默认参数',
      actionLabel: '撤销',
      onAction: () => replaceConfig(prevConfig),
    })
  }, [config, pushToast, replaceConfig, resetConfig])

  // Apply Single Compliance Fix with Undo
  const handleApplyIssueFix = useCallback(
    (issue: CheckIssue) => {
      const fix = issue.fix
      if (!fix) return

      const prevText = activeDraft.text
      const prevOverrides = { ...activeDraft.overrides }
      const prevConfig = cloneConfig(config)

      if (fix.kind === 'replace-line' && fix.lineNumber !== undefined && fix.replacementText !== undefined) {
        const baseText =
          activeDraft.text.split('\n').length === sanitizeResult.text.split('\n').length
            ? activeDraft.text
            : sanitizeResult.text
        const nextText = applyLineFixToText(baseText, fix.lineNumber, fix.replacementText)
        updateActiveText(nextText)
      } else if (fix.kind === 'update-doc-number' && fix.nextDocNumber !== undefined) {
        updateConfig({ header: { docNumber: fix.nextDocNumber } })
      } else if (fix.kind === 'adjust-line-spacing' && fix.nextLineSpacing !== undefined) {
        updateConfig({ body: { lineSpacing: fix.nextLineSpacing } })
      }

      pushToast({
        tone: 'success',
        message: `已执行修复：${fix.label}`,
        actionLabel: '撤销',
        durationMs: 6000,
        onAction: () => {
          restoreActiveSnapshot(prevText, prevOverrides)
          replaceConfig(prevConfig)
        },
      })
    },
    [
      activeDraft.overrides,
      activeDraft.text,
      config,
      pushToast,
      replaceConfig,
      restoreActiveSnapshot,
      sanitizeResult.text,
      updateActiveText,
      updateConfig,
    ],
  )

  // Apply ALL Auto-Fixable Compliance Issues with 6s Undo
  const handleApplyAllFixes = useCallback(() => {
    const fixable = issues.filter((i) => Boolean(i.fix))
    if (fixable.length === 0) return

    const prevText = activeDraft.text
    const prevOverrides = { ...activeDraft.overrides }
    const prevConfig = cloneConfig(config)

    let workingText =
      activeDraft.text.split('\n').length === sanitizeResult.text.split('\n').length
        ? activeDraft.text
        : sanitizeResult.text
    let textChanged = false
    const configPatch: DeepPartial<DocumentConfig> = {}
    let configChanged = false

    for (const issue of fixable) {
      const fix = issue.fix!
      if (fix.kind === 'replace-line' && fix.lineNumber !== undefined && fix.replacementText !== undefined) {
        workingText = applyLineFixToText(workingText, fix.lineNumber, fix.replacementText)
        textChanged = true
      } else if (fix.kind === 'update-doc-number' && fix.nextDocNumber !== undefined) {
        configPatch.header = { ...configPatch.header, docNumber: fix.nextDocNumber }
        configChanged = true
      } else if (fix.kind === 'adjust-line-spacing' && fix.nextLineSpacing !== undefined) {
        configPatch.body = { ...configPatch.body, lineSpacing: fix.nextLineSpacing }
        configChanged = true
      }
    }

    if (textChanged) {
      updateActiveText(workingText)
    }
    if (configChanged) {
      updateConfig(configPatch)
    }

    pushToast({
      tone: 'success',
      message: `已一键修复 ${fixable.length} 项国标规范问题`,
      actionLabel: '撤销全部',
      durationMs: 6500,
      onAction: () => {
        restoreActiveSnapshot(prevText, prevOverrides)
        replaceConfig(prevConfig)
      },
    })
  }, [
    activeDraft.overrides,
    activeDraft.text,
    config,
    issues,
    pushToast,
    replaceConfig,
    restoreActiveSnapshot,
    sanitizeResult.text,
    updateActiveText,
    updateConfig,
  ])

  // Export DOCX with Lazy Chunk Error Recovery + Multipart Modal Confirmation
  const handleExportDocx = useCallback(async () => {
    if (exportStatus) return
    try {
      setExportStatus({ stage: 'building', message: '正在准备导出引擎…' })
      const mod = await import('./exporter/download')
      await mod.downloadDocx(ast, config, {
        onStatusChange: (status) => setExportStatus(status),
        onConfirmMultipart: (paragraphCount, totalParts) =>
          new Promise<boolean>((resolve) => {
            setMultipartPrompt({ paragraphCount, totalParts, resolve })
          }),
      })
      pushToast({
        tone: 'success',
        message: 'Word 公文（.docx）导出完成',
      })
    } catch (err) {
      if (reloadOnceOnChunkError(err, 'chunk-reload-exporter')) return
      const msg = err instanceof Error ? err.message : '导出 Word 失败'
      pushToast({ tone: 'error', message: msg })
    } finally {
      setExportStatus(null)
    }
  }, [ast, config, exportStatus, pushToast])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleOpenChecker = useCallback(() => {
    setInspectorOpen(true)
    setStudioTab('check')
    setMobileTab('studio')
  }, [])

  // Global Keyboard Shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+P, Cmd/Ctrl+K)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void handleExportDocx()
      } else if (key === 'p') {
        e.preventDefault()
        handlePrint()
      } else if (key === 'k') {
        e.preventDefault()
        setCmdOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleExportDocx, handlePrint])

  // Global File Drag-and-Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current += 1
    setIsDraggingFile(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    dragDepthRef.current = 0
    setIsDraggingFile(false)
    void handleImportFiles(e.dataTransfer.files)
  }

  // Command Palette Items
  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: 'export-docx',
        group: '导出',
        label: '导出标准 Word 公文 (.docx)',
        hint: formatShortcut('S'),
        keywords: 'word docx export 下载 导出',
        onRun: () => void handleExportDocx(),
      },
      {
        id: 'print-pdf',
        group: '导出',
        label: '打印公文或另存为 1:1 PDF',
        hint: formatShortcut('P'),
        keywords: 'print pdf 打印',
        onRun: handlePrint,
      },
      {
        id: 'open-layout',
        group: '排版',
        label: '打开「版式」面板（预设、红头、版记与页码）',
        keywords: 'layout format 版式 红头 版记 页码',
        onRun: () => {
          setInspectorOpen(true)
          setStudioTab('layout')
          setMobileTab('studio')
        },
      },
      {
        id: 'open-typography',
        group: '排版',
        label: '打开「字型」面板（边距、字体、净化与解析）',
        keywords: 'typography font margin 字型 字体 边距 净化',
        onRun: () => {
          setInspectorOpen(true)
          setStudioTab('typography')
          setMobileTab('studio')
        },
      },
      {
        id: 'open-outline',
        group: '大纲',
        label: '打开「大纲」面板（公文结构与单行纠偏）',
        keywords: 'outline structure 大纲 结构 纠偏',
        onRun: () => {
          setInspectorOpen(true)
          setStudioTab('outline')
          setMobileTab('studio')
        },
      },
      {
        id: 'open-check',
        group: '校对',
        label: `打开 GB/T 9704 规范校对面板（当前 ${issues.length} 项）`,
        keywords: 'check 体检 校对 规范',
        onRun: handleOpenChecker,
      },
      ...(issues.some((i) => Boolean(i.fix))
        ? [
            {
              id: 'fix-all',
              group: '校对',
              label: '一键修复全部可自动修正的规范问题',
              keywords: 'fix 修复 孤行 日期 字号',
              onRun: handleApplyAllFixes,
            },
          ]
        : []),
      {
        id: 'new-draft',
        group: '文稿',
        label: '新建空白公文草稿',
        keywords: 'new draft 新建 草稿',
        onRun: () => {
          createDraft('')
          pushToast({ tone: 'neutral', message: '已新建空白公文草稿' })
        },
      },
      {
        id: 'copy-sanitized',
        group: '文稿',
        label: '复制净化后的公文纯文本',
        keywords: 'copy 复制 净化',
        onRun: () => void handleCopySanitized(),
      },
      {
        id: 'view-split',
        group: '视图',
        label: '切换至「双栏对照」工作模式',
        onRun: () => setDesktopMode('split'),
      },
      {
        id: 'view-write',
        group: '视图',
        label: '切换至「专注起草」工作模式',
        onRun: () => setDesktopMode('write'),
      },
      {
        id: 'view-preview',
        group: '视图',
        label: '切换至「版面审阅」工作模式',
        onRun: () => setDesktopMode('preview'),
      },
      {
        id: 'toggle-studio',
        group: '视图',
        label: inspectorOpen ? '收起右侧排版台' : '展开右侧排版台',
        onRun: () => setInspectorOpen((v) => !v),
      },
      {
        id: 'open-templates',
        group: '模板',
        label: '管理自定义模板库 / 导入导出 JSON',
        keywords: 'template 模板 保存',
        onRun: () => setTemplateModalMode('list'),
      },
      {
        id: 'save-template',
        group: '模板',
        label: '将当前版式保存为新模板…',
        onRun: () => setTemplateModalMode('create'),
      },
      ...BUILTIN_TEMPLATES.map((preset) => ({
        id: `preset-${preset.id}`,
        group: '法定预设',
        label: `套用预设：${preset.name}`,
        hint: preset.badge,
        keywords: `${preset.name} ${preset.description}`,
        onRun: () => handleApplyBuiltin(preset),
      })),
      ...SAMPLE_DOCUMENTS.map((sample) => ({
        id: `sample-${sample.id}`,
        group: '标准范文',
        label: `载入范文：${sample.label}`,
        keywords: `${sample.label} 范文 示例`,
        onRun: () => handleLoadSample(sample),
      })),
      {
        id: 'open-spec',
        group: '参考',
        label: '查看 GB/T 9704—2012 国标速查与关于说明',
        keywords: 'about spec 国标 帮助 关于',
        onRun: () => setSpecModalOpen(true),
      },
      {
        id: 'reset-config',
        group: '版式',
        label: '恢复 GB/T 9704—2012 国标默认排版参数',
        keywords: 'reset 默认 重置',
        onRun: handleResetConfig,
      },
    ]
    return list
  }, [
    createDraft,
    handleApplyAllFixes,
    handleApplyBuiltin,
    handleCopySanitized,
    handleExportDocx,
    handleLoadSample,
    handleOpenChecker,
    handlePrint,
    handleResetConfig,
    inspectorOpen,
    issues,
    pushToast,
  ])

  return (
    <div
      className={`cb-app cb-desktop-${desktopMode} cb-mobile-${mobileTab}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <TopConsole
        drafts={drafts}
        activeDraft={activeDraft}
        saveState={saveState}
        onSelectDraft={selectDraft}
        onCreateDraft={() => {
          createDraft('')
          pushToast({ tone: 'neutral', message: '已创建新草稿' })
        }}
        onDeleteDraft={(id) => {
          deleteDraft(id)
          pushToast({ tone: 'neutral', message: '已移除草稿' })
        }}
        activePresetLabel={activePresetLabel}
        isPresetModified={isPresetModified}
        builtinTemplates={BUILTIN_TEMPLATES}
        activeBuiltinId={matchedBuiltin?.id ?? null}
        commonTemplates={commonTemplates}
        activeCustomTemplateId={activeTemplate?.id ?? currentMatchingTemplate?.id ?? null}
        pinnedTemplateIds={pinnedTemplateIds}
        templateCount={templateCount}
        onApplyBuiltin={handleApplyBuiltin}
        onApplyCustomTemplate={(id) => {
          applyTemplate(id)
          const tpl = templates.find((t) => t.id === id)
          if (tpl) {
            pushToast({ tone: 'success', message: `已套用模板「${tpl.name}」` })
          }
        }}
        onOpenTemplateModal={(mode = 'list') => setTemplateModalMode(mode)}
        desktopMode={desktopMode}
        onChangeDesktopMode={setDesktopMode}
        mobileTab={mobileTab}
        onChangeMobileTab={setMobileTab}
        issueCount={issues.length}
        errorCount={errorCount}
        hasContent={hasContent}
        onOpenChecker={handleOpenChecker}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((prev) => !prev)}
        onOpenCommandPalette={() => setCmdOpen(true)}
        onOpenSpecModal={() => setSpecModalOpen(true)}
        onPrint={handlePrint}
        onExportDocx={() => void handleExportDocx()}
        exportStatus={exportStatus}
      />

      <main className="cb-workspace">
        <ManuscriptEditor
          text={activeDraft.text}
          onChangeText={updateActiveText}
          overrides={activeDraft.overrides}
          issues={issues}
          sanitizeConfig={config.sanitize}
          sanitizeResult={sanitizeResult}
          onUpdateSanitize={(patch) => updateConfig({ sanitize: patch })}
          onCommitSanitizedToRaw={handleCommitSanitizedToRaw}
          samples={SAMPLE_DOCUMENTS}
          onLoadSample={handleLoadSample}
          onImportFiles={(files) => void handleImportFiles(files)}
          onClearText={handleClearText}
          onCopySanitized={handleCopySanitized}
          paragraphCount={paragraphCount}
          pageCount={pages.length}
          jumpRequest={jumpRequest}
        />

        {/* Always mounted in DOM so usePagination + @media print work across every view mode */}
        <PreviewStage
          ast={ast}
          config={config}
          draftId={activeDraft.id}
          hiddenOnScreen={desktopMode === 'write'}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((prev) => !prev)}
          onSelectLine={handleJumpLine}
          onPagesChange={setPages}
        />

        <InspectorStudio
          open={inspectorOpen}
          activeTab={studioTab}
          onChangeTab={setStudioTab}
          config={config}
          updateConfig={updateConfig}
          onResetConfig={handleResetConfig}
          builtinTemplates={BUILTIN_TEMPLATES}
          activeBuiltinId={matchedBuiltin?.id ?? null}
          onApplyBuiltin={handleApplyBuiltin}
          activePresetLabel={activePresetLabel}
          isPresetModified={isPresetModified}
          commonTemplates={commonTemplates}
          activeCustomTemplateId={activeTemplate?.id ?? currentMatchingTemplate?.id ?? null}
          onApplyCustomTemplate={(id) => {
            applyTemplate(id)
            const tpl = templates.find((t) => t.id === id)
            if (tpl) {
              pushToast({ tone: 'success', message: `已套用模板「${tpl.name}」` })
            }
          }}
          onOpenTemplateModal={(mode = 'list') => setTemplateModalMode(mode)}
          customFonts={customFonts}
          onAddCustomFont={addFont}
          onRemoveCustomFont={removeFont}
          sanitizeCount={config.sanitize.enabled ? sanitizeResult.count : 0}
          onCommitSanitizedToRaw={handleCommitSanitizedToRaw}
          ast={ast}
          overrides={activeDraft.overrides}
          onJumpLine={handleJumpLine}
          onSetOverride={setActiveOverride}
          onClearOverrides={() => {
            clearActiveOverrides()
            pushToast({ tone: 'neutral', message: '已恢复全部段落自动语义识别' })
          }}
          issues={issues}
          hasContent={hasContent}
          onApplyIssueFix={handleApplyIssueFix}
          onApplyAllFixes={handleApplyAllFixes}
          onNotifyError={(msg) => pushToast({ tone: 'error', message: msg })}
          onNotifySuccess={(msg) => pushToast({ tone: 'success', message: msg })}
        />
      </main>

      {/* Drag-Over File Import Overlay */}
      {isDraggingFile && (
        <div className="cb-drop-overlay cb-no-print" aria-hidden="true">
          <div className="cb-drop-card">
            <UploadIcon size={26} />
            <div className="cb-drop-title">松开鼠标即可导入公文原稿</div>
            <div className="cb-drop-sub">支持 Word（.docx）与纯文本（.txt）自动提取段落</div>
          </div>
        </div>
      )}

      {/* Modals & Overlays */}
      {templateModalMode && (
        <TemplateLibraryModal
          initialMode={templateModalMode}
          config={config}
          builtinTemplates={BUILTIN_TEMPLATES}
          activeBuiltinId={matchedBuiltin?.id ?? null}
          onApplyBuiltin={handleApplyBuiltin}
          templates={templates}
          activeTemplate={activeTemplate}
          isActiveTemplateDirty={isActiveTemplateDirty}
          pinnedTemplateIds={pinnedTemplateIds}
          onApplyTemplate={applyTemplate}
          onSaveCurrentAsTemplate={saveCurrentAsTemplate}
          onUpdateTemplateMeta={updateTemplateMeta}
          onCopyTemplate={copyTemplate}
          onDeleteTemplate={deleteTemplate}
          onPinTemplate={pinTemplate}
          onUnpinTemplate={unpinTemplate}
          onExportAllTemplates={exportAllTemplates}
          onReadTemplateCollectionFile={readTemplateCollectionFile}
          onImportTemplateCollectionDraft={importTemplateCollectionDraft}
          onClose={() => setTemplateModalMode(null)}
          onNotifySuccess={(message, detail) =>
            pushToast({ tone: 'success', message, detail })
          }
          onNotifyError={(message) => pushToast({ tone: 'error', message })}
        />
      )}

      {specModalOpen && <SpecAboutModal onClose={() => setSpecModalOpen(false)} />}

      {cmdOpen && (
        <CommandPalette commands={commands} onClose={() => setCmdOpen(false)} />
      )}

      {multipartPrompt && (
        <MultipartConfirmModal
          paragraphCount={multipartPrompt.paragraphCount}
          totalParts={multipartPrompt.totalParts}
          onConfirm={() => {
            multipartPrompt.resolve(true)
            setMultipartPrompt(null)
          }}
          onCancel={() => {
            multipartPrompt.resolve(false)
            setMultipartPrompt(null)
          }}
        />
      )}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
