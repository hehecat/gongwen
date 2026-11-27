import { useMemo, useState } from 'react'
import {
  NodeType,
  type DocumentNode,
  type GongwenAST,
  type NodeTypeOverrides,
} from '../types/ast'
import { RotateResetIcon } from './icons'
import { NODE_TYPE_META_LIST, NODE_TYPE_META_MAP } from './nodeMeta'

interface OutlinePanelProps {
  ast: GongwenAST
  overrides: NodeTypeOverrides
  onJumpLine: (lineNumber: number) => void
  onSetOverride: (lineNumber: number, nextType: NodeType | null) => void
  onClearOverrides: () => void
}

export function OutlinePanel({
  ast,
  overrides,
  onJumpLine,
  onSetOverride,
  onClearOverrides,
}: OutlinePanelProps) {
  const [headingsOnly, setHeadingsOnly] = useState(false)

  const allNodes = useMemo<DocumentNode[]>(() => {
    const items: DocumentNode[] = []
    if (ast.title) items.push(ast.title)
    items.push(...ast.body)
    return items
  }, [ast.body, ast.title])

  const visibleNodes = useMemo(() => {
    if (!headingsOnly) return allNodes
    return allNodes.filter(
      (n) =>
        n.type === NodeType.DOCUMENT_TITLE
        || n.type === NodeType.HEADING_1
        || n.type === NodeType.HEADING_2
        || n.type === NodeType.HEADING_3
        || n.type === NodeType.HEADING_4
        || n.type === NodeType.ATTACHMENT_PAGE_HEADER,
    )
  }, [allNodes, headingsOnly])

  const overrideCount = Object.keys(overrides).length

  if (allNodes.length === 0) {
    return (
      <div className="cb-panel-empty">
        <div className="cb-panel-empty-title">暂无公文结构</div>
        <div className="cb-panel-empty-desc">
          在左侧输入或导入公文后，此处将自动解析标题、主送机关、四级标题、正文与附件落款，并支持逐行手动修正识别类型。
        </div>
      </div>
    )
  }

  return (
    <div className="cb-panel-scroll">
      <div className="cb-outline-toolbar">
        <div className="cb-outline-stats cb-tabular">
          <span>共 {allNodes.length} 个语义节点</span>
          <label className="cb-mini-check">
            <input
              type="checkbox"
              checked={headingsOnly}
              onChange={(e) => setHeadingsOnly(e.target.checked)}
            />
            <span>仅看标题骨架</span>
          </label>
        </div>

        {overrideCount > 0 && (
          <div className="cb-override-banner cb-tabular">
            <span>已手动指定 {overrideCount} 行类型</span>
            <button
              type="button"
              className="cb-link-btn"
              onClick={onClearOverrides}
            >
              全部恢复自动
            </button>
          </div>
        )}
      </div>

      <div className="cb-outline-list">
        {visibleNodes.map((node, index) => {
          const meta = NODE_TYPE_META_MAP[node.type]
          const isOverridden = Boolean(node.overridden || overrides[node.lineNumber])
          const previewText = node.content.replace(/\s+/g, ' ').trim()

          return (
            <div
              key={`${node.lineNumber}-${index}`}
              className={`cb-outline-row${isOverridden ? ' is-overridden' : ''}`}
              style={
                {
                  '--indent-step': meta?.indentLevel ?? 0,
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className="cb-outline-jump"
                title={`定位到第 ${node.lineNumber} 行`}
                onClick={() => onJumpLine(node.lineNumber)}
              >
                <span className="cb-outline-line cb-tabular">L{node.lineNumber}</span>
                <span className="cb-outline-text">{previewText || '（空行）'}</span>
              </button>

              <div className="cb-outline-actions">
                <select
                  className={`cb-outline-type-select${isOverridden ? ' is-overridden' : ''}`}
                  aria-label={`第 ${node.lineNumber} 行节点类型`}
                  value={node.type}
                  onChange={(e) =>
                    onSetOverride(node.lineNumber, e.target.value as NodeType)
                  }
                >
                  {NODE_TYPE_META_LIST.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.shortLabel}
                    </option>
                  ))}
                </select>

                {isOverridden && (
                  <button
                    type="button"
                    className="cb-outline-reset-btn"
                    title="恢复该行自动识别"
                    aria-label="恢复该行自动识别"
                    onClick={() => onSetOverride(node.lineNumber, null)}
                  >
                    <RotateResetIcon size={12.5} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
