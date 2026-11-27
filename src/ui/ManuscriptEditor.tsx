import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CheckIssue } from '../checker'
import type { NodeTypeOverrides } from '../types/ast'
import type { SanitizeConfig } from '../types/documentConfig'
import type { SampleDocument } from '../utils/sampleDocuments'
import type { SanitizeResult } from '../utils/sanitize'
import { SwitchField } from './FormControls'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  FileDocIcon,
  SparkCleanIcon,
  TrashIcon,
  UploadIcon,
} from './icons'

export interface LineJumpRequest {
  lineNumber: number
  seq: number
}

interface MeasuredLineBox {
  top: number
  height: number
}

interface ManuscriptEditorProps {
  text: string
  onChangeText: (next: string) => void
  overrides: NodeTypeOverrides
  issues: CheckIssue[]
  sanitizeConfig: SanitizeConfig
  sanitizeResult: SanitizeResult
  onUpdateSanitize: (patch: Partial<SanitizeConfig>) => void
  onCommitSanitizedToRaw: () => void
  samples: SampleDocument[]
  onLoadSample: (sample: SampleDocument) => void
  onImportFiles: (files: FileList | null) => void
  onClearText: () => void
  onCopySanitized: () => Promise<boolean>
  paragraphCount: number
  pageCount: number
  jumpRequest: LineJumpRequest | null
}

const MAX_EXACT_MIRROR_LINES = 1600
const FALLBACK_LINE_HEIGHT_PX = 25.5
const EDITOR_TOP_PADDING_PX = 20

