import type { DocumentNode } from '../../types/ast'
import type { HeaderConfig, FooterNoteConfig } from '../../types/documentConfig'
import { DocumentFlow } from './DocumentFlow'
import './A4Page.css'

interface A4PageProps {
  title: DocumentNode | null
  body: DocumentNode[]
  pageNumber: number
  /** 内容流偏移量(px)，用于视窗裁剪定位 */
  offsetY: number
  /** 该页应显示的内容高度(px)，精确到行边界 */
  clipHeight: number
  /** 是否显示页码 */
  showPageNumber: boolean
  /** 是否对正文首句加粗 */
  boldFirstSentence: boolean
  /** 版头配置 */
  headerConfig: HeaderConfig
  /** 版记配置 */
  footerNoteConfig: FooterNoteConfig
  /** 是否为第一页 */
  isFirstPage: boolean
  /** 是否为最后一页 */
  isLastPage: boolean
  /**
   * 是否加盖印章
   * - true: 成文日期右空四字 (GB/T 9704 7.3.5.1)
   * - false: 成文日期右空二字 (GB/T 9704 7.3.5.2)
   */
  hasStamp: boolean
}

export function A4Page({
  title,
  body,
  pageNumber,
  offsetY,
  clipHeight,
  showPageNumber,
  boldFirstSentence,
  headerConfig,
  footerNoteConfig,
  isFirstPage,
  isLastPage,
  hasStamp,
}: A4PageProps) {
  return (
    <div className="a4-page">
      <div className="a4-content">
        {/* 版头：仅在第一页且启用时渲染 */}
        {isFirstPage && headerConfig.enabled && headerConfig.orgName && (
          <div className="a4-header-section">
            <div className="a4-header-org">{headerConfig.orgName}</div>
            <div className={`a4-header-meta${headerConfig.signer ? ' a4-header-meta--with-signer' : ''}`}>
              <span>{headerConfig.docNumber}</span>
              {headerConfig.signer && (
                <span>
                  <span className="a4-header-signer-label">签发人：</span>
                  <span className="a4-header-signer-name">{headerConfig.signer}</span>
                </span>
              )}
            </div>
            <div className="a4-header-separator"></div>
          </div>
        )}
        <div className="a4-content-viewport" style={{ height: `${clipHeight}px` }}>
          <div style={{ transform: `translateY(-${offsetY}px)` }}>
            <DocumentFlow
              title={title}
              body={body}
              boldFirstSentence={boldFirstSentence}
              hasStamp={hasStamp}
              showPlaceholder
            />
          </div>
        </div>
      </div>
      {/* 版记：绝对定位到最后一页底部，末条线与版心下边缘重合 */}
      {isLastPage && footerNoteConfig.enabled && (
        <div className="a4-footer-note">
          <div className="a4-footer-note-line-top"></div>
          {footerNoteConfig.cc && (
            <div className="a4-footer-note-cc">抄送：{footerNoteConfig.cc}</div>
          )}
          {(footerNoteConfig.printer || footerNoteConfig.printDate) && (
            <div className="a4-footer-note-printer">
              <span>{footerNoteConfig.printer}</span>
              <span>{footerNoteConfig.printDate}{footerNoteConfig.printDate && '印发'}</span>
            </div>
          )}
          <div className="a4-footer-note-line-bottom"></div>
        </div>
      )}
      {showPageNumber && (
        <div className={`a4-footer ${pageNumber % 2 === 0 ? 'a4-footer-even' : 'a4-footer-odd'}`}>
          — {pageNumber} —
        </div>
      )}
    </div>
  )
}
