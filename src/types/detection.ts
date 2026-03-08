import { NodeType } from './ast'

/** 检测点状态 */
export enum DetectionStatus {
  /** 已检测到 */
  DETECTED = 'DETECTED',
  /** 缺失 */
  MISSING = 'MISSING',
  /** 警告（如日期异常） */
  WARNING = 'WARNING',
}

/** 检测点类型 */
export enum DetectionPointType {
  /** 公文标题 */
  TITLE = 'TITLE',
  /** 主送机关 */
  ADDRESSEE = 'ADDRESSEE',
  /** 正文内容 */
  BODY = 'BODY',
  /** 发文机关署名 */
  SIGNATURE = 'SIGNATURE',
  /** 成文日期 */
  DATE = 'DATE',
  /** 附件说明（预留扩展） */
  ATTACHMENT = 'ATTACHMENT',
}

/** 日期警告类型 */
export enum DateWarningType {
  /** 日期偏离当前日期 */
  DATE_DEVIATION = 'DATE_DEVIATION',
}

/** 日期警告信息 */
export interface DateWarning {
  type: DateWarningType
  message: string
  severity: 'warning' | 'error'
  daysDiff: number
}

/** 标题层级问题 */
export interface HeadingLevelIssue {
  /** 问题标题内容 */
  content: string
  /** 问题标题级别 (2, 3, 4) */
  level: number
  /** 缺少的父标题级别 */
  missingParentLevel: number
}

/** 标题层级警告信息 */
export interface HeadingLevelWarning {
  /** 所有问题标题列表 */
  issues: HeadingLevelIssue[]
}

/** 标题序号问题 */
export interface HeadingNumberIssue {
  /** 问题标题内容 */
  content: string
  /** 标题级别 (1, 2, 3, 4) */
  level: number
  /** 期望的序号 */
  expected: number
  /** 实际的序号（如果无法解析则为 null） */
  actual: number | null
  /** 问题描述 */
  description: string
}

/** 标题序号警告信息 */
export interface HeadingNumberWarning {
  /** 所有问题标题列表 */
  issues: HeadingNumberIssue[]
}

/** 附件项信息（预留扩展） */
export interface AttachmentInfo {
  index: number
  name: string
}

/** 正文统计信息 */
export interface BodyStats {
  /** 字符总数 */
  charCount: number
  /** 段落数量 */
  paragraphCount: number
  /** 各级标题数量 */
  headingCounts: {
    h1: number
    h2: number
    h3: number
    h4: number
  }
}

/** 检测点元数据 */
export interface DetectionPointMeta {
  /** 正文统计信息（仅 BODY 类型使用） */
  bodyStats?: BodyStats
  /** 日期警告信息（仅 DATE 类型使用） */
  dateWarning?: DateWarning
  /** 附件列表（仅 ATTACHMENT 类型使用，预留） */
  attachments?: AttachmentInfo[]
  /** 标题层级警告信息（仅 BODY 类型使用） */
  headingLevelWarning?: HeadingLevelWarning
  /** 标题序号警告信息（仅 BODY 类型使用） */
  headingNumberWarning?: HeadingNumberWarning
}

/** 检测点数据 */
export interface DetectionPoint {
  /** 检测点类型 */
  type: DetectionPointType
  /** 检测状态 */
  status: DetectionStatus
  /** 显示标签 */
  label: string
  /** 检测到的内容（缺失时为 null） */
  content: string | null
  /** 扩展元数据 */
  meta: DetectionPointMeta
}

/** 检测结果 */
export interface DetectionResult {
  /** 所有检测点 */
  points: DetectionPoint[]
  /** 正文统计信息 */
  bodyStats: BodyStats
}

/** 节点类型到检测点类型的映射 */
export var NODE_TO_DETECTION_MAP: Record<NodeType, DetectionPointType | null> = {
  [NodeType.DOCUMENT_TITLE]: DetectionPointType.TITLE,
  [NodeType.ADDRESSEE]: DetectionPointType.ADDRESSEE,
  [NodeType.HEADING_1]: null,
  [NodeType.HEADING_2]: null,
  [NodeType.HEADING_3]: null,
  [NodeType.HEADING_4]: null,
  [NodeType.PARAGRAPH]: null,
  [NodeType.ATTACHMENT]: DetectionPointType.ATTACHMENT,
  [NodeType.SIGNATURE]: DetectionPointType.SIGNATURE,
  [NodeType.DATE]: DetectionPointType.DATE,
  [NodeType.TABLE]: null,
}