export function ManuscriptEditor({
  text,
  onChangeText,
  overrides,
  issues,
  sanitizeConfig,
  sanitizeResult,
  onUpdateSanitize,
  onCommitSanitizedToRaw,
  samples,
  onLoadSample,
  onImportFiles,
  onClearText,
  onCopySanitized,
  paragraphCount,
  pageCount,
  jumpRequest,
}: ManuscriptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const gutterInnerRef = useRef<HTMLDivElement | null>(null)
  const backdropInnerRef = useRef<HTMLDivElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const barPopoverRef = useRef<HTMLDivElement | null>(null)

  const [openPopover, setOpenPopover] = useState<'samples' | 'sanitize' | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeLine, setActiveLine] = useState(1)
  const [flashedLine, setFlashedLine] = useState<number | null>(null)
  const [lineBoxes, setLineBoxes] = useState<MeasuredLineBox[]>([])

  const lines = useMemo(() => text.split('\n'), [text])
  const useExactMirror = lines.length <= MAX_EXACT_MIRROR_LINES

  const issueSeverityByLine = useMemo(() => {
    const map = new Map<number, 'error' | 'warning' | 'info'>()
    for (const issue of issues) {
      if (!issue.lineNumber) continue
      const prev = map.get(issue.lineNumber)
      if (!prev || issue.severity === 'error' || (issue.severity === 'warning' && prev === 'info')) {
        map.set(issue.lineNumber, issue.severity)
      }
    }
    return map
  }, [issues])

  const charStats = useMemo(() => {
    const nonBlank = text.replace(/\s/g, '').length
    return { nonBlank, total: text.length }
  }, [text])

  // Close bar popovers on outside click / Escape
  useEffect(() => {
    if (!openPopover) return
    const onDown = (e: MouseEvent) => {
      if (barPopoverRef.current && !barPopoverRef.current.contains(e.target as Node)) {
        setOpenPopover(null)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPopover(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openPopover])

  // Measure exact wrapped line offsets via hidden mirror
  const measureMirrorLines = useCallback(() => {
    const mirror = mirrorRef.current
    const ta = textareaRef.current
    if (!mirror || !ta || !useExactMirror) return

    mirror.style.width = `${ta.clientWidth}px`
    const children = mirror.children
    const next: MeasuredLineBox[] = []
    for (let i = 0; i < children.length; i++) {
      const el = children[i] as HTMLElement
      next.push({
        top: el.offsetTop,
        height: el.offsetHeight,
      })
    }
    setLineBoxes((prev) => {
      if (
        prev.length === next.length
        && prev.every((item, idx) => item.top === next[idx].top && item.height === next[idx].height)
      ) {
        return prev
      }
      return next
    })
  }, [useExactMirror])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return

    let frameId = window.requestAnimationFrame(() => {
      measureMirrorLines()
    })

    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        measureMirrorLines()
      })
    })
    observer.observe(ta)
    if (mirrorRef.current) {
      observer.observe(mirrorRef.current)
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [lines, measureMirrorLines])

  // Synchronize gutter & backdrop transform with textarea scrollTop without React re-renders
  const syncGutterScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const offset = `translateY(-${ta.scrollTop}px)`
    if (gutterInnerRef.current) {
      gutterInnerRef.current.style.transform = offset
    }
    if (backdropInnerRef.current) {
      backdropInnerRef.current.style.transform = offset
    }
  }, [])

  const updateCursorLine = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    const upto = ta.value.slice(0, ta.selectionStart)
    let count = 1
    for (let i = 0; i < upto.length; i++) {
      if (upto.charCodeAt(i) === 10) count++
    }
    setActiveLine(count)
  }, [])

  // Jump & flash target line when requested from A4 preview, Outline, or Checker
  useEffect(() => {
    if (!jumpRequest) return
    const ta = textareaRef.current
    if (!ta) return

    const targetLine = Math.max(1, Math.min(lines.length, jumpRequest.lineNumber))
    let charStart = 0
    for (let i = 0; i < targetLine - 1; i++) {
      charStart += lines[i].length + 1
    }

    const box = lineBoxes[targetLine - 1]
    const lineTop = box
      ? box.top
      : EDITOR_TOP_PADDING_PX + (targetLine - 1) * FALLBACK_LINE_HEIGHT_PX

    const targetScroll = Math.max(0, lineTop - ta.clientHeight * 0.32)
    ta.scrollTo({ top: targetScroll, behavior: 'smooth' })
    ta.focus({ preventScroll: true })
    ta.setSelectionRange(charStart, charStart)

    const rafId = window.requestAnimationFrame(() => {
      setActiveLine(targetLine)
      setFlashedLine(targetLine)
    })

    const clearTimer = window.setTimeout(() => {
      setFlashedLine((curr) => (curr === targetLine ? null : curr))
    }, 1550)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(clearTimer)
    }
  }, [jumpRequest, lineBoxes, lines])

  const handleSelectLineFromGutter = (lineNumber: number) => {
    const ta = textareaRef.current
    if (!ta) return
    let charStart = 0
    for (let i = 0; i < lineNumber - 1; i++) {
      charStart += lines[i].length + 1
    }
    const charEnd = charStart + (lines[lineNumber - 1]?.length ?? 0)
    ta.focus({ preventScroll: true })
    ta.setSelectionRange(charStart, charEnd)
    setActiveLine(lineNumber)
  }

  const handleCopy = async () => {
    const ok = await onCopySanitized()
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const isEmpty = text.trim().length === 0
  const flashBox =
    flashedLine !== null
      ? lineBoxes[flashedLine - 1] ?? {
          top: EDITOR_TOP_PADDING_PX + (flashedLine - 1) * FALLBACK_LINE_HEIGHT_PX,
          height: FALLBACK_LINE_HEIGHT_PX,
        }
      : null

  return (
    <section className="cb-editor-pane cb-no-print" aria-label="公文原稿编辑区">
      {/* Editorial Action Bar */}
      <div className="cb-editor-bar" ref={barPopoverRef}>
        <div className="cb-editor-bar-left">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.txt"
            className="cb-sr-only"
            onChange={(e) => {
              onImportFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="cb-bar-btn"
            title="导入本地 .docx 或 .txt 公文原稿（也支持直接拖拽至窗口）"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon size={13.5} />
            <span>导入文稿</span>
          </button>

          <div className="cb-popover-anchor">
            <button
              type="button"
              className={`cb-bar-btn${openPopover === 'samples' ? ' is-open' : ''}`}
              aria-expanded={openPopover === 'samples'}
              onClick={() =>
                setOpenPopover((prev) => (prev === 'samples' ? null : 'samples'))
              }
            >
              <FileDocIcon size={13.5} />
              <span>标准范文</span>
              <ChevronDownIcon size={12} />
            </button>

            {openPopover === 'samples' && (
              <div className="cb-popover cb-popover--left cb-popover--samples" role="dialog" aria-label="载入标准范文">
                <div className="cb-popover-section-label">载入范文并自动匹配对应国标版式</div>
                <div className="cb-menu-list">
                  {samples.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      className="cb-menu-item"
                      onClick={() => {
                        onLoadSample(sample)
                        setOpenPopover(null)
                      }}
                    >
                      <div className="cb-menu-item-main">
                        <span className="cb-menu-item-title">{sample.label}</span>
                        <span className="cb-menu-item-sub">{sample.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="cb-editor-bar-right">
          {/* Sanitize Pill & Popover */}
          <div className="cb-popover-anchor">
            <button
              type="button"
              className={`cb-bar-btn cb-tabular${
                sanitizeConfig.enabled && sanitizeResult.count > 0 ? ' is-tinted' : ''
              }${openPopover === 'sanitize' ? ' is-open' : ''}`}
              aria-expanded={openPopover === 'sanitize'}
              onClick={() =>
                setOpenPopover((prev) => (prev === 'sanitize' ? null : 'sanitize'))
              }
            >
              <SparkCleanIcon size={13.5} />
              <span>
                {!sanitizeConfig.enabled
                  ? '净化已关'
                  : sanitizeResult.count > 0
                    ? `已净化 ${sanitizeResult.count} 处`
                    : '标点净化'}
              </span>
            </button>

            {openPopover === 'sanitize' && (
              <div className="cb-popover cb-popover--right cb-popover--sanitize" role="dialog" aria-label="标点与空白净化设置">
                <div className="cb-popover-head">
                  <span className="cb-popover-title">实时标点与空白净化</span>
                </div>
                <div className="cb-sanitize-popover-body">
                  <SwitchField
                    label="启用实时自动净化"
                    description="预览与导出时自动转为全角中文标点，保护网址、时间与小数"
                    checked={sanitizeConfig.enabled}
                    onChange={(enabled) => onUpdateSanitize({ enabled })}
                  />
                  {sanitizeConfig.enabled && (
                    <div className="cb-sanitize-sublist">
                      <SwitchField
                        label="半角标点转全角（，。：；！？）"
                        checked={sanitizeConfig.convertPunctuation}
                        onChange={(convertPunctuation) =>
                          onUpdateSanitize({ convertPunctuation })
                        }
                      />
                      <SwitchField
                        label="直引号成对转中文弯引号（“ ”）"
                        checked={sanitizeConfig.convertQuotes}
                        onChange={(convertQuotes) => onUpdateSanitize({ convertQuotes })}
                      />
                      <SwitchField
                        label="清理行首尾空格与多余连续空行"
                        checked={sanitizeConfig.cleanWhitespace}
                        onChange={(cleanWhitespace) =>
                          onUpdateSanitize({ cleanWhitespace })
                        }
                      />
                      <SwitchField
                        label="发文字号括号自动转六角括号〔〕"
                        checked={sanitizeConfig.normalizeDocNumberBrackets}
                        onChange={(normalizeDocNumberBrackets) =>
                          onUpdateSanitize({ normalizeDocNumberBrackets })
                        }
                      />
                    </div>
                  )}

                  {sanitizeConfig.enabled && sanitizeResult.count > 0 && (
                    <div className="cb-sanitize-summary cb-tabular">
                      <span>
                        标点 {sanitizeResult.details.punctuation} · 引号{' '}
                        {sanitizeResult.details.quotes} · 空白{' '}
                        {sanitizeResult.details.whitespace}
                      </span>
                      <button
                        type="button"
                        className="cb-btn-inline-primary"
                        onClick={() => {
                          onCommitSanitizedToRaw()
                          setOpenPopover(null)
                        }}
                      >
                        写回原文
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="cb-bar-btn"
            disabled={isEmpty}
            title="复制净化后的纯文本到剪贴板"
            onClick={handleCopy}
          >
            {copied ? <CheckIcon size={13.5} /> : <CopyIcon size={13.5} />}
            <span>{copied ? '已复制' : '复制净稿'}</span>
          </button>

          <button
            type="button"
            className="cb-bar-btn cb-bar-btn--muted"
            disabled={isEmpty}
            title="清空当前文稿（可一键撤销）"
            onClick={onClearText}
          >
            <TrashIcon size={13.5} />
            <span>清空</span>
          </button>
        </div>
      </div>

      {/* Synchronized Gutter + Manuscript Textarea */}
      <div className="cb-editor-surface">
        {/* Line Numbers Gutter */}
        <div className="cb-gutter" aria-hidden="true">
          <div ref={gutterInnerRef} className="cb-gutter-inner cb-tabular">
            {flashBox && (
              <div
                className="cb-gutter-flash"
                style={{ top: `${flashBox.top}px`, height: `${flashBox.height}px` }}
              />
            )}
            {lines.map((_, idx) => {
              const lineNum = idx + 1
              const box = lineBoxes[idx]
              const top = box
                ? box.top
                : EDITOR_TOP_PADDING_PX + idx * FALLBACK_LINE_HEIGHT_PX
              const height = box ? box.height : FALLBACK_LINE_HEIGHT_PX
              const isCurrent = lineNum === activeLine
              const hasOverride = Boolean(overrides[lineNum])
              const severity = issueSeverityByLine.get(lineNum)

              return (
                <div
                  key={lineNum}
                  className={`cb-gutter-num${isCurrent ? ' is-active' : ''}`}
                  style={{ top: `${top}px`, height: `${height}px` }}
                  onClick={() => handleSelectLineFromGutter(lineNum)}
                >
                  {severity ? (
                    <span className={`cb-gutter-dot cb-gutter-dot--${severity}`} />
                  ) : hasOverride ? (
                    <span className="cb-gutter-dot cb-gutter-dot--override" />
                  ) : null}
                  <span>{lineNum}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Textarea + Synchronized Highlight Backdrop + Hidden Line Mirror */}
        <div className="cb-textarea-wrap">
          <div className="cb-textarea-backdrop" aria-hidden="true">
            <div ref={backdropInnerRef} className="cb-textarea-backdrop-inner">
              {flashBox && (
                <div
                  className="cb-line-highlight-band"
                  style={{ top: `${flashBox.top}px`, height: `${flashBox.height}px` }}
                />
              )}
            </div>
          </div>

          {useExactMirror && (
            <div ref={mirrorRef} className="cb-editor-mirror" aria-hidden="true">
              {lines.map((line, idx) => (
                <div key={idx} className="cb-editor-mirror-line">
                  {line || '\u200B'}
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="cb-textarea"
            value={text}
            spellCheck={false}
            placeholder={
              '在此输入或粘贴公文纯文本…\n首行自动识别为公文标题，「一、」「（一）」「1.」「（1）」自动识别为四级标题。'
            }
            onChange={(e) => onChangeText(e.target.value)}
            onScroll={syncGutterScroll}
            onSelect={updateCursorLine}
            onKeyUp={updateCursorLine}
            onClick={updateCursorLine}
          />

          {/* Welcoming Empty-State Quick Start Card (non-blocking bottomdock inside empty editor) */}
          {isEmpty && (
            <div className="cb-empty-starter">
              <div className="cb-empty-starter-head">
                <div>
                  <div className="cb-empty-starter-title">开始起草，或一键载入标准公文范例</div>
                  <div className="cb-empty-starter-sub">
                    粘贴纯文本或拖入 <code>.docx</code> / <code>.txt</code> 文件，右侧即刻生成符合 GB/T 9704—2012 的 22×28 字格红头公文
                  </div>
                </div>
                <button
                  type="button"
                  className="cb-empty-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon size={14} />
                  <span>选择文件导入</span>
                </button>
              </div>
              <div className="cb-empty-sample-grid">
                {samples.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className="cb-empty-sample-card"
                    onClick={() => onLoadSample(sample)}
                  >
                    <span className="cb-empty-sample-name">{sample.label}</span>
                    <span className="cb-empty-sample-desc">{sample.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Telemetry Strip */}
      <footer className="cb-editor-foot cb-tabular">
        <div className="cb-editor-foot-left">
          <span>行 {activeLine} / {lines.length}</span>
          <span className="cb-foot-dot">·</span>
          <span>正文 {charStats.nonBlank.toLocaleString()} 字</span>
          <span className="cb-foot-dot">·</span>
          <span>{paragraphCount} 段</span>
        </div>
        <div className="cb-editor-foot-right">
          {Object.keys(overrides).length > 0 && (
            <span className="cb-foot-tag">手动指定 {Object.keys(overrides).length} 处</span>
          )}
          <span>共 {pageCount} 页 A4</span>
        </div>
      </footer>
    </section>
  )
}
