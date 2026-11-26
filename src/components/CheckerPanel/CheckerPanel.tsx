import type { CheckIssue } from '../../checker'
import './CheckerPanel.css'

interface CheckerPanelProps {
  issues: CheckIssue[]
  onClose: () => void
  onLocateLine: (lineNumber: number) => void
  onApplyFix: (issue: CheckIssue) => void
  onApplyAllFixes: () => void
}

const SEVERITY_LABEL: Record<CheckIssue['severity'], string> = {
  error: '严重',
  warning: '规范建议',
  info: '提醒',
}

export function CheckerPanel({
  issues,
  onClose,
  onLocateLine,
  onApplyFix,
  onApplyAllFixes,
}: CheckerPanelProps) {
  const fixableCount = issues.filter((item) => item.fix).length

  return (
    <aside className="checker-drawer" role="dialog" aria-label="GB/T 9704 公文规范体检">
      <div className="checker-header">
        <div>
          <h2 className="checker-title">公文规范体检</h2>
          <p className="checker-subtitle">纯离线确定性规则检测（对照 GB/T 9704—2012）</p>
        </div>
        <button type="button" className="checker-close" onClick={onClose} aria-label="关闭体检面板">
          ✕
        </button>
      </div>

      <div className="checker-summary">
        <span className={`checker-status-pill ${issues.length === 0 ? 'checker-status-pill--ok' : 'checker-status-pill--warn'}`}>
          {issues.length === 0 ? '未发现规范问题' : `共检测到 ${issues.length} 项建议`}
        </span>
        {fixableCount > 0 && (
          <button
            type="button"
            className="checker-fix-all-btn"
            onClick={onApplyAllFixes}
          >
            一键修复全部可修项 ({fixableCount})
          </button>
        )}
      </div>

      <div className="checker-body">
        {issues.length === 0 ? (
          <div className="checker-empty">
            <p className="checker-empty-title">版式与结构符合规范要求</p>
            <p className="checker-empty-desc">
              已检查标题标点、一至三级标题序号连续性、附件末尾标点、成文日期写法、发文字号六角括号、成对标点以及分页孤行落款。
            </p>
          </div>
        ) : (
          <div className="checker-list">
            {issues.map((issue) => (
              <article key={issue.id} className={`checker-card checker-card--${issue.severity}`}>
                <div className="checker-card-meta">
                  <span className={`checker-severity checker-severity--${issue.severity}`}>
                    {SEVERITY_LABEL[issue.severity]}
                  </span>
                  <span className="checker-clause">{issue.clause}</span>
                  {issue.lineNumber && (
                    <span className="checker-line-tag">第 {issue.lineNumber} 行</span>
                  )}
                </div>
                <h3 className="checker-card-title">{issue.title}</h3>
                <p className="checker-card-detail">{issue.detail}</p>
                <div className="checker-card-actions">
                  {issue.lineNumber && (
                    <button
                      type="button"
                      className="checker-btn"
                      onClick={() => onLocateLine(issue.lineNumber!)}
                    >
                      定位原文
                    </button>
                  )}
                  {issue.fix && (
                    <button
                      type="button"
                      className="checker-btn checker-btn--primary"
                      onClick={() => onApplyFix(issue)}
                    >
                      {issue.fix.label}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
