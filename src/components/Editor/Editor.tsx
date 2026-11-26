import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react'
import { NodeType, type DocumentNode, type GongwenAST, type NodeTypeOverrides } from '../../types/ast'
import type { ViewLayoutMode } from '../Preview/Preview'
import './Editor.css'

interface EditorProps {
  value: string
  onChange: (value: string) => void
  ast: GongwenAST
  overrides: NodeTypeOverrides
  onChangeOverride: (lineNumber: number, nodeType: NodeType | null) => void
  onClearOverrides: () => void
  onFileImport: (file: File) => void
  onCopySanitized: () => void
  onClear: () => void
  importing?: boolean
  highlightRequest?: { lineNumber: number; seq: number } | null
  layoutMode: ViewLayoutMode
  onChangeLayoutMode: (mode: ViewLayoutMode) => void
}

const NODE_TYPE_META: Record<NodeType, { label: string; colorClass: string }> = {
  [NodeType.DOCUMENT_TITLE]: { label: '公文标题', colorClass: 'node-badge--title' },
  [NodeType.ADDRESSEE]: { label: '主送机关', colorClass: 'node-badge--meta' },
  [NodeType.HEADING_1]: { label: '一级标题', colorClass: 'node-badge--h1' },
  [NodeType.HEADING_2]: { label: '二级标题', colorClass: 'node-badge--h2' },
  [NodeType.HEADING_3]: { label: '三级标题', colorClass: 'node-badge--h3' },
  [NodeType.HEADING_4]: { label: '四级标题', colorClass: 'node-badge--h4' },
  [NodeType.PARAGRAPH]: { label: '正文段落', colorClass: 'node-badge--body' },
  [NodeType.ATTACHMENT]: { label: '附件说明', colorClass: 'node-badge--att' },
  [NodeType.ATTACHMENT_PAGE_HEADER]: { label: '附件另面', colorClass: 'node-badge--att' },
  [NodeType.SIGNATURE]: { label: '发文署名', colorClass: 'node-badge--sig' },
  [NodeType.DATE]: { label: '成文日期', colorClass: 'node-badge--sig' },
  [NodeType.POSTSCRIPT]: { label: '附注', colorClass: 'node-badge--meta' },
  [NodeType.MINUTES_ATTENDANCE]: { label: '纪要出席', colorClass: 'node-badge--meta' },
}

const OVERRIDE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: NodeType.DOCUMENT_TITLE, label: '公文标题' },
  { value: NodeType.ADDRESSEE, label: '主送机关' },
  { value: NodeType.HEADING_1, label: '一级标题' },
  { value: NodeType.HEADING_2, label: '二级标题' },
  { value: NodeType.HEADING_3, label: '三级标题' },
  { value: NodeType.HEADING_4, label: '四级标题' },
  { value: NodeType.PARAGRAPH, label: '正文段落' },
  { value: NodeType.ATTACHMENT, label: '附件说明' },
  { value: NodeType.ATTACHMENT_PAGE_HEADER, label: '附件另面标识' },
  { value: NodeType.SIGNATURE, label: '发文署名' },
  { value: NodeType.DATE, label: '成文日期' },
  { value: NodeType.POSTSCRIPT, label: '附注' },
  { value: NodeType.MINUTES_ATTENDANCE, label: '纪要出席/列席' },
]

