import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent, type KeyboardEvent } from 'react'
import { HistoryModal } from '../HistoryModal'
import type { HistoryRecord } from '../../types/history'
import './Editor.css'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  /** 文件导入回调 */
  onFileImport: (file: File) => void
  /** 是否正在导入中 */
  importing?: boolean
  /** 清空回调 */
  onClear: () => void
  /** 保存回调 */
  onSave: () => void
  /** 历史记录列表 */
  historyRecords: HistoryRecord[]
  /** 恢复历史记录回调 */
  onRestore: (content: string) => void
  /** 删除历史记录回调 */
  onDeleteHistory: (id: string) => void
  /** 清空历史记录回调 */
  onClearHistory: () => void
  /** 当前内容是否已存在于历史记录 */
  isContentDuplicate: boolean
}

/**
 * 公文正文编辑器组件
 * 支持文件导入、拖拽上传、历史记录保存与恢复
 */
export function Editor({
  value,
  onChange,
  onFileImport,
  importing,
  onClear,
  onSave,
  historyRecords,
  onRestore,
  onDeleteHistory,
  onClearHistory,
  isContentDuplicate,
}: EditorProps) {
  const [dragging, setDragging] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleImportClick = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.click()
  }, [])

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (file) onFileImport(file)
    e.target.value = ''
  }, [onFileImport])

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

  /**
   * 显示保存成功通知
   */
  const showSaveToast = useCallback(() => {
    setShowToast(true)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false)
    }, 2000)
  }, [])

  /**
   * 处理保存操作
   */
  const handleSaveClick = useCallback(() => {
    if (isContentDuplicate) return
    onSave()
    showSaveToast()
  }, [onSave, showSaveToast, isContentDuplicate])

  /**
   * 处理键盘快捷键 Ctrl+S
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!isContentDuplicate && value.trim()) {
          handleSaveClick()
        }
      }
    },
    [handleSaveClick, isContentDuplicate, value]
  )

  /**
   * 全局键盘事件监听
   */
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!isContentDuplicate && value.trim()) {
          handleSaveClick()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown as unknown as EventListener)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown as unknown as EventListener)
    }
  }, [handleSaveClick, isContentDuplicate, value])

  const handleHistoryClick = useCallback(() => {
    setHistoryModalOpen(true)
  }, [])

  const handleCloseHistoryModal = useCallback(() => {
    setHistoryModalOpen(false)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(toastTimerRef.current)
    }
  }, [])

  const hasContent = value.trim().length > 0
  const historyCount = historyRecords.length
  const canSave = hasContent && !isContentDuplicate

  return (
    <div
      className="editor-container"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="editor-header">
        <span className="editor-label">公文正文（可拖入docx文件）</span>
        <span className="editor-hint">首行自动识别为标题，后续自动识别各级标题</span>
      </div>
      <textarea
        className="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`关于XXX的通知\n\n一、总体要求\n为深入贯彻落实……\n（一）指导思想\n坚持以……\n1.加强组织领导\n（1）制定实施方案\n各部门要……`}
        spellCheck={false}
      />
      <div className="editor-footer">
        <button
          className="editor-btn editor-btn--import"
          onClick={handleImportClick}
          disabled={importing}
          title="导入 .docx 或 .txt 文件"
        >
          {importing ? '导入中…' : '导入'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.txt,.doc,.wps"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          className="editor-btn editor-btn--clear"
          onClick={onClear}
          disabled={!hasContent}
        >
          清空
        </button>
        <button
          className="editor-btn editor-btn--save"
          onClick={handleSaveClick}
          disabled={!canSave}
          title={isContentDuplicate ? '内容已存在于历史记录中' : '保存当前内容到历史记录 (Ctrl+S)'}
        >
          保存
        </button>
        <button
          className="editor-btn editor-btn--history"
          onClick={handleHistoryClick}
          title="查看历史记录"
        >
          历史记录
          {historyCount > 0 && (
            <span className="editor-btn__badge">{historyCount > 99 ? '99+' : historyCount}</span>
          )}
        </button>
      </div>
      {dragging && (
        <div className="editor-drop-overlay">
          <span>释放文件以导入</span>
        </div>
      )}
      {importing && (
        <div className="editor-drop-overlay editor-drop-overlay--importing">
          <span>正在提取文本…</span>
        </div>
      )}
      {showToast && (
        <div className="editor-toast">
          <img src="/正确.svg" alt="" className="editor-toast__icon" />
          <span className="editor-toast__text">保存成功</span>
        </div>
      )}
      <HistoryModal
        open={historyModalOpen}
        records={historyRecords}
        onClose={handleCloseHistoryModal}
        onRestore={onRestore}
        onDelete={onDeleteHistory}
        onClear={onClearHistory}
      />
    </div>
  )
}
