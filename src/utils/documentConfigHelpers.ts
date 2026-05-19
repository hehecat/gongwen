import { DEFAULT_CONFIG, type DeepPartial, type DocumentConfig } from '../types/documentConfig'

export type LegacyDocumentConfig = DeepPartial<DocumentConfig> & {
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

/** 将 patch 深合并到 target，返回新对象 */
export function deepMerge<T extends object>(target: T, patch: DeepPartial<T>): T {
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

export function migrateLegacyHeadingConfig(parsed: LegacyDocumentConfig): DeepPartial<DocumentConfig> {
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

export function normalizeLineSpacing(config: DocumentConfig): DocumentConfig {
  const titleLineSpacing = Math.max(config.title.lineSpacing, config.title.fontSize)
  const bodyLineSpacing = Math.max(
    config.body.lineSpacing,
    config.body.fontSize,
    config.advanced.h1.fontSize,
    config.advanced.h2.fontSize,
    config.advanced.h3.fontSize,
  )

  if (
    titleLineSpacing === config.title.lineSpacing &&
    bodyLineSpacing === config.body.lineSpacing
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

export function normalizeDocumentConfig(parsed: LegacyDocumentConfig): DocumentConfig {
  return normalizeLineSpacing(deepMerge(DEFAULT_CONFIG, migrateLegacyHeadingConfig(parsed)))
}
