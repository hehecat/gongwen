import type { CheckIssue } from '../checker'
import {
  AlertIcon,
  JumpLineIcon,
  ShieldCheckIcon,
  WandFixIcon,
} from './icons'

interface CompliancePanelProps {
  issues: CheckIssue[]
  hasContent: boolean
  onJumpLine: (lineNumber: number) => void
  onApplyIssueFix: (issue: CheckIssue) => void
  onApplyAllFixes: () => void
}

const SEVERITY_LABEL: Record<CheckIssue['severity'], string> = {
  error: '不合规范',
  warning: '建议修正',
  info: '标点提示',
}

export function CompliancePanel({
  issues,
  hasContent,
  onJumpLine,
  onApplyIssueFix,
  onApplyAllFixes,
}: CompliancePanelProps) {
  const fixableIssues = issues.filter((i) => Boolean(i.fix))
  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.filter((i) => i.severity === 'warning').length
  const infoCount = issues.filter((i) => i.severity === 'info').length

  if (!hasContent) {
    return (
      <div className="cb-panel-empty">
        <div className="cb-panel-empty-icon is-neutral">
          <ShieldCheckIcon size={22} />
        </div>
        <div className="cb-panel-empty-title">等待公文内容</div>
        <div className="cb-panel-empty-desc">
          输入或导入文稿后，将对照 GB/T 9704—2012 实时检测标题末标点、各级序号连续性、发文字号六角括号、成文日期、孤行落款等 8 类常见规范项。
        </div>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="cb-panel-empty">
        <div className="cb-panel-empty-icon is-ok">
          <ShieldCheckIcon size={24} />
        </div>
        <div className="cb-panel-empty-title">全部通过 GB/T 9704—2012 校对</div>
        <div className="cb-panel-empty-desc">
          当前文稿在标题标点、层次序号、发文字号、成文日期、标点配对及落款分页上均符合国家标准要求，可放心导出或打印。
        </div>
      </div>
    )
  }

  return (
    <div className="cb-panel-scroll">
      {/* Audit Summary Bar */}
      <div className="cb-check-summary">
        <div className="cb-check-summary-left">
          <div className="cb-check-summary-text cb-tabular">
            <AlertIcon size={15} className="cb-check-summary-icon" />
            <span>检出 {issues.length} 项格式关注点</span>
          </div>
          <div className="cb-check-counts cb-tabular">
            <span>错误 {errorCount}</span>
            <span>·</span>
            <span>建议 {warningCount}</span>
            <span>·</span>
            <span>提示 {infoCount}</span>
          </div>
        </div>
        {fixableIssues.length > 0 && (
          <button
            type="button"
            className="cb-btn-inline-primary cb-tabular"
            onClick={onApplyAllFixes}
          >
            <WandFixIcon size={13} />
            <span>一键修复全部（{fixableIssues.length}）</span>
          </button>
        )}
      </div>

      {/* Issue Cards */}
      <div className="cb-issue-list">
        {issues.map((issue) => (
          <article
            key={issue.id}
            className={`cb-issue-card cb-issue-card--${issue.severity}`}
          >
            <div className="cb-issue-meta">
              <span className={`cb-issue-badge cb-issue-badge--${issue.severity}`}>
                {SEVERITY_LABEL[issue.severity]}
              </span>
              <span className="cb-issue-clause cb-tabular">{issue.clause}</span>
              {issue.lineNumber && (
                <button
                  type="button"
                  className="cb-issue-line-btn cb-tabular"
                  onClick={() => onJumpLine(issue.lineNumber!)}
                >
                  <span>第 {issue.lineNumber} 行</span>
                  <JumpLineIcon size={11.5} />
                </button>
              )}
            </div>

            <h4 className="cb-issue-title">{issue.title}</h4>
            <p className="cb-issue-detail">{issue.detail}</p>

            {issue.fix && (
              <div className="cb-issue-actions">
                <button
                  type="button"
                  className="cb-issue-fix-btn"
                  onClick={() => onApplyIssueFix(issue)}
                >
                  <WandFixIcon size={13} />
                  <span>{issue.fix.label}</span>
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
