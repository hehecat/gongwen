import { memo, type CSSProperties } from 'react'
import type { DocumentNode } from '../../types/ast'
import type { FooterNoteConfig, HeaderConfig, PageNumberStyle } from '../../types/documentConfig'
import { ensureChinesePeriod, parseSigners, resolveHeaderRenderPlan } from '../../layout/typography'
import { DocumentFlow } from './DocumentFlow'
import './A4Page.css'

interface A4PageProps {
  title: DocumentNode | null
  body: DocumentNode[]
  pageNumber: number
  /** 切片子树偏移量(px) */
  sliceOffsetY: number
  /** 该页应显示的内容高度(px) */
  clipHeight: number
  /** 节点切片起止索引 */
  startNodeIndex: number
  endNodeIndex: number
  isContinuation: boolean
  /** 是否显示页码 */
  showPageNumber: boolean
  /** 页码样式 */
  pageNumberStyle: PageNumberStyle
  boldFirstSentence: boolean
  boldHeading2: boolean
  boldHeading3: boolean
  headerConfig: HeaderConfig
  footerNoteConfig: FooterNoteConfig
  isFirstPage: boolean
  isLastPage: boolean
  hasStamp: boolean
  signerTitle: string
  signerStampName: string
  onSelectLine?: (lineNumber: number) => void
}

