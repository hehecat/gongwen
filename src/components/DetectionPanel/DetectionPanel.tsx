import { 
  DetectionStatus, 
  DetectionPointType, 
  type DetectionPoint, 
  type BodyStats,
  type HeadingLevelWarning,
  type HeadingLevelIssue,
  type HeadingNumberWarning,
  type HeadingNumberIssue,
} from '../../types/detection'
import { useDetectionData } from '../../hooks/useDetectionData'
import type { GongwenAST } from '../../types/ast'
import './DetectionPanel.css'

interface DetectionPanelProps {
  ast: GongwenAST
}

/** 状态颜色映射 */
var STATUS_COLORS: Record<DetectionStatus, string> = {
  [DetectionStatus.DETECTED]: '#11AA66',
  [DetectionStatus.MISSING]: '#999999',
  [DetectionStatus.WARNING]: '#d81e06',
}

/** 状态图标组件 */
function StatusIcon({ status }: { status: DetectionStatus }) {
  var iconSrc = ''
  if (status === DetectionStatus.DETECTED) {
    iconSrc = '/正确.svg'
  } else if (status === DetectionStatus.WARNING) {
    iconSrc = '/警告.svg'
  } else {
    iconSrc = '/暂无.svg'
  }
  return (
    <img 
      src={iconSrc} 
      alt="" 
      className="detection-icon"
      width="18"
      height="18"
    />
  )
}

