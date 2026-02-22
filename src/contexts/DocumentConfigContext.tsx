import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from 'react'
import { DEFAULT_CONFIG, type DocumentConfig, type DeepPartial } from '../types/documentConfig'

const STORAGE_KEY = 'docx-document-config'

// ---- 深合并工具 ----

/** 将 patch 深合并到 target，返回新对象 */
function deepMerge<T extends object>(target: T, patch: DeepPartial<T>): T {
  const result = { ...target }
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const patchVal = patch[key]
    const targetVal = target[key]
    if (
      patchVal !== null &&
      patchVal !== undefined &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        patchVal as DeepPartial<Record<string, unknown>>,
      ) as T[keyof T]
    } else if (patchVal !== undefined) {
      result[key] = patchVal as T[keyof T]
    }
  }
  return result
}

// ---- Reducer ----

type Action =
  | { type: 'update'; patch: DeepPartial<DocumentConfig> }
  | { type: 'reset' }

function configReducer(state: DocumentConfig, action: Action): DocumentConfig {
  switch (action.type) {
    case 'update':
      return deepMerge(state, action.patch)
    case 'reset':
      return DEFAULT_CONFIG
  }
}

/** 从 localStorage 读取配置，深合并到默认值（兼容旧版缺字段） */
function loadConfig(): DocumentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DeepPartial<DocumentConfig>
      return deepMerge(DEFAULT_CONFIG, parsed)
    }
  } catch {
    // 解析失败则使用默认值
  }
  return DEFAULT_CONFIG
}

// ---- Context ----

interface DocumentConfigContextValue {
  config: DocumentConfig
  updateConfig: (patch: DeepPartial<DocumentConfig>) => void
  resetConfig: () => void
}

const DocumentConfigContext = createContext<DocumentConfigContextValue | null>(null)

// ---- Provider ----

export function DocumentConfigProvider({ children }: { children: ReactNode }) {
  const [config, dispatch] = useReducer(configReducer, null, loadConfig)

  const updateConfig = (patch: DeepPartial<DocumentConfig>) => {
    dispatch({ type: 'update', patch })
  }

  const resetConfig = () => {
    dispatch({ type: 'reset' })
  }

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }, [config])

  return (
    <DocumentConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
      {children}
    </DocumentConfigContext.Provider>
  )
}

// ---- Hook ----

export function useDocumentConfig(): DocumentConfigContextValue {
  const ctx = useContext(DocumentConfigContext)
  if (!ctx) {
    throw new Error('useDocumentConfig must be used within DocumentConfigProvider')
  }
  return ctx
}
