import {
  useReducer,
  useEffect,
  type ReactNode,
} from 'react'
import { DEFAULT_CONFIG, type DocumentConfig, type DeepPartial } from '../types/documentConfig'
import {
  deepMerge,
  normalizeDocumentConfig,
  normalizeLineSpacing,
  type LegacyDocumentConfig,
} from '../utils/documentConfigHelpers'
import { DocumentConfigContext } from './documentConfigContext'

const STORAGE_KEY = 'docx-document-config'

// ---- Reducer ----

type Action =
  | { type: 'update'; patch: DeepPartial<DocumentConfig> }
  | { type: 'replace'; config: DocumentConfig }
  | { type: 'reset' }

function configReducer(state: DocumentConfig, action: Action): DocumentConfig {
  switch (action.type) {
    case 'update':
      return normalizeLineSpacing(deepMerge(state, action.patch))
    case 'replace':
      return normalizeDocumentConfig(action.config)
    case 'reset':
      return normalizeLineSpacing(DEFAULT_CONFIG)
  }
}

/** 从 localStorage 读取配置，深合并到默认值（兼容旧版缺字段） */
function loadConfig(): DocumentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return normalizeDocumentConfig(JSON.parse(raw) as LegacyDocumentConfig)
    }
  } catch {
    // 解析失败则使用默认值
  }
  return normalizeLineSpacing(DEFAULT_CONFIG)
}

// ---- Provider ----

export function DocumentConfigProvider({ children }: { children: ReactNode }) {
  const [config, dispatch] = useReducer(configReducer, null, loadConfig)

  const updateConfig = (patch: DeepPartial<DocumentConfig>) => {
    dispatch({ type: 'update', patch })
  }

  const replaceConfig = (nextConfig: DocumentConfig) => {
    dispatch({ type: 'replace', config: nextConfig })
  }

  const resetConfig = () => {
    dispatch({ type: 'reset' })
  }

  // 持久化到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }, [config])

  return (
    <DocumentConfigContext.Provider value={{ config, updateConfig, replaceConfig, resetConfig }}>
      {children}
    </DocumentConfigContext.Provider>
  )
}
