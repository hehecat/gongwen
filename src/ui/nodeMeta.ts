import { NodeType } from '../types/ast'

export interface NodeTypeMeta {
  type: NodeType
  label: string
  shortLabel: string
  indentLevel: number
  clause: string
}

export const NODE_TYPE_META_LIST: NodeTypeMeta[] = [
  {
    type: NodeType.DOCUMENT_TITLE,
    label: '公文标题（2号小标宋居中）',
    shortLabel: '公文标题',
    indentLevel: 0,
    clause: '§7.3.1',
  },
  {
    type: NodeType.ADDRESSEE,
    label: '主送机关（顶格冒号）',
    shortLabel: '主送机关',
    indentLevel: 0,
    clause: '§7.3.2',
  },
  {
    type: NodeType.HEADING_1,
    label: '一级标题（一、黑体）',
    shortLabel: '一级标题',
    indentLevel: 0,
    clause: '§7.3.3',
  },
  {
    type: NodeType.HEADING_2,
    label: '二级标题（（一）楷体）',
    shortLabel: '二级标题',
    indentLevel: 1,
    clause: '§7.3.3',
  },
  {
    type: NodeType.HEADING_3,
    label: '三级标题（1. / 一是）',
    shortLabel: '三级标题',
    indentLevel: 2,
    clause: '§7.3.3',
  },
  {
    type: NodeType.HEADING_4,
    label: '四级标题（（1）仿宋）',
    shortLabel: '四级标题',
    indentLevel: 3,
    clause: '§7.3.3',
  },
  {
    type: NodeType.PARAGRAPH,
    label: '正文段落（3号仿宋缩进）',
    shortLabel: '正文段落',
    indentLevel: 1,
    clause: '§7.3.3',
  },
  {
    type: NodeType.ATTACHMENT,
    label: '附件说明（左空二字）',
    shortLabel: '附件说明',
    indentLevel: 0,
    clause: '§7.3.4',
  },
  {
    type: NodeType.SIGNATURE,
    label: '发文机关署名',
    shortLabel: '机关署名',
    indentLevel: 0,
    clause: '§7.3.5',
  },
  {
    type: NodeType.DATE,
    label: '成文日期',
    shortLabel: '成文日期',
    indentLevel: 0,
    clause: '§7.3.5.4',
  },
  {
    type: NodeType.POSTSCRIPT,
    label: '附注（圆括号说明）',
    shortLabel: '附注',
    indentLevel: 0,
    clause: '§7.3.6',
  },
  {
    type: NodeType.MINUTES_ATTENDANCE,
    label: '纪要出席/请假/列席',
    shortLabel: '纪要出席',
    indentLevel: 0,
    clause: '§10.3',
  },
  {
    type: NodeType.ATTACHMENT_PAGE_HEADER,
    label: '附件另面标识（分页顶格）',
    shortLabel: '附件另面',
    indentLevel: 0,
    clause: '§7.3.7',
  },
]

export const NODE_TYPE_META_MAP: Record<NodeType, NodeTypeMeta> = Object.fromEntries(
  NODE_TYPE_META_LIST.map((item) => [item.type, item]),
) as Record<NodeType, NodeTypeMeta>

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}

export function formatShortcut(key: string): string {
  return isMacPlatform() ? `⌘${key}` : `Ctrl+${key}`
}

export function formatTodayChineseDate(): string {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

export function formatShortTimestamp(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  const date = new Date(ms)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}
