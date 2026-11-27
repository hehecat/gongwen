import type { CheckIssue } from '../checker'
import type { GongwenAST, NodeType, NodeTypeOverrides } from '../types/ast'
import type { DeepPartial, DocumentConfig } from '../types/documentConfig'
import type { RecentTemplateItem } from '../types/documentTemplate'
import type { BuiltinTemplate } from '../utils/builtinTemplates'
import { CompliancePanel } from './CompliancePanel'
import { SegmentedControl } from './FormControls'
import { LayoutPanel } from './LayoutPanel'
import { OutlinePanel } from './OutlinePanel'
import { TypographyPanel } from './TypographyPanel'

export type StudioTab = 'layout' | 'typography' | 'outline' | 'check'

interface InspectorStudioProps {
  open: boolean
  activeTab: StudioTab
  onChangeTab: (tab: StudioTab) => void

  config: DocumentConfig
  updateConfig: (patch: DeepPartial<DocumentConfig>) => void
  onResetConfig: () => void

  builtinTemplates: BuiltinTemplate[]
  activeBuiltinId: string | null
  onApplyBuiltin: (preset: BuiltinTemplate) => void
  activePresetLabel: string
  isPresetModified: boolean
  commonTemplates: RecentTemplateItem[]
  activeCustomTemplateId: string | null
  onApplyCustomTemplate: (templateId: string) => void
  onOpenTemplateModal: (mode?: 'list' | 'create') => void

  customFonts: string[]
  onAddCustomFont: (name: string) => void
  onRemoveCustomFont: (name: string) => void

  sanitizeCount: number
  onCommitSanitizedToRaw: () => void

  ast: GongwenAST
  overrides: NodeTypeOverrides
  onJumpLine: (lineNumber: number) => void
  onSetOverride: (lineNumber: number, nextType: NodeType | null) => void
  onClearOverrides: () => void

  issues: CheckIssue[]
  hasContent: boolean
  onApplyIssueFix: (issue: CheckIssue) => void
  onApplyAllFixes: () => void

  onNotifyError: (msg: string) => void
  onNotifySuccess: (msg: string) => void
}

export function InspectorStudio({
  open,
  activeTab,
  onChangeTab,
  config,
  updateConfig,
  onResetConfig,
  builtinTemplates,
  activeBuiltinId,
  onApplyBuiltin,
  activePresetLabel,
  isPresetModified,
  commonTemplates,
  activeCustomTemplateId,
  onApplyCustomTemplate,
  onOpenTemplateModal,
  customFonts,
  onAddCustomFont,
  onRemoveCustomFont,
  sanitizeCount,
  onCommitSanitizedToRaw,
  ast,
  overrides,
  onJumpLine,
  onSetOverride,
  onClearOverrides,
  issues,
  hasContent,
  onApplyIssueFix,
  onApplyAllFixes,
  onNotifyError,
  onNotifySuccess,
}: InspectorStudioProps) {
  const overrideCount = Object.keys(overrides).length
  const errorCount = issues.filter((i) => i.severity === 'error').length

  const checkBadgeClass =
    errorCount > 0 ? 'is-err' : issues.length > 0 ? 'is-warn' : 'is-ok'

  return (
    <aside
      className={`cb-studio-drawer cb-no-print${open ? ' is-open' : ' is-closed'}`}
      aria-label="版式、字型、大纲与国标校对"
    >
      <div className="cb-studio-inner">
        <div className="cb-studio-tabs">
          <SegmentedControl<StudioTab>
            ariaLabel="排版工作台分栏"
            size="sm"
            fullWidth
            value={activeTab}
            onChange={onChangeTab}
            options={[
              { value: 'layout', label: '版式' },
              { value: 'typography', label: '字型' },
              {
                value: 'outline',
                label: (
                  <span className="cb-tab-label cb-tabular">
                    <span>大纲</span>
                    {overrideCount > 0 && (
                      <span className="cb-tab-count">{overrideCount}</span>
                    )}
                  </span>
                ),
              },
              {
                value: 'check',
                label: (
                  <span className="cb-tab-label cb-tabular">
                    <span>校对</span>
                    {hasContent && (
                      <span className={`cb-tab-count ${checkBadgeClass}`}>
                        {issues.length}
                      </span>
                    )}
                  </span>
                ),
              },
            ]}
          />
        </div>

        <div className="cb-studio-content">
          {activeTab === 'layout' && (
            <LayoutPanel
              config={config}
              updateConfig={updateConfig}
              builtinTemplates={builtinTemplates}
              activeBuiltinId={activeBuiltinId}
              onApplyBuiltin={onApplyBuiltin}
              activePresetLabel={activePresetLabel}
              isPresetModified={isPresetModified}
              commonTemplates={commonTemplates}
              activeCustomTemplateId={activeCustomTemplateId}
              onApplyCustomTemplate={onApplyCustomTemplate}
              onOpenTemplateModal={onOpenTemplateModal}
              customFonts={customFonts}
              onNotifyError={onNotifyError}
              onNotifySuccess={onNotifySuccess}
            />
          )}

          {activeTab === 'typography' && (
            <TypographyPanel
              config={config}
              updateConfig={updateConfig}
              onResetConfig={onResetConfig}
              customFonts={customFonts}
              onAddCustomFont={onAddCustomFont}
              onRemoveCustomFont={onRemoveCustomFont}
              sanitizeCount={sanitizeCount}
              onCommitSanitizedToRaw={onCommitSanitizedToRaw}
              onNotifySuccess={onNotifySuccess}
            />
          )}

          {activeTab === 'outline' && (
            <OutlinePanel
              ast={ast}
              overrides={overrides}
              onJumpLine={onJumpLine}
              onSetOverride={onSetOverride}
              onClearOverrides={onClearOverrides}
            />
          )}

          {activeTab === 'check' && (
            <CompliancePanel
              issues={issues}
              hasContent={hasContent}
              onJumpLine={onJumpLine}
              onApplyIssueFix={onApplyIssueFix}
              onApplyAllFixes={onApplyAllFixes}
            />
          )}
        </div>
      </div>
    </aside>
  )
}
