import type { CheckIssue } from '../../checker'
import type { GongwenAST, NodeType, NodeTypeOverrides } from '../../types/ast'
import { FormatTab, type DocumentTemplateStore } from './FormatTab'
import { TypographyTab, type TypoSectionId } from './TypographyTab'
import { OutlineTab } from './OutlineTab'
import { CheckTab } from './CheckTab'
import './Inspector.css'

export type InspectorTabId = 'format' | 'typography' | 'outline' | 'check'

interface InspectorProps {
  open: boolean
  activeTab: InspectorTabId
  onTabChange: (tab: InspectorTabId) => void
  onClose: () => void
  templateStore: DocumentTemplateStore
  onApplyBuiltinTemplate: (templateId: string) => void
  onOpenTemplatesModal: (initialCreate?: boolean) => void
  typoOpenSection: TypoSectionId | null
  onToggleTypoSection: (id: TypoSectionId) => void
  ast: GongwenAST
  overrides: NodeTypeOverrides
  onChangeOverride: (lineNumber: number, nodeType: NodeType | null) => void
  onClearOverrides: () => void
  issues: CheckIssue[]
  onLocateLine: (lineNumber: number) => void
  onApplyCheckFix: (issue: CheckIssue) => void
  onApplyAllCheckFixes: () => void
}

export function Inspector({
  open,
  activeTab,
  onTabChange,
  onClose,
  templateStore,
  onApplyBuiltinTemplate,
  onOpenTemplatesModal,
  typoOpenSection,
  onToggleTypoSection,
  ast,
  overrides,
  onChangeOverride,
  onClearOverrides,
  issues,
  onLocateLine,
  onApplyCheckFix,
  onApplyAllCheckFixes,
}: InspectorProps) {
  if (!open) return null

  const overrideCount = Object.keys(overrides).length

  const tabs: { id: InspectorTabId; label: string; badge?: number; badgeTone?: 'warn' | 'info' }[] = [
    { id: 'format', label: '版式' },
    { id: 'typography', label: '排版' },
    { id: 'outline', label: '结构', badge: overrideCount > 0 ? overrideCount : undefined, badgeTone: 'info' },
    { id: 'check', label: '校对', badge: issues.length > 0 ? issues.length : undefined, badgeTone: 'warn' },
  ]

  return (
    <>
      <div className="inspector-mobile-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="inspector" aria-label="公文版式与校对面板">
        <div className="inspector-header">
          <nav className="inspector-tabs" role="tablist" aria-label="检查器分组">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`inspector-tab ${activeTab === tab.id ? 'inspector-tab--active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`inspector-tab-badge inspector-tab-badge--${tab.badgeTone}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="inspector-close"
            onClick={onClose}
            aria-label="收起面板"
            title="收起面板 (Cmd/Ctrl+\)"
          >
            ✕
          </button>
        </div>

        <div className="inspector-body">
          {activeTab === 'format' && (
            <FormatTab
              templateStore={templateStore}
              onApplyBuiltinTemplate={onApplyBuiltinTemplate}
              onOpenTemplatesModal={onOpenTemplatesModal}
            />
          )}

          {activeTab === 'typography' && (
            <TypographyTab
              openSection={typoOpenSection}
              onToggleSection={onToggleTypoSection}
            />
          )}

          {activeTab === 'outline' && (
            <OutlineTab
              ast={ast}
              overrides={overrides}
              onChangeOverride={onChangeOverride}
              onClearOverrides={onClearOverrides}
              onLocateLine={onLocateLine}
            />
          )}

          {activeTab === 'check' && (
            <CheckTab
              issues={issues}
              onLocateLine={onLocateLine}
              onApplyFix={onApplyCheckFix}
              onApplyAllFixes={onApplyAllCheckFixes}
            />
          )}
        </div>
      </aside>
    </>
  )
}
