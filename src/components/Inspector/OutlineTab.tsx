import { useMemo } from 'react'
import { NodeType, type DocumentNode, type GongwenAST, type NodeTypeOverrides } from '../../types/ast'

interface OutlineTabProps {
  ast: GongwenAST
  overrides: NodeTypeOverrides
  onChangeOverride: (lineNumber: number, nodeType: NodeType | null) => void
  onClearOverrides: () => void
  onLocateLine: (lineNumber: number) => void
}

const NODE_TYPE_META: Record<NodeType, { label: string; toneClass: string }> = {
  [NodeType.DOCUMENT_TITLE]: { label: '标题', toneClass: 'insp-outline-role--title' },
  [NodeType.ADDRESSEE]: { label: '主送', toneClass: '' },
  [NodeType.HEADING_1]: { label: '一级', toneClass: 'insp-outline-role--h1' },
  [NodeType.HEADING_2]: { label: '二级', toneClass: '' },
  [NodeType.HEADING_3]: { label: '三级', toneClass: '' },
  [NodeType.HEADING_4]: { label: '四级', toneClass: '' },
  [NodeType.PARAGRAPH]: { label: '正文', toneClass: '' },
  [NodeType.ATTACHMENT]: { label: '附件', toneClass: '' },
  [NodeType.ATTACHMENT_PAGE_HEADER]: { label: '另面', toneClass: '' },
  [NodeType.SIGNATURE]: { label: '署名', toneClass: '' },
  [NodeType.DATE]: { label: '日期', toneClass: '' },
  [NodeType.POSTSCRIPT]: { label: '附注', toneClass: '' },
  [NodeType.MINUTES_ATTENDANCE]: { label: '出席', toneClass: '' },
}

const OVERRIDE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: NodeType.DOCUMENT_TITLE, label: '公文标题' },
  { value: NodeType.ADDRESSEE, label: '主送机关' },
  { value: NodeType.HEADING_1, label: '一级标题' },
  { value: NodeType.HEADING_2, label: '二级标题' },
  { value: NodeType.HEADING_3, label: '三级标题' },
  { value: NodeType.HEADING_4, label: '四级标题' },
  { value: NodeType.PARAGRAPH, label: '正文段落' },
  { value: NodeType.ATTACHMENT, label: '附件说明' },
  { value: NodeType.ATTACHMENT_PAGE_HEADER, label: '附件另面标识' },
  { value: NodeType.SIGNATURE, label: '发文署名' },
  { value: NodeType.DATE, label: '成文日期' },
  { value: NodeType.POSTSCRIPT, label: '附注' },
  { value: NodeType.MINUTES_ATTENDANCE, label: '纪要出席/列席' },
]

export function OutlineTab({
  ast,
  overrides,
  onChangeOverride,
  onClearOverrides,
  onLocateLine,
}: OutlineTabProps) {
  const allNodes = useMemo<DocumentNode[]>(() => {
    const list: DocumentNode[] = []
    if (ast.title) list.push(ast.title)
    list.push(...ast.body)
    return list
  }, [ast.body, ast.title])

  const overrideCount = Object.keys(overrides).length

  return (
    <div className="insp-stack">
      <div className="insp-pane-summary">
        <span className="insp-section-label">
          文档大纲 · {allNodes.length} 段
        </span>
        {overrideCount > 0 && (
          <button
            type="button"
            className="insp-link-btn"
            onClick={onClearOverrides}
          >
            恢复自动识别 ({overrideCount})
          </button>
        )}
      </div>

      {allNodes.length === 0 ? (
        <div className="insp-empty-flat">
          <p className="insp-empty-title">暂无识别段落</p>
          <p className="insp-empty-desc">在左侧输入或导入公文内容后，此处将实时显示段落结构并支持手动改标。</p>
        </div>
      ) : (
        <div className="insp-outline-list">
          {allNodes.map((node, idx) => {
            const meta = NODE_TYPE_META[node.type]
            const manualOverride = overrides[node.lineNumber]
            const indentClass =
              node.type === NodeType.HEADING_2
                ? 'insp-outline-row--indent1'
                : node.type === NodeType.HEADING_3 || node.type === NodeType.HEADING_4
                  ? 'insp-outline-row--indent2'
                  : ''
            return (
              <div
                key={`${node.lineNumber}-${idx}`}
                className={`insp-outline-row ${indentClass} ${manualOverride ? 'insp-outline-row--manual' : ''}`}
              >
                <div className="insp-outline-top">
                  <button
                    type="button"
                    className="insp-outline-line"
                    onClick={() => onLocateLine(node.lineNumber)}
                    title={`跳转到第 ${node.lineNumber} 行`}
                  >
                    L{node.lineNumber}
                  </button>
                  <span className={`insp-outline-role ${meta.toneClass}`}>
                    {meta.label}
                    {manualOverride ? '*' : ''}
                  </span>
                  <select
                    className="insp-override-select"
                    aria-label={`第 ${node.lineNumber} 行段落类型`}
                    value={manualOverride ?? '__AUTO__'}
                    onChange={(e) => {
                      const val = e.target.value
                      onChangeOverride(
                        node.lineNumber,
                        val === '__AUTO__' ? null : (val as NodeType),
                      )
                    }}
                  >
                    <option value="__AUTO__">自动</option>
                    {OVERRIDE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="insp-outline-snippet"
                  onClick={() => onLocateLine(node.lineNumber)}
                  title={node.content}
                >
                  {node.content.replace(/\n/g, ' / ')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
