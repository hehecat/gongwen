import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { Toolbar } from './components/Toolbar/Toolbar'
import { DetectionPanel } from './components/DetectionPanel'
import { useDocumentParser } from './hooks/useDocumentParser'
import { useDocumentConfig } from './contexts/DocumentConfigContext'
import { downloadDocx } from './exporter'
import { sanitizeText } from './utils/sanitize'
import { importFile } from './utils/fileImporter'
import { getHistory, saveToHistory, deleteHistoryItem, clearHistory, isContentExists } from './utils/historyStorage'
import type { HistoryRecord } from './types/history'
import './App.css'

const STORAGE_KEY_TEXT = 'docx-editor-text'

/** 从 localStorage 读取持久化的编辑区文本 */
function loadText(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_TEXT) || ''
  } catch {
    return ''
  }
}

function App() {
  const [text, setText] = useState(loadText)
  const [importing, setImporting] = useState(false)
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>(() => getHistory())

  // 自动净化：解析前预处理，编辑器保留原文不干扰输入
  const sanitized = useMemo(() => sanitizeText(text).text, [text])
  const ast = useDocumentParser(sanitized)
  const { config } = useDocumentConfig()

  // Auto-Save: debounce 500ms 写入 localStorage
  const isContentDuplicate = useMemo(() => isContentExists(text), [text, historyRecords])

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_TEXT, text)
      } catch {
        // localStorage 写入失败静默忽略
      }
    }, 500)
    return () => clearTimeout(timerRef.current)
  }, [text])

  /**
   * 导出文档
   */
  const handleExport = useCallback(async () => {
    try {
      await downloadDocx(ast, config)
    } catch (err) {
      console.error('导出失败:', err)
      alert('导出失败，请检查控制台日志')
    }
  }, [ast, config])

  /**
   * 清空编辑器
   */
  const handleClear = useCallback(() => {
    setText('')
    try {
      localStorage.removeItem(STORAGE_KEY_TEXT)
    } catch {
      // 静默忽略
    }
  }, [])

  /**
   * 导入文件
   */
  const handleImport = useCallback(async (file: File) => {
    if (text.trim() && !confirm('导入文件将覆盖当前内容，是否继续？')) return

    setImporting(true)
    try {
      const result = await importFile(file)
      setText(result.text)
    } catch (err) {
      alert(err instanceof Error ? err.message : '文件导入失败')
    } finally {
      setImporting(false)
    }
  }, [text])

  /**
   * 保存当前内容到历史记录
   */
  const handleSave = useCallback(() => {
    if (!text.trim()) return
    const success = saveToHistory(text)
    if (success) {
      setHistoryRecords(getHistory())
    }
  }, [text])

  /**
   * 从历史记录恢复内容
   */
  const handleRestore = useCallback((content: string) => {
    setText(content)
  }, [])

  /**
   * 删除历史记录项
   */
  const handleDeleteHistory = useCallback((id: string) => {
    const updated = deleteHistoryItem(id)
    setHistoryRecords(updated)
  }, [])

  /**
   * 清空所有历史记录
   */
  const handleClearHistory = useCallback(() => {
    clearHistory()
    setHistoryRecords([])
  }, [])

  return (
    <div className="app">
      <Toolbar
        ast={ast}
        onExport={handleExport}
      />
      <div className="app-main">
        <div className="app-editor">
          <Editor
            value={text}
            onChange={setText}
            onFileImport={handleImport}
            importing={importing}
            onClear={handleClear}
            onSave={handleSave}
            historyRecords={historyRecords}
            onRestore={handleRestore}
            onDeleteHistory={handleDeleteHistory}
            onClearHistory={handleClearHistory}
            isContentDuplicate={isContentDuplicate}
          />
        </div>
        <div className="app-detection">
          <DetectionPanel ast={ast} />
        </div>
        <div className="app-preview">
          <Preview ast={ast} />
        </div>
      </div>
    </div>
  )
}

export default App