export const Editor = memo(function Editor({
  value,
  onChange,
  ast,
  overrides,
  onChangeOverride,
  onClearOverrides,
  onFileImport,
  onCopySanitized,
  onClear,
  importing,
  highlightRequest,
  layoutMode,
  onChangeLayoutMode,
}: EditorProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'structure'>('text')
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dragCounterRef = useRef(0)

  const overrideCount = Object.keys(overrides).length
  const allNodes = useMemo<DocumentNode[]>(() => {
    const list: DocumentNode[] = []
    if (ast.title) list.push(ast.title)
    list.push(...ast.body)
    return list
  }, [ast.body, ast.title])

  // 响应来自右侧预览或公文体检的行定位请求
  useEffect(() => {
    if (!highlightRequest) return
    const { lineNumber } = highlightRequest

    const focusTimer = window.setTimeout(() => {
      setActiveTab('text')
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

        // 粗略估算目标行滚动位置，保证行可见
        const computedLineHeight = parseFloat(getComputedStyle(el).lineHeight) || 25
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

  const hasContent = value.trim().length > 0

  return (
    <div
      className="editor-container"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="editor-header">
        <div className="editor-tabs" role="tablist" aria-label="编辑视图">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'text'}
            className={`editor-tab ${activeTab === 'text' ? 'editor-tab--active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            原文编辑
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'structure'}
            className={`editor-tab ${activeTab === 'structure' ? 'editor-tab--active' : ''}`}
            onClick={() => setActiveTab('structure')}
          >
            结构标注
            {allNodes.length > 0 && (
              <span className="editor-tab-count">{allNodes.length}</span>
            )}
            {overrideCount > 0 && (
              <span className="editor-tab-override" title="存在手动类型覆写">
                ·{overrideCount}改
              </span>
            )}
          </button>
        </div>

        <div className="editor-header-actions">
          <button
            type="button"
            className="editor-action-btn"
            onClick={onCopySanitized}
            disabled={!hasContent}
            title="复制已做全角标点净化和空白整理的纯文本"
          >
            复制净稿
          </button>
          <button
            type="button"
            className="editor-action-btn editor-action-btn--danger"
            onClick={onClear}
            disabled={!hasContent}
            title="清空当前草稿（清空后支持 6 秒内撤销）"
          >
            清空
          </button>
          <button
            type="button"
            className="editor-action-btn"
            onClick={() => onChangeLayoutMode(layoutMode === 'editor' ? 'split' : 'editor')}
            title={layoutMode === 'editor' ? '恢复双栏对照' : '专注编辑'}
          >
            {layoutMode === 'editor' ? '双栏' : '专注'}
          </button>
        </div>
      </div>

      {activeTab === 'text' ? (
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`请粘贴公文文本，或将 .docx / .txt 文件拖入此处\n\n示例结构：\n关于加强安全生产工作的通知\n\n各部门：\n\n一、总体要求\n（一）指导思想\n1.落实责任分工\n（1）完善制度体系\n\n附件：1.实施方案 2.责任清单\n\nXX市人民政府办公厅\n2026年11月26日`}
          spellCheck={false}
        />
      ) : (
        <div className="editor-structure-view">
          <div className="editor-structure-toolbar">
            <span className="editor-structure-hint">
              可对单段识别结果进行手动修正（仅作用于当前草稿）；点击右侧预览段落可定位正文行。
            </span>
            {overrideCount > 0 && (
              <button
                type="button"
                className="editor-action-btn"
                onClick={onClearOverrides}
              >
                恢复全部自动识别 ({overrideCount})
              </button>
            )}
          </div>

          {allNodes.length === 0 ? (
            <div className="editor-structure-empty">
              暂无可识别的段落，请先在「原文编辑」中输入或导入公文内容。
            </div>
          ) : (
            <div className="editor-structure-list">
              {allNodes.map((node, idx) => {
                const meta = NODE_TYPE_META[node.type]
                const manualOverride = overrides[node.lineNumber]
                return (
                  <div key={`${node.lineNumber}-${idx}`} className="editor-structure-card">
                    <div className="editor-structure-card-top">
                      <button
                        type="button"
                        className="editor-structure-line-btn"
                        onClick={() => {
                          setActiveTab('text')
                          window.requestAnimationFrame(() => {
                            const el = textareaRef.current
                            if (!el) return
                            const lines = value.split('\n')
                            let start = 0
                            for (let i = 0; i < node.lineNumber - 1 && i < lines.length; i++) {
                              start += lines[i].length + 1
                            }
                            const end = start + (lines[node.lineNumber - 1]?.length ?? 0)
                            el.focus()
                            el.setSelectionRange(start, end)
                          })
                        }}
                        title="跳转到原文此行"
                      >
                        L{node.lineNumber}
                      </button>
                      <span className={`editor-node-badge ${meta.colorClass}`}>
                        {meta.label}
                        {manualOverride ? '（手动）' : ''}
                      </span>
                      <select
                        className="editor-override-select"
                        aria-label={`第 ${node.lineNumber} 行段落类型`}
                        value={manualOverride ?? '__AUTO__'}
                        onChange={(e) => {
                          const val = e.target.value
                          onChangeOverride(
                            node.lineNumber,
                            val === '__AUTO__' ? null : (val as NodeType),
                          )
                        }}
                      >
                        <option value="__AUTO__">自动识别</option>
                        {OVERRIDE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            指定为：{opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="editor-structure-snippet">{node.content.replace(/\n/g, ' / ')}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
