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
  /** 成文日期（"XXXX年X月X日"） */
  DATE = 'DATE',
}

/** 单个文档节点 */
export interface DocumentNode {
  type: NodeType
  content: string
  /** 原始文本中的行号（从 1 开始） */
  lineNumber: number
}

/** 完整公文 AST */
export interface GongwenAST {
  title: DocumentNode | null
  body: DocumentNode[]
}
