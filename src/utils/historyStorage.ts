import type { HistoryRecord } from '../types/history'

const STORAGE_KEY = 'docx-editor-history'
const MAX_RECORDS = 50

/**
 * 从内容中提取标题（第一行非空行）
 * @param content - 文本内容
 * @returns 提取的标题，最多30字符
 */
function extractTitle(content: string): string {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) {
      return trimmed.length > 30 ? trimmed.slice(0, 30) + '...' : trimmed
    }
  }
  return '无标题'
}

/**
 * 从 localStorage 读取历史记录
 * @returns 历史记录数组，按时间倒序排列
 */
export function getHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const records = JSON.parse(raw) as HistoryRecord[]
    return Array.isArray(records) ? records : []
  } catch {
    return []
  }
}

/**
 * 保存内容到历史记录
 * @param content - 要保存的内容
 * @returns 保存成功返回 true
 */
export function saveToHistory(content: string): boolean {
  if (!content.trim()) return false

  const records = getHistory()
  const newRecord: HistoryRecord = {
    id: Date.now().toString(),
    title: extractTitle(content),
    content,
    savedAt: new Date().toISOString(),
  }

  records.unshift(newRecord)

  if (records.length > MAX_RECORDS) {
    records.length = MAX_RECORDS
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    return true
  } catch {
    return false
  }
}

/**
 * 删除指定的历史记录
 * @param id - 记录ID
 * @returns 删除后的历史记录数组
 */
export function deleteHistoryItem(id: string): HistoryRecord[] {
  const records = getHistory()
  const filtered = records.filter((r) => r.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch {
    // 静默忽略
  }
  return filtered
}

/**
 * 清空所有历史记录
 */
export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 静默忽略
  }
}

/**
 * 检查内容是否已存在于历史记录中
 * @param content - 要检查的内容
 * @returns 如果存在相同内容返回 true
 */
export function isContentExists(content: string): boolean {
  if (!content.trim()) return false
  const records = getHistory()
  return records.some((r) => r.content === content)
}
