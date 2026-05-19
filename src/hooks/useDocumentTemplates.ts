import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_CONFIG, type DocumentConfig } from '../types/documentConfig'
import type {
  ActiveTemplateMetadata,
  DocumentTemplate,
  ImportedDocumentTemplateCollectionDraft,
  RecentTemplateItem,
  RecentTemplateUsageEntry,
} from '../types/documentTemplate'
import {
  buildCommonTemplateItems,
  buildDocumentTemplateCollectionExportPayload,
  findTemplateByName,
  findTemplateBySignature,
  formatTemplateLibraryFileName,
  getDocumentConfigSignature,
  mergeRecentTemplateUsageEntries,
  parseDocumentTemplateCollectionJson,
  sortTemplatesByPinnedState,
  splitImportedTemplateCollection,
  suggestUniqueTemplateName,
} from '../utils/documentTemplates'
import { normalizeDocumentConfig, type LegacyDocumentConfig } from '../utils/documentConfigHelpers'

const TEMPLATES_STORAGE_KEY = 'docx-document-templates'
const ACTIVE_TEMPLATE_STORAGE_KEY = 'docx-active-template'
const RECENT_TEMPLATE_USAGE_STORAGE_KEY = 'docx-recent-template-usage'
const PINNED_TEMPLATE_IDS_STORAGE_KEY = 'docx-pinned-template-ids'
const COMMON_TEMPLATE_LIMIT = 6

type Listener = () => void

interface DocumentTemplateStoreSnapshot {
  templates: DocumentTemplate[]
  activeTemplate: ActiveTemplateMetadata | null
  pinnedTemplateIds: string[]
  recentTemplateUsage: RecentTemplateUsageEntry[]
}

interface SaveTemplateInput {
  description: string
  name: string
  overwriteTemplateId?: string
}

interface TemplateMutationConflict {
  existingTemplate: DocumentTemplate
  suggestedName: string
}

interface TemplateMutationSuccess {
  action: 'created' | 'updated'
  template: DocumentTemplate
}

interface ImportTemplateCollectionResult {
  importedTemplates: DocumentTemplate[]
  skippedNames: string[]
}

type TemplateMutationResult =
  | { status: 'conflict'; conflict: TemplateMutationConflict }
  | { status: 'success'; result: TemplateMutationSuccess }

const listeners = new Set<Listener>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStoredTemplate(value: unknown): DocumentTemplate | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || !value.id.trim()) return null

  const name = typeof value.name === 'string' && value.name.trim()
    ? value.name.trim()
    : '未命名模板'
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  const createdAt = typeof value.createdAt === 'string' && value.createdAt.trim()
    ? value.createdAt
    : new Date(0).toISOString()
  const updatedAt = typeof value.updatedAt === 'string' && value.updatedAt.trim()
    ? value.updatedAt
    : createdAt

  if (!isRecord(value.config)) return null

  return {
    id: value.id,
    name,
    description,
    config: normalizeDocumentConfig(value.config as LegacyDocumentConfig),
    createdAt,
    updatedAt,
  }
}

function normalizeActiveTemplate(value: unknown): ActiveTemplateMetadata | null {
  if (!isRecord(value)) return null
  if (
    typeof value.templateId !== 'string'
    || typeof value.templateName !== 'string'
    || typeof value.appliedAt !== 'string'
    || typeof value.configSignature !== 'string'
  ) {
    return null
  }

  return {
    templateId: value.templateId,
    templateName: value.templateName,
    appliedAt: value.appliedAt,
    configSignature: value.configSignature,
  }
}

function normalizeRecentTemplateUsageEntry(value: unknown): RecentTemplateUsageEntry | null {
  if (!isRecord(value)) return null
  if (typeof value.templateId !== 'string' || typeof value.appliedAt !== 'string') {
    return null
  }

  return {
    templateId: value.templateId,
    appliedAt: value.appliedAt,
  }
}

function normalizePinnedTemplateId(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  return value
}

