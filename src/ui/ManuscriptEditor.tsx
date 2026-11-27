import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { SampleDocument } from '../utils/sampleDocuments'

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
  samples: SampleDocument[]
  onLoadSample: (sample: SampleDocument) => void
  pageCount: number
  jumpRequest: LineJumpRequest | null
}

const MAX_EXACT_MIRROR_LINES = 1600
const FALLBACK_LINE_HEIGHT_PX = 25.5
const EDITOR_TOP_PADDING_PX = 24

const SHORT_SAMPLE_LABELS: Record<string, string> = {
  'sample-standard': '红头通知',
  'sample-upward': '上行请示',
  'sample-letter': '机关信函',
  'sample-minutes': '会议纪要',
}

export function ManuscriptEditor({
  text,
  onChangeText,
  samples,
  onLoadSample,
  pageCount,
  jumpRequest,
}: ManuscriptEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const backdropInnerRef = useRef<HTMLDivElement | null>(null)
  const mirrorRef = useRef<HTMLDivElement | null>(null)

  const [flashedLine, setFlashedLine] = useState<number | null>(null)
  const [lineBoxes, setLineBoxes] = useState<MeasuredLineBox[]>([])

  const lines = useMemo(() => text.split('\n'), [text])
  const useExactMirror = lines.length <= MAX_EXACT_MIRROR_LINES

  const charCount = useMemo(() => text.replace(/\s/g, '').length, [text])

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

  // Synchronize backdrop transform with textarea scrollTop without React re-renders
  const syncBackdropScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta || !backdropInnerRef.current) return
    backdropInnerRef.current.style.transform = `translateY(-${ta.scrollTop}px)`
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
            '在此输入、粘贴公文纯文本，或拖入 .docx / .txt 文件…\n首行自动识别为公文标题，「一、」「（一）」「1.」「（1）」自动识别为四级标题。'
          }
          onChange={(e) => onChangeText(e.target.value)}
          onScroll={syncBackdropScroll}
        />

        {isEmpty && (
          <div className="cb-empty-inline-samples">
            <span className="cb-empty-inline-label">一键试排：</span>
            {samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="cb-empty-inline-link"
                title={sample.description}
                onClick={() => onLoadSample(sample)}
              >
                {SHORT_SAMPLE_LABELS[sample.id] ?? sample.label}
              </button>
            ))}
          </div>
        )}

        <div className="cb-editor-corner-meta cb-tabular" aria-live="polite">
          {charCount.toLocaleString()} 字 · {pageCount} 页
        </div>
      </div>
    </section>
  )
}
