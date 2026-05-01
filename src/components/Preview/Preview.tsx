import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties, type KeyboardEvent } from 'react'
import { useDocumentConfig } from '../../contexts/DocumentConfigContext'
import { CHARS_PER_LINE, FONT_OPTIONS, FONT_SIZE_OPTIONS, cmToPagePercent } from '../../types/documentConfig'
import { normalizeEditorHtml } from '../../utils/richText'
import './A4Page.css'
import './Preview.css'

interface PreviewProps {
  value: string
  onChange: (value: string) => void
}

const FONT_FAMILY_OPTIONS = FONT_OPTIONS.map((option) => option.value)
const FONT_SIZE_OPTIONS_CN = FONT_SIZE_OPTIONS.map((option) => ({
  label: option.label,
  value: option.value,
}))
const BLOCK_SELECTOR = 'p,div,h1,h2,h3,h4,h5,h6'

function exec(command: string, value?: string) {
  document.execCommand('styleWithCSS', false, 'true')
  document.execCommand(command, false, value)
}

function applyFontSize(size: number) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

  const range = selection.getRangeAt(0)
  const span = document.createElement('span')
  span.style.fontSize = `${size}pt`
  try {
    range.surroundContents(span)
  } catch {
    const fragment = range.extractContents()
    span.appendChild(fragment)
    range.insertNode(span)
  }
  selection.removeAllRanges()
}

function getHeaderOrgFontSize(orgName: string, leftMargin: number, rightMargin: number): number {
  const length = Math.max(1, Array.from(orgName.trim()).length)
  const availablePx = 595 * (1 - (leftMargin * 10 / 210) - (rightMargin * 10 / 210))
  return Math.max(18, Math.min(30, Math.floor(availablePx / length)))
}

function getSelectedBlocks(root: HTMLElement): HTMLElement[] {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return []

  const range = selection.getRangeAt(0)
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))
  const selected = blocks.filter((block) => {
    try {
      return range.intersectsNode(block)
    } catch {
      return false
    }
  })

  if (selected.length > 0) return selected

  const startNode = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as HTMLElement
    : range.startContainer.parentElement
  const fallback = startNode?.closest<HTMLElement>(BLOCK_SELECTOR)
  return fallback && root.contains(fallback) ? [fallback] : []
}