function getTimestampValue(value: string): number {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function sortTemplates(templates: DocumentTemplate[]): DocumentTemplate[] {
  return [...templates].sort((left, right) => {
    const leftTime = getTimestampValue(left.updatedAt)
    const rightTime = getTimestampValue(right.updatedAt)

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

function sortRecentTemplateUsage(entries: RecentTemplateUsageEntry[]): RecentTemplateUsageEntry[] {
  return [...entries].sort((left, right) => getTimestampValue(right.appliedAt) - getTimestampValue(left.appliedAt))
}

function normalizePinnedTemplateIds(pinnedTemplateIds: string[], templates: DocumentTemplate[]): string[] {
  const validTemplateIdSet = new Set(templates.map((template) => template.id))
  const result: string[] = []

  for (const templateId of pinnedTemplateIds) {
    if (!validTemplateIdSet.has(templateId) || result.includes(templateId)) {
      continue
    }

    result.push(templateId)
    if (result.length >= COMMON_TEMPLATE_LIMIT) {
      break
    }
  }

  return result
}

function readTemplatesFromStorage(): DocumentTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sortTemplates(parsed.map((item) => normalizeStoredTemplate(item)).filter(Boolean) as DocumentTemplate[])
  } catch {
    return []
  }
}

function readActiveTemplateFromStorage(): ActiveTemplateMetadata | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TEMPLATE_STORAGE_KEY)
    return raw ? normalizeActiveTemplate(JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function readRecentTemplateUsageFromStorage(): RecentTemplateUsageEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_TEMPLATE_USAGE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return sortRecentTemplateUsage(
      parsed.map((item) => normalizeRecentTemplateUsageEntry(item)).filter(Boolean) as RecentTemplateUsageEntry[],
    )
  } catch {
    return []
  }
}

function readPinnedTemplateIdsFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_TEMPLATE_IDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => normalizePinnedTemplateId(item))
      .filter((item): item is string => Boolean(item))
  } catch {
    return []
  }
}

function readStore(): DocumentTemplateStoreSnapshot {
  const templates = readTemplatesFromStorage()
  return {
    templates,
    activeTemplate: readActiveTemplateFromStorage(),
    pinnedTemplateIds: normalizePinnedTemplateIds(readPinnedTemplateIdsFromStorage(), templates),
    recentTemplateUsage: readRecentTemplateUsageFromStorage(),
  }
}

let cachedSnapshot = readStore()

function notify() {
  cachedSnapshot = readStore()
  listeners.forEach((listener) => listener())
}

function handleStorageEvent(event: StorageEvent) {
  if (
    event.key === TEMPLATES_STORAGE_KEY
    || event.key === ACTIVE_TEMPLATE_STORAGE_KEY
    || event.key === PINNED_TEMPLATE_IDS_STORAGE_KEY
    || event.key === RECENT_TEMPLATE_USAGE_STORAGE_KEY
    || event.key === null
  ) {
    notify()
  }
}

async function saveBlobAsFile(blob: Blob, fileName: string) {
  const { saveAs } = await import('file-saver')
  saveAs(blob, fileName)
}

function createTemplateStoreError() {
  return new Error('模板保存失败，请检查浏览器存储空间或隐私模式设置。')
}

function subscribe(listener: Listener) {
  listeners.add(listener)

  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent)
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent)
    }
  }
}

function getSnapshot(): DocumentTemplateStoreSnapshot {
  return cachedSnapshot
}

function getServerSnapshot(): DocumentTemplateStoreSnapshot {
  return { templates: [], activeTemplate: null, pinnedTemplateIds: [], recentTemplateUsage: [] }
}

