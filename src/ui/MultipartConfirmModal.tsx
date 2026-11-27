import { useEffect } from 'react'
import { AlertIcon } from './icons'

interface MultipartConfirmModalProps {
  paragraphCount: number
  totalParts: number
  onConfirm: () => void
  onCancel: () => void
}

export function MultipartConfirmModal({
  paragraphCount,
  totalParts,
  onConfirm,
  onCancel,
}: MultipartConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="cb-modal-backdrop cb-no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="cb-modal cb-modal--sm"
        role="dialog"
        aria-modal="true"
        aria-label="超长公文分卷导出确认"
      >
        <div className="cb-confirm-body">
          <div className="cb-confirm-icon">
            <AlertIcon size={20} />
          </div>
          <h3 className="cb-modal-title">超长文稿分卷导出确认</h3>
          <p className="cb-confirm-desc cb-tabular">
            当前公文共 <strong>{paragraphCount.toLocaleString()}</strong> 段。为防止单个超大型
            Word 文件导致浏览器内存溢出，系统将自动按章节边界拆分为{' '}
            <strong>{totalParts}</strong> 个独立 <code>.docx</code> 文件依次下载（保证署名与成文日期不被拆散）。
          </p>
          <div className="cb-confirm-actions">
            <button
              type="button"
              className="cb-ctrl-btn cb-ctrl-btn--ghost"
              onClick={onCancel}
            >
              取消导出
            </button>
            <button
              type="button"
              className="cb-ctrl-btn cb-ctrl-btn--primary"
              onClick={onConfirm}
            >
              确认分 {totalParts} 卷导出
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
