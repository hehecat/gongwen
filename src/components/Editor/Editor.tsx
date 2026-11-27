import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import type { ViewLayoutMode } from '../Preview/Preview'
import './Editor.css'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  onFileImport: (file: File) => void
  importing?: boolean
  highlightRequest?: { lineNumber: number; seq: number } | null
  layoutMode: ViewLayoutMode
}

export const Editor = memo(function Editor({
  value,
  onChange,
  onFileImport,
  importing,
  highlightRequest,
  layoutMode,
}: EditorProps) {
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragCounterRef = useRef(0)

  // 响应来自右侧预览、结构大纲或规范校对的行定位请求
  useEffect(() => {
    if (!highlightRequest) return
    const { lineNumber } = highlightRequest

    const focusTimer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        const el = textareaRef.current
        if (!el) return
        const lines = value.split('\n')
        const targetIndex = Math.max(0, Math.min(lineNumber - 1, lines.length - 1))
        let startOffset = 0
        for (let i = 0; i < targetIndex; i++) {
          startOffset += lines[i].length + 1
        }
        const endOffset = startOffset + (lines[targetIndex]?.length ?? 0)
        el.focus()
        el.setSelectionRange(startOffset, endOffset)

        const computedLineHeight = parseFloat(getComputedStyle(el).lineHeight) || 26
        const targetScrollTop = Math.max(0, targetIndex * computedLineHeight - el.clientHeight * 0.35)
        el.scrollTop = targetScrollTop
      })
    }, 0)

    return () => window.clearTimeout(focusTimer)
  }, [highlightRequest, value])

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    dragCounterRef.current = 0

    const file = e.dataTransfer.files[0]
    if (file) onFileImport(file)
  }, [onFileImport])

  const isFocusEditor = layoutMode === 'editor'

  return (
    <div
      className={`editor-container ${isFocusEditor ? 'editor-container--focused' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className={`editor-sheet ${isFocusEditor ? 'editor-sheet--focused' : ''}`}>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`请粘贴公文文本，或将 .docx / .txt 文件拖入此处\n\n示例结构：\n关于加强安全生产工作的通知\n\n各部门：\n\n一、总体要求\n（一）指导思想\n1.落实责任分工\n（1）完善制度体系\n\n附件：1.实施方案 2.责任清单\n\nXX市人民政府办公厅\n2026年11月26日`}
          spellCheck={false}
          aria-label="公文正文编辑区"
        />
      </div>

      {dragging && (
        <div className="editor-drop-overlay">
          <span>释放 .docx 或 .txt 文件以导入</span>
        </div>
      )}
      {importing && (
        <div className="editor-drop-overlay editor-drop-overlay--importing">
          <span>正在提取文本…</span>
        </div>
      )}
    </div>
  )
})
