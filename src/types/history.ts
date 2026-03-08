/** 历史记录项 */
export interface HistoryRecord {
  /** 唯一标识（时间戳） */
  id: string
  /** 标题（从内容第一行提取） */
  title: string
  /** 完整内容 */
  content: string
  /** 保存时间 ISO 格式 */
  savedAt: string
}
