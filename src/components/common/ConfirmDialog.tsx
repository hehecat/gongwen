import './ConfirmDialog.css'

export interface ConfirmDialogState {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmDialogProps {
  dialog: ConfirmDialogState | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ dialog, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!dialog) return null

  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-header">
          <h3 className="confirm-title">{dialog.title}</h3>
        </div>
        <div className="confirm-body">
          <p className="confirm-message">{dialog.message}</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn confirm-btn--cancel" onClick={onCancel}>
            {dialog.cancelLabel ?? '取消'}
          </button>
          <button
            type="button"
            className={`confirm-btn ${dialog.danger ? 'confirm-btn--danger' : 'confirm-btn--primary'}`}
            onClick={onConfirm}
          >
            {dialog.confirmLabel ?? '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
