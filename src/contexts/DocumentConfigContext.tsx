import {
  useReducer,
  useEffect,
  type ReactNode,
} from 'react'
import { DEFAULT_CONFIG, type DocumentConfig, type DeepPartial } from '../types/documentConfig'
import { DocumentConfigContext } from './documentConfigContext'

const STORAGE_KEY = 'docx-document-config'

type LegacyDocumentConfig = DeepPartial<DocumentConfig> & {
  headings?: {
    h1?: {
      fontFamily?: string
      fontSize?: number
    }
    h2?: {
      fontFamily?: string
      fontSize?: number
    }
  }
}

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
      return normalizeLineSpacing(deepMerge(state, action.patch))
    case 'reset':
      return normalizeLineSpacing(DEFAULT_CONFIG)
  }
}

function migrateLegacyHeadingConfig(parsed: LegacyDocumentConfig): DeepPartial<DocumentConfig> {
  if (!parsed.headings) return parsed

  const { headings, advanced, ...rest } = parsed

  return {
    ...rest,
    advanced: {
      ...advanced,
      h1: {
        ...advanced?.h1,
        fontFamily: advanced?.h1?.fontFamily ?? headings.h1?.fontFamily,
        fontSize: advanced?.h1?.fontSize ?? headings.h1?.fontSize,
      },
      h2: {
        ...advanced?.h2,
        fontFamily: advanced?.h2?.fontFamily ?? headings.h2?.fontFamily,
        fontSize: advanced?.h2?.fontSize ?? headings.h2?.fontSize,
      },
    },
  }
}

function normalizeLineSpacing(config: DocumentConfig): DocumentConfig {
  const titleLineSpacing = Math.max(config.title.lineSpacing, config.title.fontSize)
  const bodyLineSpacing = Math.max(
    config.body.lineSpacing,
    config.body.fontSize,
    config.advanced.h1.fontSize,
    config.advanced.h2.fontSize,
    config.advanced.h3.fontSize,
  )

  if (
    titleLineSpacing === config.title.lineSpacing
    && bodyLineSpacing === config.body.lineSpacing
  ) {
    return config
  }

  return {
    ...config,
    title: {
      ...config.title,
      lineSpacing: titleLineSpacing,
    },
    body: {
      ...config.body,
      lineSpacing: bodyLineSpacing,
    },
  }
}

/** 从 localStorage 读取配置，深合并到默认值（兼容旧版缺字段） */
function loadConfig(): DocumentConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = migrateLegacyHeadingConfig(JSON.parse(raw) as LegacyDocumentConfig)
      return normalizeLineSpacing(deepMerge(DEFAULT_CONFIG, parsed))
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