function writeStore(snapshot: DocumentTemplateStoreSnapshot) {
  try {
    const normalizedPinnedTemplateIds = normalizePinnedTemplateIds(snapshot.pinnedTemplateIds, snapshot.templates)
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(snapshot.templates))
    if (snapshot.activeTemplate) {
      localStorage.setItem(ACTIVE_TEMPLATE_STORAGE_KEY, JSON.stringify(snapshot.activeTemplate))
    } else {
      localStorage.removeItem(ACTIVE_TEMPLATE_STORAGE_KEY)
    }

    if (normalizedPinnedTemplateIds.length > 0) {
      localStorage.setItem(PINNED_TEMPLATE_IDS_STORAGE_KEY, JSON.stringify(normalizedPinnedTemplateIds))
    } else {
      localStorage.removeItem(PINNED_TEMPLATE_IDS_STORAGE_KEY)
    }

    if (snapshot.recentTemplateUsage.length > 0) {
      localStorage.setItem(RECENT_TEMPLATE_USAGE_STORAGE_KEY, JSON.stringify(snapshot.recentTemplateUsage))
    } else {
      localStorage.removeItem(RECENT_TEMPLATE_USAGE_STORAGE_KEY)
    }
  } catch {
    throw createTemplateStoreError()
  }

  notify()
}

function createTemplateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTemplateName(name: string): string {
  const trimmed = name.trim()
  return trimmed || '未命名模板'
}

