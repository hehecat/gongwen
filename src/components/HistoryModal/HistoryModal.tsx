import { useCallback, useState } from 'react'
import type { HistoryRecord } from '../../types/history'
import './HistoryModal.css'

interface HistoryModalProps {
  open: boolean
  records: HistoryRecord[]
  onClose: () => void
  onRestore: (content: string) => void
  onDelete: (id: string) => void
  onClear: () => void
}

/**
 * 格式化时间为本地时间字符串
 * @param isoString - ISO 格式的时间字符串
 * @returns 格式化后的本地时间
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

/**
 * 计算文本字数（不含空白字符）
 * @param content - 文本内容
 * @returns 字数
 */
function countChars(content: string): number {
  return content.replace(/\s/g, '').length
}

/**
 * 历史记录弹窗组件
 * 展示保存的历史记录列表，支持恢复、删除操作
 */
export function HistoryModal({ open, records, onClose, onRestore, onDelete, onClear }: HistoryModalProps) {
  const [hoveredContent, setHoveredContent] = useState<string | null>(null)

  /**
   * 处理恢复操作
   */
  const handleRestore = useCallback(
    (content: string) => {
      onRestore(content)
      onClose()
    },
    [onRestore, onClose]
  )

  /**
   * 处理清空所有记录
   */
  const handleClear = useCallback(() => {
    if (records.length === 0) return
    if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      onClear()
    }
  }, [records.length, onClear])

  if (!open) return null

  return (
    <div className="history-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="history-header">
          <h2 className="history-title">历史记录</h2>
          <button className="history-close" onClick={onClose} aria-label="关闭">
            x
          </button>
        </div>

        <div className="history-body">
          {records.length === 0 ? (
            <div className="history-empty">
              <p className="history-empty-title">暂无保存的记录</p>
              <p className="history-empty-hint">点击编辑器底部的"保存"按钮可保存当前内容</p>
            </div>
          ) : (
            <div className="history-content-wrapper">
              <div className="history-list">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="history-item"
                    onClick={() => handleRestore(record.content)}
                    onMouseEnter={() => {
                      if (hoveredContent !== record.content) {
                        setHoveredContent(record.content)
                      }
                    }}
                  >
                    <div className="history-item-main">
                      <div className="history-item-title">
                        {record.title}
                        <span className="history-item-chars">（共{countChars(record.content)}字）</span>
                      </div>
                      <div className="history-item-time">{formatTime(record.savedAt)}</div>
                    </div>
                    <button
                      className="history-item-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(record.id)
                      }}
                      aria-label="删除"
                    >
                      <img src="/删除.svg" alt="删除" width="16" height="16" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="history-preview">
                <div className="history-preview-header">原文预览</div>
                <div className="history-preview-content">
                  {hoveredContent ? (
                    <pre className="history-preview-text">{hoveredContent}</pre>
                  ) : (
                    <p className="history-preview-placeholder">鼠标划过历史记录查看原文</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="history-footer">
          <span className="history-count">共 {records.length} 条记录</span>
          <button
            className="history-btn history-btn--clear"
            onClick={handleClear}
            disabled={records.length === 0}
          >
            清空所有记录
          </button>
        </div>
      </div>
    </div>
  )
}
