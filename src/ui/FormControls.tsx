import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon, CloseIcon, MinusIcon, PlusIcon } from './icons'

/* ---- Tactile Toggle Switch ---- */
interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

export function SwitchField({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchProps) {
  const id = useId()

  if (!label) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`cb-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="cb-switch-thumb" />
      </button>
    )
  }

  return (
    <div className="cb-switch-row">
      <div className="cb-switch-copy">
        <label htmlFor={id} className="cb-switch-label">
          {label}
        </label>
        {description && <div className="cb-switch-desc">{description}</div>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`cb-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="cb-switch-thumb" />
      </button>
    </div>
  )
}

/* ---- Animated Segmented Control ---- */
export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
  size?: 'sm' | 'md'
  fullWidth?: boolean
  ariaLabel?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const count = Math.max(1, options.length)

  return (
    <div
      className={`cb-seg cb-seg--${size}${fullWidth ? ' is-full' : ''}`}
      role="tablist"
      aria-label={ariaLabel}
      style={
        {
          '--seg-count': count,
          '--seg-index': activeIndex,
        } as React.CSSProperties
      }
    >
      <span className="cb-seg-thumb" aria-hidden="true" />
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.title}
            className={`cb-seg-btn${active ? ' is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---- Precision Numeric Stepper ---- */
interface NumberStepperProps {
  value: number
  onChange: (next: number) => void
  min: number
  max: number
  step?: number
  unit?: string
  ariaLabel?: string
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  ariaLabel,
}: NumberStepperProps) {
  const clampRound = (raw: number) => {
    const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0
    const bounded = Math.min(max, Math.max(min, raw))
    return Number(bounded.toFixed(decimals))
  }

  return (
    <div className="cb-stepper cb-tabular">
      <button
        type="button"
        className="cb-stepper-btn"
        aria-label="减小数值"
        disabled={value <= min}
        onClick={() => onChange(clampRound(value - step))}
      >
        <MinusIcon size={13} />
      </button>
      <div className="cb-stepper-input-wrap">
        <input
          type="number"
          className="cb-stepper-input cb-tabular"
          aria-label={ariaLabel}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value)
            if (Number.isFinite(parsed)) {
              onChange(clampRound(parsed))
            }
          }}
        />
        {unit && <span className="cb-stepper-unit">{unit}</span>}
      </div>
      <button
        type="button"
        className="cb-stepper-btn"
        aria-label="增大数值"
        disabled={value >= max}
        onClick={() => onChange(clampRound(value + step))}
      >
        <PlusIcon size={13} />
      </button>
    </div>
  )
}

/* ---- Smooth Collapsible Studio Section ---- */
interface CollapsibleSectionProps {
  title: string
  meta?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  title,
  meta,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`cb-section${open ? ' is-open' : ''}`}>
      <div className="cb-section-head">
        <button
          type="button"
          className="cb-section-trigger"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <ChevronDownIcon
            size={14}
            className={`cb-section-chevron${open ? ' is-open' : ''}`}
          />
          <span className="cb-section-title">{title}</span>
        </button>
        {meta && <div className="cb-section-meta">{meta}</div>}
      </div>
      <div className="cb-section-grid">
        <div className="cb-section-inner">{children}</div>
      </div>
    </section>
  )
}

/* ---- Clean Native-Enhanced Select ---- */
interface SelectFieldProps {
  value: string | number
  onChange: (value: string) => void
  options: { label: string; value: string | number }[]
  ariaLabel?: string
}

export function SelectField({
  value,
  onChange,
  options,
  ariaLabel,
}: SelectFieldProps) {
  const hasCurrent = options.some((opt) => String(opt.value) === String(value))

  return (
    <div className="cb-select-wrap">
      <select
        className="cb-select cb-tabular"
        aria-label={ariaLabel}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {!hasCurrent && value !== '' && (
          <option value={String(value)}>{String(value)}（自定义）</option>
        )}
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={13} className="cb-select-chevron" />
    </div>
  )
}

/* ---- Editable + Selectable Font Combobox ---- */
export interface FontComboFieldProps {
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  customFonts: string[]
  onAddCustomFont: (name: string) => void
  onRemoveCustomFont: (name: string) => void
  ariaLabel?: string
  placeholder?: string
  allowEmpty?: boolean
}

interface DropdownPos {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

type ComboItem =
  | { kind: 'custom'; value: string; label: string }
  | { kind: 'builtin'; value: string; label: string }
  | { kind: 'create'; value: string; label: string }

export function FontComboField({
  value,
  onChange,
  options,
  customFonts,
  onAddCustomFont,
  onRemoveCustomFont,
  ariaLabel,
  placeholder,
  allowEmpty = false,
}: FontComboFieldProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [hasTyped, setHasTyped] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [menuPos, setMenuPos] = useState<DropdownPos | null>(null)

  const builtinValues = new Set(options.map((opt) => opt.value))
  const uniqueCustom = customFonts.filter((font) => !builtinValues.has(font))

  const trimmedDraft = draft.trim()
  const query = hasTyped ? trimmedDraft.toLowerCase() : ''

  const filteredCustom = query
    ? uniqueCustom.filter((font) => font.toLowerCase().includes(query))
    : uniqueCustom

  const filteredBuiltin = query
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query)
          || opt.value.toLowerCase().includes(query),
      )
    : options

  const exactMatch =
    trimmedDraft !== ''
    && (builtinValues.has(trimmedDraft)
      || uniqueCustom.includes(trimmedDraft)
      || options.some((opt) => opt.label === trimmedDraft))

  const showCreateOption = hasTyped && trimmedDraft !== '' && !exactMatch

  const flatItems: ComboItem[] = [
    ...filteredCustom.map((font) => ({
      kind: 'custom' as const,
      value: font,
      label: font,
    })),
    ...filteredBuiltin.map((opt) => ({
      kind: 'builtin' as const,
      value: opt.value,
      label: opt.label,
    })),
    ...(showCreateOption
      ? [{ kind: 'create' as const, value: trimmedDraft, label: trimmedDraft }]
      : []),
  ]

  const computeMenuPos = useCallback((): DropdownPos | null => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return null
    const viewportW = window.innerWidth
    const viewportH = window.visualViewport?.height ?? window.innerHeight
    const width = Math.min(Math.max(rect.width, 196), viewportW - 16)
    const left = Math.max(8, Math.min(rect.left, viewportW - width - 8))
    const spaceBelow = viewportH - rect.bottom - 10
    const spaceAbove = rect.top - 10

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      return {
        left,
        width,
        bottom: window.innerHeight - rect.top + 4,
        maxHeight: Math.min(240, Math.max(120, spaceAbove - 4)),
      }
    }

    return {
      left,
      width,
      top: rect.bottom + 4,
      maxHeight: Math.min(240, Math.max(120, spaceBelow)),
    }
  }, [])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setHasTyped(false)
    setActiveIdx(-1)
  }, [])

  const openMenu = useCallback(() => {
    setDraft(value)
    setHasTyped(false)
    setActiveIdx(-1)
    setMenuPos(computeMenuPos())
    setOpen(true)
  }, [computeMenuPos, value])

  const commitDraft = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      if (allowEmpty && value !== '') {
        onChange('')
      }
    } else {
      const isBuiltin = options.some((opt) => opt.value === trimmed)
      if (!isBuiltin && !customFonts.includes(trimmed)) {
        onAddCustomFont(trimmed)
      }
      if (trimmed !== value) {
        onChange(trimmed)
      }
    }
    closeMenu()
  }, [allowEmpty, closeMenu, customFonts, draft, onAddCustomFont, onChange, options, value])

  const selectItem = useCallback(
    (item: ComboItem) => {
      const isBuiltin = options.some((opt) => opt.value === item.value)
      if (item.kind === 'create' && !isBuiltin && !customFonts.includes(item.value)) {
        onAddCustomFont(item.value)
      }
      if (item.value !== value) {
        onChange(item.value)
      }
      closeMenu()
      inputRef.current?.blur()
    },
    [closeMenu, customFonts, onAddCustomFont, onChange, options, value],
  )

  useEffect(() => {
    if (!open) return

    const updatePos = () => {
      const next = computeMenuPos()
      if (next) setMenuPos(next)
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      commitDraft()
    }

    updatePos()
    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    window.visualViewport?.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
      window.visualViewport?.removeEventListener('resize', updatePos)
    }
  }, [commitDraft, computeMenuPos, open])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openMenu()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (flatItems.length > 0) {
          setActiveIdx((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (flatItems.length > 0) {
          setActiveIdx((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
        }
        break
      case 'Enter':
        e.preventDefault()
        if (activeIdx >= 0 && activeIdx < flatItems.length) {
          selectItem(flatItems[activeIdx])
        } else {
          commitDraft()
          inputRef.current?.blur()
        }
        break
      case 'Escape':
        e.preventDefault()
        setDraft(value)
        closeMenu()
        inputRef.current?.blur()
        break
      case 'Tab':
        commitDraft()
        break
    }
  }

  return (
    <div className="cb-font-combo" ref={wrapRef}>
      <input
        ref={inputRef}
        type="text"
        className="cb-font-combo-input"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        placeholder={placeholder ?? (allowEmpty ? '跟随中文字体' : '输入或选择字体')}
        value={open ? draft : value}
        onFocus={() => {
          if (!open) openMenu()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          setHasTyped(true)
          setActiveIdx(-1)
          if (!open) {
            setMenuPos(computeMenuPos())
            setOpen(true)
          }
        }}
        onKeyDown={handleKeyDown}
      />

      <button
        type="button"
        tabIndex={-1}
        className={`cb-font-combo-toggle${open ? ' is-open' : ''}`}
        aria-label="展开字体列表"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) {
            commitDraft()
          } else {
            openMenu()
            inputRef.current?.focus()
          }
        }}
      >
        <ChevronDownIcon size={13} />
      </button>

      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="cb-font-combo-menu"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            left: `${menuPos.left}px`,
            width: `${menuPos.width}px`,
            maxHeight: `${menuPos.maxHeight}px`,
            ...(menuPos.top !== undefined
              ? { top: `${menuPos.top}px` }
              : { bottom: `${menuPos.bottom}px` }),
          }}
        >
          {filteredCustom.length > 0 && (
            <>
              <div className="cb-font-combo-section">自定义字体</div>
              {filteredCustom.map((font) => {
                const idx = flatItems.findIndex(
                  (item) => item.kind === 'custom' && item.value === font,
                )
                const selected = value === font
                return (
                  <div
                    key={`custom-${font}`}
                    role="option"
                    aria-selected={selected}
                    className={`cb-font-combo-item${selected ? ' is-selected' : ''}${idx === activeIdx ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() =>
                      selectItem({ kind: 'custom', value: font, label: font })
                    }
                  >
                    <span className="cb-font-combo-item-label">{font}</span>
                    <button
                      type="button"
                      className="cb-font-combo-del"
                      aria-label={`移除自定义字体 ${font}`}
                      title="移除"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveCustomFont(font)
                      }}
                    >
                      <CloseIcon size={11} />
                    </button>
                  </div>
                )
              })}
            </>
          )}

          {filteredBuiltin.length > 0 && (
            <>
              {filteredCustom.length > 0 && <div className="cb-font-combo-divider" />}
              {filteredBuiltin.map((opt) => {
                const idx = flatItems.findIndex(
                  (item) => item.kind === 'builtin' && item.value === opt.value,
                )
                const selected = value === opt.value
                return (
                  <div
                    key={`builtin-${opt.value || '__empty__'}`}
                    role="option"
                    aria-selected={selected}
                    className={`cb-font-combo-item${selected ? ' is-selected' : ''}${idx === activeIdx ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() =>
                      selectItem({ kind: 'builtin', value: opt.value, label: opt.label })
                    }
                  >
                    <span className="cb-font-combo-item-label">{opt.label}</span>
                    {selected && <CheckIcon size={13} className="cb-menu-check" />}
                  </div>
                )
              })}
            </>
          )}

          {showCreateOption && (
            <>
              {(filteredCustom.length > 0 || filteredBuiltin.length > 0) && (
                <div className="cb-font-combo-divider" />
              )}
              {(() => {
                const idx = flatItems.findIndex((item) => item.kind === 'create')
                return (
                  <div
                    role="option"
                    aria-selected={false}
                    className={`cb-font-combo-item cb-font-combo-item--create${idx === activeIdx ? ' is-active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() =>
                      selectItem({
                        kind: 'create',
                        value: trimmedDraft,
                        label: trimmedDraft,
                      })
                    }
                  >
                    <PlusIcon size={12.5} />
                    <span className="cb-font-combo-item-label">
                      使用自定义字体「{trimmedDraft}」
                    </span>
                  </div>
                )
              })()}
            </>
          )}

          {flatItems.length === 0 && (
            <div className="cb-font-combo-empty">输入任意系统字体名按回车生效</div>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
