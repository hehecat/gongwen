import { createContext } from 'react'
import type { DeepPartial, DocumentConfig } from '../types/documentConfig'

export interface DocumentConfigContextValue {
  config: DocumentConfig
  updateConfig: (patch: DeepPartial<DocumentConfig>) => void
  resetConfig: () => void
}

export const DocumentConfigContext = createContext<DocumentConfigContextValue | null>(null)