export function Preview({ value, onChange }: PreviewProps) {
  const { config } = useDocumentConfig()
  const editorRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)
  const [currentFont, setCurrentFont] = useState(FONT_FAMILY_OPTIONS[0])
  const [currentFontSize, setCurrentFontSize] = useState(FONT_SIZE_OPTIONS_CN[3]?.value ?? 16)
  const headerOrgFontSize = useMemo(
    () => getHeaderOrgFontSize(config.header.orgName, config.margins.left, config.margins.right),
    [config.header.orgName, config.margins.left, config.margins.right],
  )
  const headerOrgChars = useMemo(
    () => Array.from(config.header.orgName.trim()),
    [config.header.orgName],
  )

  const cssVars = useMemo((): CSSProperties => {
    const pageWidthPx = 595
    const marginLeftPct = deferredConfig.margins.left * 10 / 210
    const marginRightPct = deferredConfig.margins.right * 10 / 210
    const availablePx = contentWidthPx ?? pageWidthPx * (1 - marginLeftPct - marginRightPct)
    const fallbackTextWidth = deferredConfig.body.fontSize * CHARS_PER_LINE
    const textWidth = characterMeasure?.textWidth ?? fallbackTextWidth
    const letterSpacingUnits = characterMeasure?.letterSpacingUnits ?? Math.max(1, CHARS_PER_LINE - 1)
    const charSpacingPx = (availablePx - textWidth - PREVIEW_LINE_FIT_TOLERANCE_PX) / letterSpacingUnits

    return {
      '--margin-top': `${cmToPagePercent(config.margins.top, 'x')}%`,
      '--margin-bottom': `${cmToPagePercent(config.margins.bottom, 'x')}%`,
      '--margin-left': `${cmToPagePercent(config.margins.left, 'x')}%`,
      '--margin-right': `${cmToPagePercent(config.margins.right, 'x')}%`,
      '--margin-bottom-y': `${cmToPagePercent(config.margins.bottom, 'y')}%`,
      '--title-font': config.title.fontFamily,
      '--title-size': `${config.title.fontSize}pt`,
      '--title-line-height': `${config.title.lineSpacing}pt`,
      '--body-font': config.body.fontFamily,
      '--body-size': `${config.body.fontSize}pt`,
      '--body-line-height': `${config.body.lineSpacing}pt`,
      '--body-indent': `${config.body.firstLineIndent}em`,
      '--char-spacing': `${charSpacingPx.toFixed(4)}px`,
      '--h1-font': config.headings.h1.fontFamily,
      '--h1-size': `${config.headings.h1.fontSize}pt`,
      '--h2-font': config.headings.h2.fontFamily,
      '--h2-size': `${config.headings.h2.fontSize}pt`,
      '--h3-font': config.advanced.h3.fontFamily,
      '--page-number-font': config.specialOptions.pageNumberFont,
    } as CSSProperties
  }, [bodyPreviewFontFamily, characterMeasure, contentWidthPx, deferredConfig, pageWidthPx])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const normalized = normalizeEditorHtml(value)
    if (editor.innerHTML === normalized) return
    syncingRef.current = true
    editor.innerHTML = normalized
    syncingRef.current = false
  }, [value])

  const emitChange = useCallback(() => {
    const editor = editorRef.current
    if (!editor || syncingRef.current) return
    onChange(normalizeEditorHtml(editor.innerHTML))
  }, [onChange])

  const handleFontChange = useCallback((fontFamily: string) => {
    setCurrentFont(fontFamily)
    exec('fontName', fontFamily)
    emitChange()
  }, [emitChange])

  const handleFontSizeChange = useCallback((fontSize: number) => {
    setCurrentFontSize(fontSize)
    applyFontSize(fontSize)
    emitChange()
  }, [emitChange])

  const handleAlignmentChange = useCallback((alignment: 'left' | 'center' | 'right' | 'justify') => {
    const editor = editorRef.current
    if (!editor) return

    const blocks = getSelectedBlocks(editor)
    if (blocks.length === 0) return

    for (const block of blocks) {
      block.style.textAlign = alignment
      if (alignment === 'justify') {
        if (block.dataset.alignNoIndent === 'true') {
          delete block.dataset.alignNoIndent
          delete block.dataset.noIndent
        }
      } else {
        block.dataset.noIndent = 'true'
        block.dataset.alignNoIndent = 'true'
      }
    }

    emitChange()
  }, [emitChange])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Backspace') return

    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const block = (range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as HTMLElement
      : range.startContainer.parentElement
    )?.closest('p')

    if (!block || block.dataset.noIndent === 'true') return

    const blockRange = document.createRange()
    blockRange.selectNodeContents(block)
    blockRange.setEnd(range.startContainer, range.startOffset)
    const textBeforeCaret = blockRange.toString()

    if (textBeforeCaret.length === 0) {
      block.dataset.noIndent = 'true'
      emitChange()
      e.preventDefault()
    }
  }, [emitChange])

  return (
    <div className="preview-container">
      <div className="preview-header">
        <div className="preview-header-main">
          <span className="preview-label">排版</span>
        </div>
        <div className="preview-toolbar">
          <select className="preview-select" value={currentFont} onChange={(e) => handleFontChange(e.target.value)}>
            {FONT_FAMILY_OPTIONS.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
          <select className="preview-select preview-select--size" value={currentFontSize} onChange={(e) => handleFontSizeChange(Number(e.target.value))}>
            {FONT_SIZE_OPTIONS_CN.map((option) => (
              <option key={option.label} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button type="button" className="preview-tool-btn" onClick={() => { exec('bold'); emitChange() }}><strong>B</strong></button>
          <button type="button" className="preview-tool-btn" onClick={() => { exec('italic'); emitChange() }}><em>I</em></button>
          <button type="button" className="preview-tool-btn" onClick={() => { exec('underline'); emitChange() }}><u>U</u></button>
          <button type="button" className="preview-tool-btn" onClick={() => handleAlignmentChange('left')}>左</button>
          <button type="button" className="preview-tool-btn" onClick={() => handleAlignmentChange('center')}>中</button>
          <button type="button" className="preview-tool-btn" onClick={() => handleAlignmentChange('right')}>右</button>
          <button type="button" className="preview-tool-btn" onClick={() => handleAlignmentChange('justify')}>两端</button>
        </div>
      </div>
      <div className="preview-scroll" style={cssVars}>
        <div className="preview-page-shell">
          <div className="preview-page-content a4-content">
            {config.header.enabled && config.header.orgName && (
              <div className={`preview-header-section ${config.header.mode === 'note' ? 'preview-header-section--note' : ''}`}>
                <div className="a4-header-org" style={{ fontSize: `${headerOrgFontSize}pt` }}>
                  {headerOrgChars.map((char, index) => (
                    <span key={`${char}-${index}`} className="a4-header-org-char">
                      {char === ' ' ? '\u00a0' : char}
                    </span>
                  ))}
                </div>
                {config.header.mode === 'formal' && (config.header.docNumber || config.header.signer) && (
                  <div className={`a4-header-meta${config.header.signer ? ' a4-header-meta--with-signer' : ''}`}>
                    <span>{config.header.docNumber}</span>
                    {config.header.signer && (
                      <span>
                        <span className="a4-header-signer-label">签发人：</span>
                        <span className="a4-header-signer-name">{config.header.signer}</span>
                      </span>
                    )}
                  </div>
                )}
                <div className="a4-header-separator"></div>
              </div>
            )}
            <div
              ref={editorRef}
              className="preview-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={emitChange}
              onBlur={emitChange}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
