/** 公文 AST 节点类型 */
export enum NodeType {
  /** 公文标题（居中、小标宋 22pt） */
  DOCUMENT_TITLE = 'DOCUMENT_TITLE',
  /** 一级标题：「一、」黑体 */
  HEADING_1 = 'HEADING_1',
  /** 二级标题：「（一）」楷体 */
  HEADING_2 = 'HEADING_2',
  /** 三级标题：「1.」或「一是/一要」，仿宋，是否加粗由设置决定 */
  HEADING_3 = 'HEADING_3',
  /** 四级标题：「（1）」仿宋 */
  HEADING_4 = 'HEADING_4',
  /** 正文段落 */
  PARAGRAPH = 'PARAGRAPH',
  /** 主送机关（顶格，以冒号结尾） */
  ADDRESSEE = 'ADDRESSEE',
  /** 附件说明（"附件："开头） */
  ATTACHMENT = 'ATTACHMENT',
  /** 发文机关署名（成文日期正上方或无印章空一行右空二字） */
  SIGNATURE = 'SIGNATURE',
  /** 成文日期（"XXXX年X月X日"） */
  DATE = 'DATE',
  /** 附注（§7.3.6 居左空二字加圆括号编排在成文日期下一行） */
  POSTSCRIPT = 'POSTSCRIPT',
  /** 纪要出席/请假/列席行（§10.3 3号黑体标签 + 冒号 + 3号仿宋回行对齐） */
  MINUTES_ATTENDANCE = 'MINUTES_ATTENDANCE',
  /** 附件另面标识（§7.3.7 另起一面左上角顶格 3 号黑体"附件"及序号） */
  ATTACHMENT_PAGE_HEADER = 'ATTACHMENT_PAGE_HEADER',
}

/** 单个文档节点 */
export interface DocumentNode {
  type: NodeType
  content: string
  /** 原始文本中的行号（从 1 开始） */
  lineNumber: number
  /** 是否被用户手动覆写过类型 */
  overridden?: boolean
}

/** 用户手动覆写的节点类型映射（key 为 1-based 行号） */
export type NodeTypeOverrides = Record<number, NodeType>

/** 附件项 */
export interface AttachmentItem {
  /** 附件序号（1, 2, 3...），单附件时为 0 */
  index: number
  /** 附件名称（不含序号和点号） */
  name: string
}

/** 附件说明节点 */
export interface AttachmentNode extends DocumentNode {
  type: NodeType.ATTACHMENT
  /** 是否为多附件模式 */
  isMultiple: boolean
  /** 附件列表（单附件时只有一项，index 为 0） */
  items: AttachmentItem[]
}

/** 完整公文 AST */
export interface GongwenAST {
  title: DocumentNode | null
  body: DocumentNode[]
}
