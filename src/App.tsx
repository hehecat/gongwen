import { useState, useCallback, useEffect, useRef } from 'react'
import { Editor } from './components/Editor/Editor'
import { Preview } from './components/Preview/Preview'
import { Toolbar } from './components/Toolbar/Toolbar'
import { useDocumentParser } from './hooks/useDocumentParser'
import { useDocumentConfig } from './contexts/useDocumentConfig'
import { downloadDocx } from './exporter'
import { parseGongwen } from './parser'
import { autoFixDocumentText, sanitizeText } from './utils/sanitize'
import { importFile } from './utils/fileImporter'
import {
  astToStyledHtml,
} from './utils/richText'
import './App.css'

const STORAGE_KEY_TEXT = 'docx-editor-source-text'
const STORAGE_KEY_FORMATTED = 'docx-editor-formatted-html'

/** 从 localStorage 读取持久化的编辑区文本 */
function loadSourceText(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_TEXT) ?? ''
  } catch {
    return ''
  }
}

function loadFormattedHtml(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_FORMATTED) ?? ''
  } catch {
    return ''
  }
}

function App() {
  const [text, setText] = useState(loadSourceText)
  const [formattedHtml, setFormattedHtml] = useState(loadFormattedHtml)
  const [importing, setImporting] = useState(false)
  const [fixFeedback, setFixFeedback] = useState('')

  const { config } = useDocumentConfig()
  const ast = useDocumentParser(formattedHtml)

  // Auto-Save: debounce 500ms 写入 localStorage
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY_TEXT, text)
      } catch {
        // localStorage 写入失败（空间不足等）静默忽略
      }
    }, 500)
    return () => clearTimeout(timerRef.current)
  }, [text])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_FORMATTED, formattedHtml)
    } catch {
      // 静默忽略
    }
  }, [formattedHtml])

  useEffect(() => {
    const sanitized = sanitizeText(text, config.textFixOptions).text
    const nextAst = parseGongwen(sanitized)
    setFormattedHtml(astToStyledHtml(nextAst, config))
  }, [config, text])

  useEffect(() => {
    if (!fixFeedback) return

    const timer = setTimeout(() => setFixFeedback(''), 3000)
    return () => clearTimeout(timer)
  }, [fixFeedback])

  const handleExport = useCallback(async () => {
    setExporting(true)

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    try {
      await downloadDocx(ast, configRef.current)
    } catch (err) {
      console.error('导出失败:', err)
      alert('导出失败，请检查控制台日志')
    } finally {
      setExporting(false)
    }
  }, [ast])

  const handleClear = useCallback(() => {
    setText('')
    setFormattedHtml('')
    try {
      localStorage.removeItem(STORAGE_KEY_TEXT)
      localStorage.removeItem(STORAGE_KEY_FORMATTED)
    } catch {
      // 静默忽略
    }
  }, [])

  const handleImport = useCallback(async (file: File) => {
    // 编辑器非空时，确认覆盖
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

  const handleAutoFix = useCallback(() => {
    const { textFixOptions } = config
    if (!textFixOptions.convertEnglishPunctuation && !textFixOptions.removeRedundantSpaces) {
      setFixFeedback('高级设置中已关闭全部文本修复选项')
      return
    }

    const result = autoFixDocumentText(text, textFixOptions)
    setText(result.text)

    if (result.count === 0) {
      setFixFeedback('未发现需要修复的标点或空格')
      return
    }

    const segments = []
    if (result.punctuationCount > 0) segments.push(`标点 ${result.punctuationCount} 处`)
    if (result.whitespaceCount > 0) segments.push(`空格 ${result.whitespaceCount} 处`)
    setFixFeedback(`已修复 ${result.count} 处：${segments.join('，')}`)
  }, [config, text])

  return (
    <div className="app">
      <Toolbar
        ast={ast}
        onExport={handleExport}
        onClear={handleClear}
        onImport={handleImport}
        importing={importing}
        exporting={exporting}
      />
      <div className="app-main">
        <div className="app-editor">
          <Editor
            value={text}
            onChange={setText}
            onFileImport={handleImport}
            importing={importing}
            canTextCleanup={text.trim().length > 0}
            fixFeedback={fixFeedback}
            onTextCleanup={handleAutoFix}
          />
        </div>
        <div className="app-preview">
          <Preview value={formattedHtml} onChange={setFormattedHtml} />
        </div>
      </div>
    </div>
  )
}

export default App
