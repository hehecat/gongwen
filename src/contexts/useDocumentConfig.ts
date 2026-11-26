import { useContext } from 'react'
import {
  DocumentConfigContext,
  type DocumentConfigContextValue,
} from './documentConfigStore'

export function useDocumentConfig(): DocumentConfigContextValue {
  const ctx = useContext(DocumentConfigContext)
  if (!ctx) {
    throw new Error('useDocumentConfig must be used within DocumentConfigProvider')
  }
  return ctx
}
