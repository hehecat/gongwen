import { useCallback, useEffect, useState } from 'react'
import type { NodeType, NodeTypeOverrides } from '../types/ast'

export interface DocumentDraft {
  id: string
  title: string
  text: string
  overrides: NodeTypeOverrides
  updatedAt: string
}

const LEGACY_TEXT_STORAGE_KEY = 'docx-editor-text'
const DRAFTS_STORAGE_KEY = 'docx-document-drafts-v2'
const ACTIVE_DRAFT_STORAGE_KEY = 'docx-active-draft-id-v2'

function deriveDraftTitle(text: string, fallback = '未命名公文'): string {
  const firstNonEmpty = text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)
  if (!firstNonEmpty) return fallback
  return firstNonEmpty.length > 22 ? `${firstNonEmpty.slice(0, 22)}…` : firstNonEmpty
}

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function normalizeOverrides(raw: unknown): NodeTypeOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: NodeTypeOverrides = {}
  for (const [k, v] of Object.entries(raw)) {
    const lineNum = Number(k)
    if (Number.isInteger(lineNum) && lineNum > 0 && typeof v === 'string') {
      result[lineNum] = v as NodeType
    }
  }
  return result
}

function loadInitialState(): { drafts: DocumentDraft[]; activeId: string } {
  try {
    const rawDrafts = localStorage.getItem(DRAFTS_STORAGE_KEY)
    const rawActiveId = localStorage.getItem(ACTIVE_DRAFT_STORAGE_KEY)
    if (rawDrafts) {
      const parsed = JSON.parse(rawDrafts)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const drafts: DocumentDraft[] = parsed
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .map((item) => ({
            id: item.id as string,
            title: typeof item.title === 'string' && item.title.trim() ? item.title : deriveDraftTitle(String(item.text ?? '')),
            text: typeof item.text === 'string' ? item.text : '',
            overrides: normalizeOverrides(item.overrides),
            updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
          }))
        if (drafts.length > 0) {
          const matchedActive = drafts.find((d) => d.id === rawActiveId)?.id ?? drafts[0].id
          return { drafts, activeId: matchedActive }
        }
      }
    }
  } catch {
    // 忽略损坏数据，回退迁移逻辑
  }

  let legacyText = ''
  try {
    legacyText = localStorage.getItem(LEGACY_TEXT_STORAGE_KEY) ?? ''
  } catch {
    legacyText = ''
  }

  const initialDraft: DocumentDraft = {
    id: createDraftId(),
    title: deriveDraftTitle(legacyText, '公文草稿 1'),
    text: legacyText,
    overrides: {},
    updatedAt: new Date().toISOString(),
  }

  return { drafts: [initialDraft], activeId: initialDraft.id }
}

export function useDocumentDrafts() {
  const [initial] = useState(loadInitialState)
  const [drafts, setDrafts] = useState<DocumentDraft[]>(initial.drafts)
  const [activeDraftId, setActiveDraftId] = useState<string>(initial.activeId)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')

  const activeDraft = drafts.find((d) => d.id === activeDraftId) ?? drafts[0]

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts))
        localStorage.setItem(ACTIVE_DRAFT_STORAGE_KEY, activeDraft.id)
        localStorage.setItem(LEGACY_TEXT_STORAGE_KEY, activeDraft.text)
      } catch {
        // 隐私模式或配额不足时静默忽略
      }
      setSaveState('saved')
    }, 350)
    return () => window.clearTimeout(timer)
  }, [activeDraft.id, activeDraft.text, drafts])

  const updateActiveText = useCallback((nextText: string) => {
    setSaveState('saving')
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === activeDraft.id
          ? {
              ...d,
              text: nextText,
              title: deriveDraftTitle(nextText, d.title),
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [activeDraft.id])

  const setActiveOverride = useCallback((lineNumber: number, nodeType: NodeType | null) => {
    setSaveState('saving')
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== activeDraft.id) return d
        const nextOverrides = { ...d.overrides }
        if (nodeType === null) {
          delete nextOverrides[lineNumber]
        } else {
          nextOverrides[lineNumber] = nodeType
        }
        return { ...d, overrides: nextOverrides, updatedAt: new Date().toISOString() }
      }),
    )
  }, [activeDraft.id])

  const clearActiveOverrides = useCallback(() => {
    setSaveState('saving')
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === activeDraft.id
          ? { ...d, overrides: {}, updatedAt: new Date().toISOString() }
          : d,
      ),
    )
  }, [activeDraft.id])

  const restoreActiveSnapshot = useCallback((text: string, overrides: NodeTypeOverrides) => {
    setSaveState('saving')
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === activeDraft.id
          ? {
              ...d,
              text,
              overrides,
              title: deriveDraftTitle(text, '公文草稿'),
              updatedAt: new Date().toISOString(),
            }
          : d,
      ),
    )
  }, [activeDraft.id])

  const createDraft = useCallback((initialText = '') => {
    setSaveState('saving')
    const newDraft: DocumentDraft = {
      id: createDraftId(),
      title: deriveDraftTitle(initialText, `公文草稿 ${drafts.length + 1}`),
      text: initialText,
      overrides: {},
      updatedAt: new Date().toISOString(),
    }
    setDrafts((prev) => [...prev, newDraft])
    setActiveDraftId(newDraft.id)
    return newDraft
  }, [drafts.length])

  const selectDraft = useCallback((draftId: string) => {
    setSaveState('saving')
    setActiveDraftId(draftId)
  }, [])

  const deleteDraft = useCallback((draftId: string) => {
    setSaveState('saving')
    setDrafts((prev) => {
      if (prev.length <= 1) {
        return [{
          ...prev[0],
          title: '公文草稿 1',
          text: '',
          overrides: {},
          updatedAt: new Date().toISOString(),
        }]
      }
      const next = prev.filter((d) => d.id !== draftId)
      if (activeDraftId === draftId && next.length > 0) {
        setActiveDraftId(next[0].id)
      }
      return next
    })
  }, [activeDraftId])

  return {
    drafts,
    activeDraft,
    saveState,
    updateActiveText,
    setActiveOverride,
    clearActiveOverrides,
    restoreActiveSnapshot,
    createDraft,
    selectDraft,
    deleteDraft,
  }
}
