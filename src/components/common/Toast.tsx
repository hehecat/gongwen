import { useEffect } from 'react'
import './Toast.css'

export interface ToastItem {
  id: string
  type: 'info' | 'success' | 'error'
  message: string
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

interface ToastProps {
  toast: ToastItem | null
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onDismiss, toast.durationMs ?? 3600)
    return () => window.clearTimeout(timer)
  }, [onDismiss, toast])

  if (!toast) return null

  return (
    <div className={`app-toast app-toast--${toast.type}`} role="status" aria-live="polite">
      <span className="app-toast-message">{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          className="app-toast-action"
          onClick={() => {
            toast.onAction?.()
            onDismiss()
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="app-toast-close"
        onClick={onDismiss}
        aria-label="关闭提示"
      >
        ✕
      </button>
    </div>
  )
}
