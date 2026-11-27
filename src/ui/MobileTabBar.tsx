import type { MobileTabMode } from './TopConsole'
import { EditPenIcon, PreviewPageIcon, SlidersIcon } from './icons'

interface MobileTabBarProps {
  activeTab: MobileTabMode
  onChangeTab: (tab: MobileTabMode) => void
  issueCount: number
  errorCount: number
  hasContent: boolean
  pageCount: number
}

export function MobileTabBar({
  activeTab,
  onChangeTab,
  issueCount,
  errorCount,
  hasContent,
  pageCount,
}: MobileTabBarProps) {
  const showBadge = hasContent && issueCount > 0

  return (
    <nav className="cb-mobile-tabbar cb-no-print" aria-label="移动端主导航">
      <button
        type="button"
        className={`cb-mobile-tab${activeTab === 'write' ? ' is-active' : ''}`}
        aria-current={activeTab === 'write' ? 'page' : undefined}
        onClick={() => onChangeTab('write')}
      >
        <EditPenIcon size={18} />
        <span className="cb-mobile-tab-label">文稿</span>
      </button>

      <button
        type="button"
        className={`cb-mobile-tab${activeTab === 'preview' ? ' is-active' : ''}`}
        aria-current={activeTab === 'preview' ? 'page' : undefined}
        onClick={() => onChangeTab('preview')}
      >
        <PreviewPageIcon size={18} />
        <span className="cb-mobile-tab-label cb-tabular">
          {pageCount > 1 ? `预览 (${pageCount})` : '预览'}
        </span>
      </button>

      <button
        type="button"
        className={`cb-mobile-tab${activeTab === 'studio' ? ' is-active' : ''}`}
        aria-current={activeTab === 'studio' ? 'page' : undefined}
        onClick={() => onChangeTab('studio')}
      >
        <span className="cb-mobile-tab-icon-wrap">
          <SlidersIcon size={18} />
          {showBadge && (
            <span
              className={`cb-mobile-tab-badge cb-tabular ${errorCount > 0 ? 'is-err' : 'is-warn'}`}
            >
              {issueCount > 99 ? '99+' : issueCount}
            </span>
          )}
        </span>
        <span className="cb-mobile-tab-label">排版</span>
      </button>
    </nav>
  )
}
