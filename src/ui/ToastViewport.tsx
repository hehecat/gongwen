import { useEffect, useState } from 'react'
import { AlertIcon, CheckIcon, CloseIcon } from './icons'
import type { ToastItem } from './toastTypes'

interface ToastViewportProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

function SingleToast({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const [paused, setPaused] = useState(false)
  const duration = item.durationMs ?? (item.onAction ? 6200 : 3400)

  useEffect(() => {
    if (paused || duration <= 0) return
    const timer = window.setTimeout(() => {
      onDismiss(item.id)
    }, duration)
    return () => window.clearTimeout(timer)
  }, [duration, item.id, onDismiss, paused])

  const tone = item.tone ?? 'neutral'

  return (
    <div
      className={`cb-toast cb-toast--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="cb-toast-icon">
        {tone === 'success' ? (
          <CheckIcon size={15} />
        ) : tone === 'error' || tone === 'warning' ? (
          <AlertIcon size={15} />
        ) : (
          <span className="cb-toast-dot" />
        )}
      </span>
      <div className="cb-toast-body">
        <div className="cb-toast-msg">{item.message}</div>
        {item.detail && <div className="cb-toast-detail">{item.detail}</div>}
      </div>
      {item.actionLabel && item.onAction && (
        <button
          type="button"
          className="cb-toast-action"
          onClick={() => {
            item.onAction?.()
            onDismiss(item.id)
          }}
        >
          {item.actionLabel}
        </button>
      )}
      <button
        type="button"
        className="cb-toast-close"
        aria-label="关闭提示"
        onClick={() => onDismiss(item.id)}
      >
        <CloseIcon size={13} />
      </button>
    </div>
  )
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null

  return (
    <div className="cb-toast-viewport cb-no-print" aria-live="polite">
      {toasts.map((item) => (
        <SingleToast key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
