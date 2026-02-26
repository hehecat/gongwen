import { useSyncExternalStore, useCallback } from 'react'

const STORAGE_KEY = 'custom-fonts'

// ---- 外部存储 (供 useSyncExternalStore 使用) ----

type Listener = () => void
const listeners = new Set<Listener>()

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  cachedSnapshot = readFromStorage()
  listeners.forEach((l) => l())
}

/** 从 localStorage 读取，返回新数组 */
function readFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

/** 缓存的快照引用——确保 getSnapshot 返回稳定引用 */
let cachedSnapshot: string[] = readFromStorage()

const EMPTY: string[] = []

function getSnapshot(): string[] {
  return cachedSnapshot
}

function getServerSnapshot(): string[] {
  return EMPTY
}

function setFonts(fonts: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fonts))
  notify()
}

// ---- Hook ----

export function useCustomFonts() {
  const customFonts = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addFont = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const current = getSnapshot()
    if (current.includes(trimmed)) return
    setFonts([...current, trimmed])
  }, [])

  const removeFont = useCallback((name: string) => {
    setFonts(getSnapshot().filter((f) => f !== name))
  }, [])

  return { customFonts, addFont, removeFont }
}
