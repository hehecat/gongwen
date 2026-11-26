import type { DocumentConfig } from '../types/documentConfig'
import { normalizeDocumentConfig, type LegacyDocumentConfig } from './documentConfigHelpers'

export interface BuiltinTemplate {
  id: string
  name: string
  description: string
  badge: string
  config: DocumentConfig
}

function makePreset(
  id: string,
  name: string,
  description: string,
  badge: string,
  patch: LegacyDocumentConfig,
): BuiltinTemplate {
  return {
    id,
    name,
    description,
    badge,
    config: normalizeDocumentConfig(patch),
  }
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  makePreset(
    'builtin-standard-redhead',
    'GB/T 9704 党政机关通用',
    '标准红头公文（3.7/3.5/2.8/2.6 cm 页边距，每页 22 行×28 字，含版头版记与国标页码）',
    '国标推荐',
    {
      header: {
        enabled: true,
        format: 'standard',
        orgName: 'XX市人民政府办公厅文件',
        docNumber: 'X政办发〔2026〕1号',
        separatorStyle: 'solid',
      },
      footerNote: {
        enabled: true,
        cc: '各区县人民政府，市政府各部门',
        printer: 'XX市人民政府办公厅',
        printDate: '2026年11月26日',
      },
      specialOptions: {
        hasStamp: true,
        showPageNumber: true,
        pageNumberStyle: 'mirrored',
      },
    },
  ),
  makePreset(
    'builtin-upward-signer',
    '上行文（请示/报告）',
    '发文字号居左空一字，签发人居右空一字，带红星分隔线（GB/T 9704 §7.2.6）',
    '上行文',
    {
      header: {
        enabled: true,
        format: 'standard',
        orgName: 'XX省教育厅',
        docNumber: 'X教呈〔2026〕12号',
        signer: '张明',
        separatorStyle: 'star',
      },
      footerNote: {
        enabled: true,
        printer: 'XX省教育厅办公室',
        printDate: '2026年11月26日',
      },
      specialOptions: {
        hasStamp: true,
        showPageNumber: true,
        pageNumberStyle: 'mirrored',
      },
    },
  ),
  makePreset(
    'builtin-letter',
    '机关信函格式',
    '上下 170mm 红色双线，右上发文字号，首页不显示页码，版记不加印发与分隔线（§10.1）',
    '信函 §10.1',
    {
      header: {
        enabled: true,
        format: 'letter',
        orgName: 'XX市发展和改革委员会',
        docNumber: 'X发改函〔2026〕8号',
      },
      footerNote: {
        enabled: true,
        cc: '市政府办公厅',
      },
      specialOptions: {
        hasStamp: true,
        showPageNumber: true,
        pageNumberStyle: 'mirrored',
      },
    },
  ),
  makePreset(
    'builtin-minutes',
    '会议纪要格式',
    '“XXXXX 纪要”红色大字标志，支持“出席/请假/列席”3 号黑体+仿宋回行对齐（§10.3）',
    '纪要 §10.3',
    {
      header: {
        enabled: true,
        format: 'minutes',
        orgName: 'XX市人民政府常务会议纪要',
        docNumber: '〔2026〕第5期',
        separatorStyle: 'solid',
      },
      footerNote: {
        enabled: true,
        cc: '市委办公室，市人大常委会办公室',
        printer: '市政府办公厅',
        printDate: '2026年11月26日',
      },
      specialOptions: {
        hasStamp: false,
        showPageNumber: true,
        pageNumberStyle: 'mirrored',
      },
    },
  ),
  makePreset(
    'builtin-plain-notice',
    '普通通知（无红头）',
    '仅正文与附件落款排版，关闭版头与版记，适合内部通知与一般汇报材料',
    '简洁正文',
    {
      header: { enabled: false },
      footerNote: { enabled: false },
      specialOptions: {
        hasStamp: false,
        showPageNumber: true,
        pageNumberStyle: 'mirrored',
      },
    },
  ),
]
