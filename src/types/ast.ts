/** 公文 AST 节点类型 */
export enum NodeType {
  /** 公文标题（居中、小标宋 22pt） */
  DOCUMENT_TITLE = 'DOCUMENT_TITLE',
  /** 一级标题：「一、」黑体 */
  HEADING_1 = 'HEADING_1',
  /** 二级标题：「（一）」楷体 */
  HEADING_2 = 'HEADING_2',
  /** 三级标题：「1.」仿宋加粗 */
  HEADING_3 = 'HEADING_3',
  /** 四级标题：「（1）」仿宋 */
  HEADING_4 = 'HEADING_4',
  /** 正文段落 */
  PARAGRAPH = 'PARAGRAPH',
  /** 主送机关（顶格，以冒号结尾） */
  ADDRESSEE = 'ADDRESSEE',
  /** 附件说明（"附件："开头） */
  ATTACHMENT = 'ATTACHMENT',
  /** 发文机关署名（成文日期正上方，以成文日期为基准居中） */
  SIGNATURE = 'SIGNATURE',
  /** 成文日期（"XXXX年X月X日"） */
  DATE = 'DATE',
  /** Markdown 表格 */
  TABLE = 'TABLE',
}

/** 单个文档节点 */
export interface DocumentNode {
  type: NodeType
  content: string
  /** 原始文本中的行号（从 1 开始） */
  lineNumber: number
}

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

/** 表格单元格 */
export interface TableCell {
  content: string
}

/** 表格行 */
export interface TableRowData {
  cells: TableCell[]
}

/** 表格节点 */
export interface TableNode extends DocumentNode {
  type: NodeType.TABLE
  /** 表头行 */
  header: TableRowData
  /** 数据行 */
  rows: TableRowData[]
  /** 列数 */
  columnCount: number
}

/** 完整公文 AST */
export interface GongwenAST {
  /** 公文标题数组（支持多段标题，每段一行） */
  title: DocumentNode[]
  body: DocumentNode[]
}
