import type { CheckIssue } from '../../checker'

interface CheckTabProps {
  issues: CheckIssue[]
  onLocateLine: (lineNumber: number) => void
  onApplyFix: (issue: CheckIssue) => void
  onApplyAllFixes: () => void
}

const SEVERITY_LABEL: Record<CheckIssue['severity'], string> = {
  error: '严重',
  warning: '建议',
  info: '提醒',
}

export function CheckTab({
  issues,
  onLocateLine,
  onApplyFix,
  onApplyAllFixes,
}: CheckTabProps) {
  const fixableCount = issues.filter((item) => item.fix).length

  return (
    <div className="insp-stack">
      <div className="insp-pane-summary">
        <span className="insp-check-status">
          <span
            className={`insp-status-dot ${issues.length === 0 ? 'insp-status-dot--ok' : 'insp-status-dot--warn'}`}
            aria-hidden="true"
          />
          <span>{issues.length === 0 ? '通过国标体检' : `发现 ${issues.length} 项建议`}</span>
        </span>
        {fixableCount > 0 && (
          <button
            type="button"
            className="insp-link-btn"
            onClick={onApplyAllFixes}
          >
            一键修复 ({fixableCount})
          </button>
        )}
      </div>

      {issues.length === 0 ? (
        <div className="insp-empty-flat">
          <p className="insp-empty-title insp-empty-title--ok">版式与结构符合规范要求</p>
          <p className="insp-empty-desc">
            已纯离线对照 GB/T 9704—2012 检查：标题标点、一至三级标题序号连续性、附件标点、成文日期、发文字号六角括号、成对引号括号及末页孤行落款。
          </p>
        </div>
      ) : (
        <div className="insp-issue-list">
          {issues.map((issue) => (
            <article key={issue.id} className="insp-issue-row">
              <div className="insp-issue-meta">
                <span className={`insp-severity-dot insp-severity-dot--${issue.severity}`} aria-hidden="true" />
                <span className="insp-severity-text">{SEVERITY_LABEL[issue.severity]}</span>
                <span className="insp-clause">{issue.clause}</span>
                {issue.lineNumber && (
                  <span className="insp-line-tag">第 {issue.lineNumber} 行</span>
                )}
              </div>
              <h3 className="insp-issue-title">{issue.title}</h3>
              <p className="insp-issue-detail">{issue.detail}</p>
              {(issue.lineNumber || issue.fix) && (
                <div className="insp-issue-actions">
                  {issue.lineNumber && (
                    <button
                      type="button"
                      className="insp-mini-btn"
                      onClick={() => onLocateLine(issue.lineNumber!)}
                    >
                      定位原文
                    </button>
                  )}
                  {issue.fix && (
                    <button
                      type="button"
                      className="insp-mini-btn insp-mini-btn--accent"
                      onClick={() => onApplyFix(issue)}
                    >
                      {issue.fix.label}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
