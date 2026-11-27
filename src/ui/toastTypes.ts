export type ToastTone = 'neutral' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  message: string
  detail?: string
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}