export function useDocumentTemplates(
  config: DocumentConfig,
  replaceConfig: (nextConfig: DocumentConfig) => void,
) {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const storedTemplates = store.templates
  const activeTemplateMeta = store.activeTemplate
  const pinnedTemplateIds = store.pinnedTemplateIds
  const recentTemplateUsage = store.recentTemplateUsage
  const currentConfigSignature = useMemo(() => getDocumentConfigSignature(config), [config])
  const defaultConfigSignature = useMemo(() => getDocumentConfigSignature(DEFAULT_CONFIG), [])

  const templates = useMemo(() => (
    sortTemplatesByPinnedState(storedTemplates, pinnedTemplateIds)
  ), [pinnedTemplateIds, storedTemplates])

  const currentMatchingTemplate = useMemo(() => (
    findTemplateBySignature(storedTemplates, currentConfigSignature)
  ), [currentConfigSignature, storedTemplates])

  const activeTemplate = useMemo(() => (
    activeTemplateMeta
      ? storedTemplates.find((template) => template.id === activeTemplateMeta.templateId) ?? null
      : null
  ), [activeTemplateMeta, storedTemplates])

  const commonTemplates = useMemo<RecentTemplateItem[]>(() => (
    buildCommonTemplateItems(storedTemplates, recentTemplateUsage, pinnedTemplateIds, COMMON_TEMPLATE_LIMIT)
  ), [pinnedTemplateIds, recentTemplateUsage, storedTemplates])

  const isActiveTemplateDirty = activeTemplateMeta
    ? activeTemplateMeta.configSignature !== currentConfigSignature
    : false
  const hasUnsavedCurrentConfig = (
    currentConfigSignature !== defaultConfigSignature
    && currentMatchingTemplate === null
  )

  const persistStore = useCallback((
    nextTemplates: DocumentTemplate[],
    nextActiveTemplate = activeTemplateMeta,
    nextRecentTemplateUsage = recentTemplateUsage,
    nextPinnedTemplateIds = pinnedTemplateIds,
  ) => {
    writeStore({
      templates: sortTemplates(nextTemplates),
      activeTemplate: nextActiveTemplate,
      pinnedTemplateIds: normalizePinnedTemplateIds(nextPinnedTemplateIds, nextTemplates),
      recentTemplateUsage: sortRecentTemplateUsage(nextRecentTemplateUsage),
    })
  }, [activeTemplateMeta, pinnedTemplateIds, recentTemplateUsage])

  const buildConflict = useCallback((name: string, excludeTemplateId?: string) => {
    const existingTemplate = findTemplateByName(storedTemplates, name, excludeTemplateId)
    if (!existingTemplate) return null

    return {
      existingTemplate,
      suggestedName: suggestUniqueTemplateName(
        name,
        storedTemplates
          .filter((template) => template.id !== excludeTemplateId)
          .map((template) => template.name),
      ),
    }
  }, [storedTemplates])

  const saveCurrentAsTemplate = useCallback((input: SaveTemplateInput): TemplateMutationResult => {
    const now = new Date().toISOString()
    const normalizedName = normalizeTemplateName(input.name)
    const description = input.description.trim()
    const conflict = buildConflict(normalizedName, input.overwriteTemplateId)

    if (conflict) {
      return { status: 'conflict', conflict }
    }

    if (input.overwriteTemplateId) {
      const existingTemplate = storedTemplates.find((template) => template.id === input.overwriteTemplateId)
      if (!existingTemplate) {
        throw new Error('模板不存在，无法更新。')
      }

      const updatedTemplate: DocumentTemplate = {
        ...existingTemplate,
        name: normalizedName,
        description,
        config: normalizeDocumentConfig(config as LegacyDocumentConfig),
        updatedAt: now,
      }
      const nextTemplates = storedTemplates.map((template) => (
        template.id === updatedTemplate.id ? updatedTemplate : template
      ))
      persistStore(nextTemplates, {
        templateId: updatedTemplate.id,
        templateName: updatedTemplate.name,
        appliedAt: now,
        configSignature: currentConfigSignature,
      })

      return {
        status: 'success',
        result: {
          action: 'updated',
          template: updatedTemplate,
        },
      }
    }

    const template: DocumentTemplate = {
      id: createTemplateId(),
      name: normalizedName,
      description,
      config: normalizeDocumentConfig(config as LegacyDocumentConfig),
      createdAt: now,
      updatedAt: now,
    }
    persistStore([...storedTemplates, template], {
      templateId: template.id,
      templateName: template.name,
      appliedAt: now,
      configSignature: currentConfigSignature,
    })

    return {
      status: 'success',
      result: {
        action: 'created',
        template,
      },
    }
  }, [buildConflict, config, currentConfigSignature, persistStore, storedTemplates])

  const updateTemplateMeta = useCallback((
    templateId: string,
    nextValues: Pick<DocumentTemplate, 'name' | 'description'>,
  ): TemplateMutationResult => {
    const existingTemplate = storedTemplates.find((template) => template.id === templateId)
    if (!existingTemplate) {
      throw new Error('模板不存在，无法编辑。')
    }

    const normalizedName = normalizeTemplateName(nextValues.name)
    const description = nextValues.description.trim()
    const conflict = buildConflict(normalizedName, templateId)

    if (conflict) {
      return { status: 'conflict', conflict }
    }

    const updatedAt = new Date().toISOString()
    const updatedTemplate: DocumentTemplate = {
      ...existingTemplate,
      name: normalizedName,
      description,
      updatedAt,
    }
    const nextTemplates = storedTemplates.map((template) => (
      template.id === updatedTemplate.id ? updatedTemplate : template
    ))
    const nextActiveTemplate = activeTemplateMeta?.templateId === templateId
      ? { ...activeTemplateMeta, templateName: updatedTemplate.name }
      : activeTemplateMeta

    persistStore(nextTemplates, nextActiveTemplate)

    return {
      status: 'success',
      result: {
        action: 'updated',
        template: updatedTemplate,
      },
    }
  }, [activeTemplateMeta, buildConflict, persistStore, storedTemplates])

  const copyTemplate = useCallback((templateId: string): DocumentTemplate => {
    const sourceTemplate = storedTemplates.find((template) => template.id === templateId)
    if (!sourceTemplate) {
      throw new Error('模板不存在，无法复制。')
    }

    const now = new Date().toISOString()
    const copiedTemplate: DocumentTemplate = {
      ...sourceTemplate,
      id: createTemplateId(),
      name: suggestUniqueTemplateName(
        `${sourceTemplate.name} 副本`,
        storedTemplates.map((template) => template.name),
      ),
      createdAt: now,
      updatedAt: now,
    }

    persistStore([...storedTemplates, copiedTemplate])
    return copiedTemplate
  }, [persistStore, storedTemplates])

  const deleteTemplate = useCallback((templateId: string) => {
    const nextTemplates = storedTemplates.filter((template) => template.id !== templateId)
    const nextActiveTemplate = activeTemplateMeta?.templateId === templateId
      ? null
      : activeTemplateMeta
    const nextPinnedTemplateIds = pinnedTemplateIds.filter((entry) => entry !== templateId)
    const nextRecentTemplateUsage = recentTemplateUsage.filter((entry) => entry.templateId !== templateId)
    persistStore(nextTemplates, nextActiveTemplate, nextRecentTemplateUsage, nextPinnedTemplateIds)
  }, [activeTemplateMeta, pinnedTemplateIds, persistStore, recentTemplateUsage, storedTemplates])

  const applyTemplate = useCallback((templateId: string) => {
    const template = storedTemplates.find((entry) => entry.id === templateId)
    if (!template) {
      throw new Error('模板不存在，无法套用。')
    }

    const appliedAt = new Date().toISOString()
    const signature = getDocumentConfigSignature(template.config)
    replaceConfig(template.config)
    persistStore(
      storedTemplates,
      {
        templateId: template.id,
        templateName: template.name,
        appliedAt,
        configSignature: signature,
      },
      mergeRecentTemplateUsageEntries(recentTemplateUsage, template.id, appliedAt),
    )
  }, [persistStore, recentTemplateUsage, replaceConfig, storedTemplates])

  const pinTemplate = useCallback((templateId: string) => {
    if (!storedTemplates.some((template) => template.id === templateId)) {
      throw new Error('模板不存在，无法置顶。')
    }

    if (pinnedTemplateIds.includes(templateId)) {
      persistStore(storedTemplates, activeTemplateMeta, recentTemplateUsage, [
        templateId,
        ...pinnedTemplateIds.filter((entry) => entry !== templateId),
      ])
      return
    }

    if (pinnedTemplateIds.length >= COMMON_TEMPLATE_LIMIT) {
      throw new Error(`最多只能置顶 ${COMMON_TEMPLATE_LIMIT} 个模板，请先取消一个。`)
    }

    persistStore(storedTemplates, activeTemplateMeta, recentTemplateUsage, [
      templateId,
      ...pinnedTemplateIds,
    ])
  }, [activeTemplateMeta, pinnedTemplateIds, persistStore, recentTemplateUsage, storedTemplates])

  const unpinTemplate = useCallback((templateId: string) => {
    persistStore(
      storedTemplates,
      activeTemplateMeta,
      recentTemplateUsage,
      pinnedTemplateIds.filter((entry) => entry !== templateId),
    )
  }, [activeTemplateMeta, pinnedTemplateIds, persistStore, recentTemplateUsage, storedTemplates])

  const exportAllTemplates = useCallback(async () => {
    if (storedTemplates.length === 0) {
      throw new Error('暂无模板可导出。')
    }

    const payload = buildDocumentTemplateCollectionExportPayload(storedTemplates)
    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json;charset=utf-8' },
    )
    await saveBlobAsFile(blob, formatTemplateLibraryFileName())
  }, [storedTemplates])

  const readTemplateCollectionFile = useCallback(async (file: File): Promise<ImportedDocumentTemplateCollectionDraft> => {
    return parseDocumentTemplateCollectionJson(await file.text())
  }, [])

  const importTemplateCollectionDraft = useCallback((
    collection: ImportedDocumentTemplateCollectionDraft,
  ): ImportTemplateCollectionResult => {
    const { acceptedDrafts, skippedNames } = splitImportedTemplateCollection(storedTemplates, collection.templates)

    if (acceptedDrafts.length === 0) {
      return {
        importedTemplates: [],
        skippedNames,
      }
    }

    const importedTemplates = acceptedDrafts.map((draft) => ({
      id: createTemplateId(),
      name: draft.name,
      description: draft.description,
      config: draft.config,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }))

    persistStore([...storedTemplates, ...importedTemplates])

    return {
      importedTemplates,
      skippedNames,
    }
  }, [persistStore, storedTemplates])

  return {
    activeTemplate,
    activeTemplateMeta,
    applyTemplate,
    commonTemplates,
    copyTemplate,
    currentConfigSignature,
    currentMatchingTemplate,
    deleteTemplate,
    exportAllTemplates,
    hasUnsavedCurrentConfig,
    importTemplateCollectionDraft,
    isActiveTemplateDirty,
    pinTemplate,
    pinnedTemplateIds,
    readTemplateCollectionFile,
    saveCurrentAsTemplate,
    templateCount: storedTemplates.length,
    templates,
    unpinTemplate,
    updateTemplateMeta,
  }
}
