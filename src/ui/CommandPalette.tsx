import { useEffect, useMemo, useRef, useState } from 'react'
import { SearchCommandIcon } from './icons'

export interface CommandItem {
  id: string
  group: string
  label: string
  hint?: string
  keywords?: string
  onRun: () => void
}

interface CommandPaletteProps {
  commands: CommandItem[]
  onClose: () => void
}

export function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q)
        || cmd.group.toLowerCase().includes(q)
        || (cmd.keywords?.toLowerCase().includes(q) ?? false),
    )
  }, [commands, query])

  const activeIdx = Math.min(selectedIndex, Math.max(0, filtered.length - 1))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0,
      )
      return
    }
    if (e.key === 'Enter' && filtered[activeIdx]) {
      e.preventDefault()
      const target = filtered[activeIdx]
      onClose()
      target.onRun()
    }
  }

  return (
    <div
      className="cb-modal-backdrop cb-no-print"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cb-cmd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="快捷命令面板"
        onKeyDown={handleKeyDown}
      >
        <div className="cb-cmd-search">
          <SearchCommandIcon size={15} className="cb-cmd-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="cb-cmd-input"
            placeholder="搜索操作、版式预设、标准范文或排版指令…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
          />
          <kbd className="cb-kbd">ESC</kbd>
        </div>

        <div className="cb-cmd-list">
          {filtered.length === 0 ? (
            <div className="cb-cmd-empty">未找到匹配的指令</div>
          ) : (
            filtered.map((item, idx) => {
              const selected = idx === activeIdx
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`cb-cmd-item${selected ? ' is-selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => {
                    onClose()
                    item.onRun()
                  }}
                >
                  <div className="cb-cmd-item-left">
                    <span className="cb-cmd-group">{item.group}</span>
                    <span className="cb-cmd-label">{item.label}</span>
                  </div>
                  {item.hint && <span className="cb-cmd-hint">{item.hint}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