/** 正文统计信息组件 */
function BodyStatsView({ stats }: { stats: BodyStats }) {
  var h = stats.headingCounts
  var headingParts: string[] = []
  if (h.h1 > 0) headingParts.push('一级标题 ' + h.h1)
  if (h.h2 > 0) headingParts.push('二级标题 ' + h.h2)
  if (h.h3 > 0) headingParts.push('三级标题 ' + h.h3)
  if (h.h4 > 0) headingParts.push('四级标题 ' + h.h4)

  return (
    <div className="detection-body-stats">
      <div className="detection-body-stats-row">
        <span className="detection-body-stats-value">{stats.charCount}</span>
        <span className="detection-body-stats-label">字</span>
        <span className="detection-body-stats-sep">|</span>
        <span className="detection-body-stats-value">{stats.paragraphCount}</span>
        <span className="detection-body-stats-label">段落</span>
      </div>
      {headingParts.length > 0 && (
        <div className="detection-body-stats-row">
          {headingParts.map(function (part, index) {
            return (
              <span key={index}>
                {index > 0 && <span className="detection-body-stats-sep">|</span>}
                <span className="detection-body-stats-heading">{part}</span>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** 标题层级警告组件 */
function HeadingLevelWarningView({ warning }: { warning: HeadingLevelWarning }) {
  return (
    <div className="detection-heading-warning">
      <div className="detection-heading-warning-title">标题层级问题：</div>
      <ul className="detection-heading-warning-list">
        {warning.issues.map(function (issue, index) {
          return (
            <li key={index}>
              <span className="detection-heading-warning-content">"{issue.content}"</span>
              <span className="detection-heading-warning-desc">（{getLevelName(issue.level)}缺少{getLevelName(issue.missingParentLevel)}）</span>
            </li>
          )
        })}
      </ul>
      <div className="detection-standard-hint">
        <div className="detection-standard-hint-title">党政机关公文格式规范：</div>
        <div className="detection-standard-hint-text">文中结构层次序数依次可以用"一、""（一）""1.""（1）"标注</div>
      </div>
    </div>
  )
}

/** 标题序号警告组件 */
function HeadingNumberWarningView({ warning }: { warning: HeadingNumberWarning }) {
  return (
    <div className="detection-heading-warning">
      <div className="detection-heading-warning-title">标题序号问题：</div>
      <ul className="detection-heading-warning-list">
        {warning.issues.map(function (issue, index) {
          return (
            <li key={index}>
              <span className="detection-heading-warning-content">"{issue.content}"</span>
              <span className="detection-heading-warning-desc">（期望：{getNumberDisplay(issue.expected, issue.level)}，实际：{issue.actual !== null ? getNumberDisplay(issue.actual, issue.level) : '无法解析'}，{issue.description}）</span>
            </li>
          )
        })}
      </ul>
      <div className="detection-standard-hint">
        <div className="detection-standard-hint-title">党政机关公文格式规范：</div>
        <div className="detection-standard-hint-text">文中结构层次序数依次可以用"一、""（一）""1.""（1）"标注</div>
      </div>
    </div>
  )
}

/** 获取序号显示文本 */
function getNumberDisplay(num: number, level: number): string {
  var CHINESE_DIGITS = '一二三四五六七八九十'
  if (level === 1) {
    return CHINESE_DIGITS.charAt(num - 1) + '、'
  } else if (level === 2) {
    return '（' + CHINESE_DIGITS.charAt(num - 1) + '）'
  } else if (level === 3) {
    return num + '.'
  } else if (level === 4) {
    return '（' + num + '）'
  }
  return ''
}

/** 获取标题级别名称 */
function getLevelName(level: number): string {
  switch (level) {
    case 1: return '一级标题'
    case 2: return '二级标题'
    case 3: return '三级标题'
    case 4: return '四级标题'
    default: return ''
  }
}

/**
 * 格式化显示内容
 * 主送机关自动隐藏末尾冒号
 */
function formatDisplayContent(content: string, type: DetectionPointType): string {
  if (type === DetectionPointType.ADDRESSEE && content.endsWith('：')) {
    return content.slice(0, -1)
  }
  if (type === DetectionPointType.ADDRESSEE && content.endsWith(':')) {
    return content.slice(0, -1)
  }
  return content
}

/** 检测点卡片组件 */
function DetectionPointCard({ point }: { point: DetectionPoint }) {
  var isMissing = point.status === DetectionStatus.MISSING
  var isWarning = point.status === DetectionStatus.WARNING
  var isBody = point.type === DetectionPointType.BODY
  var color = STATUS_COLORS[point.status]

  var cardClass = [
    'detection-card',
    isMissing ? 'detection-card--missing' : '',
    isWarning ? 'detection-card--warning' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="detection-item">
      {/* 左侧竖线主干 */}
      <div className="detection-trunk">
        <div 
          className="detection-trunk-line" 
          style={{ backgroundColor: color }}
        />
        {/* 横线连接 */}
        <div 
          className="detection-branch" 
          style={{ backgroundColor: color }}
        />
        {/* 继续向下的竖线 - 延伸到下一个节点 */}
        <div 
          className="detection-trunk-line--continue" 
          style={{ backgroundColor: color }}
        />
      </div>
      {/* 卡片内容 */}
      <div 
        className={cardClass}
        style={{ borderColor: color }}
      >
        <div 
          className="detection-card-header"
          style={{ borderBottomColor: color }}
        >
          <StatusIcon status={point.status} />
          <span 
            className="detection-card-label"
            style={{ color: color }}
          >
            {point.label}
          </span>
        </div>
        <div className="detection-card-content">
          {isBody ? (
            <BodyStatsView stats={point.meta.bodyStats || { charCount: 0, paragraphCount: 0, headingCounts: { h1: 0, h2: 0, h3: 0, h4: 0 } }} />
          ) : isMissing ? (
            <span className="detection-card-placeholder">未检测到</span>
          ) : (
            <span className="detection-card-text">{formatDisplayContent(point.content || '', point.type)}</span>
          )}
          {/* 标题层级警告 */}
          {isBody && point.meta.headingLevelWarning && (
            <HeadingLevelWarningView warning={point.meta.headingLevelWarning} />
          )}
          {/* 标题序号警告 */}
          {isBody && point.meta.headingNumberWarning && (
            <HeadingNumberWarningView warning={point.meta.headingNumberWarning} />
          )}
        </div>
        {/* 日期警告 */}
        {isWarning && point.meta.dateWarning && (
          <div className="detection-card-warning">
            <img src="/警告.svg" alt="" width="14" height="14" />
            <span className="detection-card-warning-text">{point.meta.dateWarning.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** 检测面板主组件 */
export function DetectionPanel({ ast }: DetectionPanelProps) {
  var result = useDetectionData(ast)
  var points = result.points

  return (
    <div className="detection-panel">
      <div className="detection-content">
        {points.map(function (point) {
          return (
            <DetectionPointCard 
              key={point.type} 
              point={point} 
            />
          )
        })}
      </div>
    </div>
  )
}
