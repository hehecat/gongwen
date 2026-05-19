import { formatFontSizeLabel, type DocumentConfig } from '../types/documentConfig'
import type {
  DocumentTemplate,
  DocumentTemplateCollectionExportPayload,
  DocumentTemplateExportPayload,
  DocumentTemplatePayloadItem,
  ImportedDocumentTemplateCollectionDraft,
  ImportedDocumentTemplateDraft,
  RecentTemplateItem,
  RecentTemplateUsageEntry,
  TemplateSummary,
} from '../types/documentTemplate'
import { normalizeDocumentConfig, type LegacyDocumentConfig } from './documentConfigHelpers'

export const DOCUMENT_TEMPLATE_SOURCE = 'gongwen-document-template'
export const DOCUMENT_TEMPLATE_COLLECTION_SOURCE = 'gongwen-document-templates'
export const DOCUMENT_TEMPLATE_SCHEMA_VERSION = 1

const DEFAULT_TEMPLATE_NAME = '未命名模板'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeTemplateName(name: string): string {
  const trimmed = name.trim()
  return trimmed || DEFAULT_TEMPLATE_NAME
}

function getTimestampValue(value: string): number {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function sortTemplatesByTimestamp(templates: DocumentTemplate[]): DocumentTemplate[] {
  return [...templates].sort((left, right) => {
    const leftTime = getTimestampValue(left.updatedAt)
    const rightTime = getTimestampValue(right.updatedAt)

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

function parseTemplatePayloadItem(
  value: unknown,
  now = new Date().toISOString(),
): ImportedDocumentTemplateDraft {
  if (!isRecord(value) || !isRecord(value.config)) {
    throw new Error('模板文件缺少有效的格式配置。')
  }

  const normalizedConfig = normalizeDocumentConfig(value.config as LegacyDocumentConfig)
  const createdAt = typeof value.createdAt === 'string' && value.createdAt.trim()
    ? value.createdAt
    : now
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt.trim()
    ? value.updatedAt
    : createdAt

  return {
    name: typeof value.name === 'string' ? normalizeTemplateName(value.name) : DEFAULT_TEMPLATE_NAME,
    description: typeof value.description === 'string' ? value.description.trim() : '',
    config: normalizedConfig,
    createdAt,
    updatedAt,
  }
}

function validateSchemaVersion(value: Record<string, unknown>) {
  const schemaVersion = typeof value.schemaVersion === 'number'
    ? value.schemaVersion
    : DOCUMENT_TEMPLATE_SCHEMA_VERSION

  if (schemaVersion > DOCUMENT_TEMPLATE_SCHEMA_VERSION) {
    throw new Error(`模板版本过高，当前仅支持 v${DOCUMENT_TEMPLATE_SCHEMA_VERSION}。`)
  }
}

function validateSource(value: Record<string, unknown>) {
  if (!('source' in value) || value.source === undefined) {
    return
  }

  if (
    value.source !== DOCUMENT_TEMPLATE_SOURCE
    && value.source !== DOCUMENT_TEMPLATE_COLLECTION_SOURCE
  ) {
    throw new Error('不是本工具导出的模板文件。')
  }
}

function toPayloadItem(
  template: Pick<DocumentTemplate, 'name' | 'description' | 'config' | 'createdAt' | 'updatedAt'>,
): DocumentTemplatePayloadItem {
  return {
    name: template.name,
    description: template.description || undefined,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    config: template.config,
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    return `{${entries.join(',')}}`
  }

  return JSON.stringify(value)
}

export function getDocumentConfigSignature(config: DocumentConfig): string {
  return stableStringify(config)
}

export function findTemplateByName(
  templates: DocumentTemplate[],
  name: string,
  excludeTemplateId?: string,
): DocumentTemplate | null {
  const normalizedName = normalizeTemplateName(name)
  return templates.find((template) => (
    template.id !== excludeTemplateId && template.name === normalizedName
  )) ?? null
}

export function findTemplateBySignature(
  templates: DocumentTemplate[],
  configSignature: string,
): DocumentTemplate | null {
  return templates.find((template) => (
    getDocumentConfigSignature(template.config) === configSignature
  )) ?? null
}

export function suggestUniqueTemplateName(baseName: string, existingNames: string[]): string {
  const normalizedBase = normalizeTemplateName(baseName)
  if (!existingNames.includes(normalizedBase)) {
    return normalizedBase
  }

  let index = 2
  let candidate = `${normalizedBase}（${index}）`
  while (existingNames.includes(candidate)) {
    index += 1
    candidate = `${normalizedBase}（${index}）`
  }
  return candidate
}

export function sanitizeTemplateFileName(name: string): string {
  return normalizeTemplateName(name)
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code >= 0 && code <= 31) return '-'
      return /[<>:"/\\|?*]/.test(char) ? '-' : char
    })
    .join('')
    .replace(/\s+/g, ' ')
}

export function formatTemplateLibraryFileName(date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${sanitizeTemplateFileName(`公文模板库-${yyyy}-${mm}-${dd}`)}.json`
}

export function buildTemplateSummary(config: DocumentConfig): TemplateSummary {
  const titleStyle = {
    fontFamily: config.title.fontFamily,
    fontSizeLabel: formatFontSizeLabel(config.title.fontSize),
    lineSpacingLabel: `${config.title.lineSpacing} 磅`,
  }
  const bodyStyle = {
    fontFamily: config.body.fontFamily,
    auxiliaryFontFamily: config.body.asciiFontFamily || undefined,
    fontSizeLabel: formatFontSizeLabel(config.body.fontSize),
    lineSpacingLabel: `${config.body.lineSpacing} 磅`,
    firstLineIndentLabel: `首行缩进 ${config.body.firstLineIndent} 字符`,
  }
  const headingStyles = [
    {
      levelLabel: '一级',
      fontFamily: config.advanced.h1.fontFamily,
      fontSizeLabel: formatFontSizeLabel(config.advanced.h1.fontSize),
    },
    {
      levelLabel: '二级',
      fontFamily: config.advanced.h2.fontFamily,
      fontSizeLabel: formatFontSizeLabel(config.advanced.h2.fontSize),
    },
    {
      levelLabel: '三级',
      fontFamily: config.advanced.h3.fontFamily,
      fontSizeLabel: formatFontSizeLabel(config.advanced.h3.fontSize),
    },
  ]
  const featureTags = [
    `页码: ${config.specialOptions.showPageNumber
      ? `开启 (${config.specialOptions.pageNumberStyle === 'mirrored' ? '国标' : '居中'})`
      : '关闭'}`,
    `版头: ${config.header.enabled ? '开启' : '关闭'}`,
    `版记: ${config.footerNote.enabled ? '开启' : '关闭'}`,
    `印章: ${config.specialOptions.hasStamp ? '开启' : '关闭'}`,
  ]

  return {
    titleStyle,
    bodyStyle,
    headingStyles,
    featureTags,
  }
}

export function buildDocumentTemplateExportPayload(
  template: Pick<DocumentTemplate, 'name' | 'description' | 'config' | 'createdAt' | 'updatedAt'>,
): DocumentTemplateExportPayload {
  return {
    source: DOCUMENT_TEMPLATE_SOURCE,
    schemaVersion: DOCUMENT_TEMPLATE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    template: toPayloadItem(template),
  }
}

export function buildDocumentTemplateCollectionExportPayload(
  templates: Array<Pick<DocumentTemplate, 'name' | 'description' | 'config' | 'createdAt' | 'updatedAt'>>,
): DocumentTemplateCollectionExportPayload {
  return {
    source: DOCUMENT_TEMPLATE_COLLECTION_SOURCE,
    schemaVersion: DOCUMENT_TEMPLATE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    templates: templates.map((template) => toPayloadItem(template)),
  }
}

export function parseDocumentTemplateJson(
  raw: string,
  now = new Date().toISOString(),
): ImportedDocumentTemplateDraft {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('模板文件不是有效的 JSON。')
  }

  if (!isRecord(parsed)) {
    throw new Error('模板文件内容格式不正确。')
  }

  validateSchemaVersion(parsed)
  validateSource(parsed)

  const templateNode = isRecord(parsed.template) ? parsed.template : parsed
  return parseTemplatePayloadItem(templateNode, now)
}

export function parseDocumentTemplateCollectionJson(
  raw: string,
  now = new Date().toISOString(),
): ImportedDocumentTemplateCollectionDraft {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('模板文件不是有效的 JSON。')
  }

  if (!isRecord(parsed)) {
    throw new Error('模板文件内容格式不正确。')
  }

  validateSchemaVersion(parsed)
  validateSource(parsed)

  if (Array.isArray(parsed.templates)) {
    return {
      templates: parsed.templates.map((item) => parseTemplatePayloadItem(item, now)),
    }
  }

  return {
    templates: [parseTemplatePayloadItem(isRecord(parsed.template) ? parsed.template : parsed, now)],
  }
}

export function mergeRecentTemplateUsageEntries(
  entries: RecentTemplateUsageEntry[],
  templateId: string,
  appliedAt: string,
): RecentTemplateUsageEntry[] {
  return [
    { templateId, appliedAt },
    ...entries.filter((entry) => entry.templateId !== templateId),
  ].sort((left, right) => getTimestampValue(right.appliedAt) - getTimestampValue(left.appliedAt))
}

export function sortTemplatesByPinnedState(
  templates: DocumentTemplate[],
  pinnedTemplateIds: string[],
): DocumentTemplate[] {
  const baseTemplates = sortTemplatesByTimestamp(templates)
  if (pinnedTemplateIds.length === 0) {
    return baseTemplates
  }

  const templateMap = new Map(baseTemplates.map((template) => [template.id, template]))
  const pinnedTemplates = pinnedTemplateIds
    .map((templateId) => templateMap.get(templateId))
    .filter((template): template is DocumentTemplate => Boolean(template))
  const pinnedTemplateIdSet = new Set(pinnedTemplates.map((template) => template.id))

  return [
    ...pinnedTemplates,
    ...baseTemplates.filter((template) => !pinnedTemplateIdSet.has(template.id)),
  ]
}

export function buildRecentTemplateItems(
  templates: DocumentTemplate[],
  entries: RecentTemplateUsageEntry[],
  limit = 5,
): RecentTemplateItem[] {
  const templateMap = new Map(templates.map((template) => [template.id, template]))
  const seenTemplateIds = new Set<string>()
  const sortedEntries = [...entries].sort(
    (left, right) => getTimestampValue(right.appliedAt) - getTimestampValue(left.appliedAt),
  )

  const result: RecentTemplateItem[] = []
  for (const entry of sortedEntries) {
    if (seenTemplateIds.has(entry.templateId)) continue
    seenTemplateIds.add(entry.templateId)

    const template = templateMap.get(entry.templateId)
    if (!template) continue

    result.push({ template, appliedAt: entry.appliedAt })
    if (result.length >= limit) break
  }

  return result
}

export function buildCommonTemplateItems(
  templates: DocumentTemplate[],
  entries: RecentTemplateUsageEntry[],
  pinnedTemplateIds: string[],
  limit = 6,
): RecentTemplateItem[] {
  const orderedTemplates = sortTemplatesByPinnedState(templates, pinnedTemplateIds)
  const recentItems = buildRecentTemplateItems(templates, entries, limit)
  const recentById = new Map(recentItems.map((item) => [item.template.id, item.appliedAt]))

  if (orderedTemplates.length <= limit) {
    return orderedTemplates.map((template) => ({
      template,
      appliedAt: recentById.get(template.id) ?? template.updatedAt,
    }))
  }

  const result: RecentTemplateItem[] = []
  const seenTemplateIds = new Set<string>()

  for (const template of orderedTemplates) {
    if (!pinnedTemplateIds.includes(template.id)) continue
    result.push({
      template,
      appliedAt: recentById.get(template.id) ?? template.updatedAt,
    })
    seenTemplateIds.add(template.id)
    if (result.length >= limit) {
      return result
    }
  }

  for (const item of recentItems) {
    if (seenTemplateIds.has(item.template.id)) continue
    result.push(item)
    seenTemplateIds.add(item.template.id)
    if (result.length >= limit) {
      return result
    }
  }

  for (const template of orderedTemplates) {
    if (seenTemplateIds.has(template.id)) continue
    result.push({
      template,
      appliedAt: recentById.get(template.id) ?? template.updatedAt,
    })
    seenTemplateIds.add(template.id)
    if (result.length >= limit) {
      return result
    }
  }

  return result
}

export function splitImportedTemplateCollection(
  existingTemplates: DocumentTemplate[],
  importedDrafts: ImportedDocumentTemplateDraft[],
): {
  acceptedDrafts: ImportedDocumentTemplateDraft[]
  skippedNames: string[]
} {
  const existingNames = new Set(existingTemplates.map((template) => normalizeTemplateName(template.name)))
  const incomingNames = new Set<string>()
  const acceptedDrafts: ImportedDocumentTemplateDraft[] = []
  const skippedNames: string[] = []

  for (const draft of importedDrafts) {
    const normalizedName = normalizeTemplateName(draft.name)
    if (existingNames.has(normalizedName) || incomingNames.has(normalizedName)) {
      skippedNames.push(normalizedName)
      continue
    }

    incomingNames.add(normalizedName)
    acceptedDrafts.push({
      ...draft,
      name: normalizedName,
      description: draft.description.trim(),
    })
  }

  return {
    acceptedDrafts,
    skippedNames,
  }
}
