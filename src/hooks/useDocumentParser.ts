import { useMemo } from 'react'
import { parseGongwen } from '../parser'
import type { GongwenAST } from '../types/ast'

/** 将文本实时解析为公文 AST */
export function useDocumentParser(text: string): GongwenAST {
  return useMemo(() => parseGongwen(text), [text])
}
