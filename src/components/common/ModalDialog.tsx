import type { ReactNode } from 'react'
import './ModalDialog.css'

interface ModalDialogProps {
  open: boolean
  title: string
  subtitle?: string
  maxWidth?: number
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}

export function ModalDialog({
  open,
  title,
  subtitle,
  maxWidth = 600,
  onClose,
  footer,
  children,
}: ModalDialogProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${maxWidth}px, 100%)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-main">
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label={`关闭${title}`}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