function renderHeaderSection(headerConfig: HeaderConfig) {
  const plan = resolveHeaderRenderPlan(headerConfig)
  if (!plan.shouldRender) return null

  const orgStyle: CSSProperties = {
    fontFamily: `var(--header-org-font, '方正小标宋_GBK'), 'STSong', serif`,
    fontSize: `${headerConfig.orgNameFontSize}px`,
    letterSpacing: headerConfig.orgNameAlign === 'center' && headerConfig.orgNameLetterSpacing > 0
      ? `${headerConfig.orgNameLetterSpacing}px`
      : undefined,
  }
  const orgLines = headerConfig.orgName.split('\n').map((l) => l.trim()).filter(Boolean)
  const suffix = headerConfig.orgNameSuffix.trim()
  const isDistribute = headerConfig.orgNameAlign === 'distribute'

  const renderOrgVisual = () => {
    if (headerConfig.customImageDataUrl.trim()) {
      return (
        <div className="a4-header-image-wrap">
          <img
            className="a4-header-image"
            src={headerConfig.customImageDataUrl}
            alt="自定义红头版头"
            style={{ height: `${(headerConfig.customImageHeightMm * 72) / 25.4}px` }}
          />
        </div>
      )
    }

    if (suffix) {
      return (
        <div className="a4-header-org-with-suffix" style={orgStyle}>
          <div className={`a4-header-org-lines${isDistribute ? ' a4-header-org--distribute' : ''}`}>
            {orgLines.map((line, i) => (
              <div key={i} className="a4-header-org-line">{line}</div>
            ))}
          </div>
          <div className="a4-header-org-suffix">{suffix}</div>
        </div>
      )
    }

    return (
      <div
        className={`a4-header-org${isDistribute ? ' a4-header-org--distribute' : ''}`}
        style={orgStyle}
      >
        {orgLines.map((line, i) => (
          <div key={i} className="a4-header-org-line">{line}</div>
        ))}
      </div>
    )
  }

  const renderTopLeftSecurity = () => {
    if (!plan.hasTopLeftMeta) return null
    return (
      <div className="a4-header-security">
        {headerConfig.copyNumber.trim() && (
          <div className="a4-header-copy-num">{headerConfig.copyNumber.trim()}</div>
        )}
        {headerConfig.secretLevel.trim() && (
          <div className="a4-header-secret">{headerConfig.secretLevel.trim()}</div>
        )}
        {headerConfig.urgency.trim() && (
          <div className="a4-header-urgency">{headerConfig.urgency.trim()}</div>
        )}
      </div>
    )
  }

  if (headerConfig.format === 'letter') {
    return (
      <div className="a4-header-section a4-header-section--letter">
        {renderOrgVisual()}
        <div className="a4-header-letter-double-line" />
        {(plan.hasTopLeftMeta || headerConfig.docNumber.trim()) && (
          <div className="a4-header-letter-meta">
            <div className="a4-header-letter-left">{renderTopLeftSecurity()}</div>
            <div className="a4-header-letter-right">{headerConfig.docNumber.trim()}</div>
          </div>
        )}
      </div>
    )
  }

  if (headerConfig.format === 'command') {
    return (
      <div className="a4-header-section a4-header-section--command">
        {renderOrgVisual()}
        {headerConfig.docNumber.trim() && (
          <div className="a4-header-command-num">{headerConfig.docNumber.trim()}</div>
        )}
      </div>
    )
  }

  if (headerConfig.format === 'minutes') {
    return (
      <div className="a4-header-section a4-header-section--minutes">
        {renderOrgVisual()}
        {headerConfig.docNumber.trim() && (
          <div className="a4-header-minutes-num">{headerConfig.docNumber.trim()}</div>
        )}
        {headerConfig.separatorStyle !== 'none' && (
          <div className={`a4-header-separator${headerConfig.separatorStyle === 'star' ? ' a4-header-separator--star' : ''}`}>
            {headerConfig.separatorStyle === 'star' && <span className="a4-header-star">★</span>}
          </div>
        )}
      </div>
    )
  }

  const signerRows = parseSigners(headerConfig.signer)

  return (
    <div className="a4-header-section">
      {renderTopLeftSecurity()}
      {renderOrgVisual()}
      {plan.hasMetaRow && (
        signerRows.length > 0 ? (
          <div className="a4-header-signer-block">
            {signerRows.map((rowNames, rowIdx) => {
              const isLastRow = rowIdx === signerRows.length - 1
              return (
                <div key={rowIdx} className="a4-header-meta a4-header-meta--with-signer">
                  <span>{isLastRow ? headerConfig.docNumber.trim() : ''}</span>
                  <span>
                    {rowIdx === 0 && <span className="a4-header-signer-label">签发人：</span>}
                    <span className="a4-header-signer-name">{rowNames.join('\u3000')}</span>
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="a4-header-meta">
            <span>{headerConfig.docNumber.trim()}</span>
          </div>
        )
      )}
      {headerConfig.separatorStyle !== 'none' && (
        <div className={`a4-header-separator${headerConfig.separatorStyle === 'star' ? ' a4-header-separator--star' : ''}`}>
          {headerConfig.separatorStyle === 'star' && <span className="a4-header-star">★</span>}
        </div>
      )}
    </div>
  )
}

export const A4Page = memo(function A4Page({
  title,
  body,
  pageNumber,
  sliceOffsetY,
  clipHeight,
  startNodeIndex,
  endNodeIndex,
  isContinuation,
  showPageNumber,
  pageNumberStyle,
  boldFirstSentence,
  boldHeading2,
  boldHeading3,
  headerConfig,
  footerNoteConfig,
  isFirstPage,
  isLastPage,
  hasStamp,
  signerTitle,
  signerStampName,
  onSelectLine,
}: A4PageProps) {
  const headerPlan = resolveHeaderRenderPlan(headerConfig)
  const shouldShowPageNumber = showPageNumber && !(isFirstPage && headerPlan.hideFirstPageNumber)
  const hasMainRecipient = Boolean(footerNoteConfig.mainRecipient.trim())
  const hasCc = Boolean(footerNoteConfig.cc.trim())
  const hasPrint = !headerPlan.isLetterFooterNote && Boolean(footerNoteConfig.printer.trim() || footerNoteConfig.printDate.trim())

  return (
    <div className="a4-page">
      <div className="a4-content">
        {isFirstPage && renderHeaderSection(headerConfig)}
        <div className="a4-content-viewport" style={{ height: `${clipHeight}px` }}>
          <div className="a4-flow-slice" style={{ transform: `translateY(-${sliceOffsetY}px)` }}>
            <DocumentFlow
              title={title}
              body={body}
              boldFirstSentence={boldFirstSentence}
              boldHeading2={boldHeading2}
              boldHeading3={boldHeading3}
              hasStamp={hasStamp}
              signerTitle={signerTitle}
              signerStampName={signerStampName}
              showPlaceholder={isFirstPage}
              startNodeIndex={startNodeIndex}
              endNodeIndex={endNodeIndex}
              isContinuation={isContinuation}
              onSelectLine={onSelectLine}
            />
          </div>
        </div>
      </div>

      {/* §10.1 信函首页底部 20mm 红色双线 */}
      {isFirstPage && headerPlan.hideFirstPageNumber && (
        <div className="a4-letter-bottom-line" aria-hidden="true" />
      )}

      {/* 版记：锚定最后一页版心底部 */}
      {isLastPage && footerNoteConfig.enabled && (
        <div className={`a4-footer-note${headerPlan.isLetterFooterNote ? ' a4-footer-note--letter' : ''}`}>
          {!headerPlan.isLetterFooterNote && <div className="a4-footer-note-line-top" />}
          {hasMainRecipient && (
            <div className="a4-footer-note-cc">
              <span className="a4-footer-note-cc-label">主送：</span>
              <span className="a4-footer-note-cc-text">{ensureChinesePeriod(footerNoteConfig.mainRecipient)}</span>
            </div>
          )}
          {hasCc && (
            <div className="a4-footer-note-cc">
              <span className="a4-footer-note-cc-label">抄送：</span>
              <span className="a4-footer-note-cc-text">{ensureChinesePeriod(footerNoteConfig.cc)}</span>
            </div>
          )}
          {!headerPlan.isLetterFooterNote && (hasMainRecipient || hasCc) && hasPrint && (
            <div className="a4-footer-note-line-middle" />
          )}
          {hasPrint && (
            <div className="a4-footer-note-printer">
              <span>{footerNoteConfig.printer.trim()}</span>
              <span>
                {footerNoteConfig.printDate.trim()}
                {footerNoteConfig.printDate.trim() && '印发'}
              </span>
            </div>
          )}
          {!headerPlan.isLetterFooterNote && <div className="a4-footer-note-line-bottom" />}
        </div>
      )}

      {shouldShowPageNumber && (
        <div className={`a4-footer ${pageNumberStyle === 'center' ? 'a4-footer-center' : pageNumber % 2 === 0 ? 'a4-footer-even' : 'a4-footer-odd'}`}>
          — {pageNumber} —
        </div>
      )}
    </div>
  )
})
