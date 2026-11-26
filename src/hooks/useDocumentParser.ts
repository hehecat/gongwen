import { useMemo } from 'react'
import { parseGongwen, type ParseGongwenOptions } from '../parser'
import type { GongwenAST } from '../types/ast'

/** 将文本实时解析为公文 AST */
export function useDocumentParser(
  text: string,
  options?: ParseGongwenOptions,
): GongwenAST {
  const overrides = options?.overrides
  const parserConfig = options?.parserConfig
  return useMemo(
    () => parseGongwen(text, { overrides, parserConfig }),
    [text, overrides, parserConfig],
  )
}
