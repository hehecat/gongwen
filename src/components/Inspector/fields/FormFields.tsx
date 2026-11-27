import { useState, type ChangeEvent, type ReactNode } from 'react'
import { formatFontSizeLabel } from '../../../types/documentConfig'
import { useComboBox } from './useComboBox'

export function SelectField({
  label,
  unit,
  value,
  options,
  onChange,
}: {
  label: string
  unit?: string
  value: string | number
  options: { label: string; value: string | number }[]
  onChange: (val: string) => void
}) {
  return (
    <label className="insp-field">
      <span className="insp-field-label">{label}</span>
      <div className="insp-control-row">
        <div className="insp-select-wrap">
          <select
            className="insp-select"
            value={value}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={`${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="insp-combo-arrow" />
        </div>
        {unit && <span className="insp-unit">{unit}</span>}
      </div>
    </label>
  )
}

export function NumberField({
  label,
  value,
  step = 0.1,
  min = 0,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  unit?: string
  onChange: (val: number) => void
}) {
  return (
    <label className="insp-field">
      <span className="insp-field-label">{label}</span>
      <div className="insp-control-row">
        <input
          className="insp-input"
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        />
        {unit && <span className="insp-unit">{unit}</span>}
      </div>
    </label>
  )
}

export function NumberInputField({
  label,
  value,
  min,
  max,
  unit,
  options,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  options: { label: string; value: number }[]
  onChange: (val: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const filterText = draft.trim()
  const validOptions = options.filter((opt) => opt.value >= min && opt.value <= max)
  const filteredOptions = filterText.length > 0
    ? validOptions.filter((opt) => opt.label.includes(filterText) || String(opt.value).includes(filterText))
    : validOptions
  const selectedOption = options.find((opt) => opt.value === value)

  const {
    activeIdx,
    closeDropdown,
    handleFocus,
    handleKeyDown,
    handleWrapClick,
    handleWrapMouseDown,
    inputRef,
    open,
    setActiveIdx,
    setOpen,
    wrapRef,
  } = useComboBox({
    blurOnCommit: true,
    blurOnEscape: true,
    itemCount: filteredOptions.length,
    onOpen: () => setDraft(String(value)),
    onCommit: () => commit(),
    onSelect: (index) => handleSelect(filteredOptions[index].value),
    onEscape: () => setDraft(String(value)),
  })

  const noResults = open && filterText.length > 0 && filteredOptions.length === 0
  const displayValue = open
    ? draft
    : selectedOption?.label ?? (unit === 'pt' ? formatFontSizeLabel(value) : String(value))

  function parseNumber(raw: string): number | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const num = Number(trimmed)
    if (!Number.isFinite(num) || num < min || num > max) return null
    return num
  }

  function commit(nextValue?: string) {
    const num = parseNumber(nextValue ?? draft)
    if (num === null) {
      setDraft(String(value))
      return
    }
    onChange(num)
    setDraft(String(num))
  }

  function handleSelect(nextValue: number) {
    if (parseNumber(String(nextValue)) === null) {
      setDraft(String(value))
      closeDropdown()
      inputRef.current?.blur()
      return
    }
    onChange(nextValue)
    setDraft(String(nextValue))
    closeDropdown()
    inputRef.current?.blur()
  }

  return (
    <label className="insp-field">
      <span className="insp-field-label">{label}</span>
      <div className="insp-control-row">
        <div className="insp-combo insp-field-main" ref={wrapRef}>
          <div
            className="insp-combo-input-wrap"
            onMouseDown={handleWrapMouseDown}
            onClick={handleWrapClick}
          >
            <input
              ref={inputRef}
              className="insp-input insp-combo-input"
              type="text"
              inputMode="decimal"
              value={displayValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setDraft(e.target.value)
                setActiveIdx(-1)
                if (!open) setOpen(true)
              }}
              onFocus={handleFocus}
              onBlur={() => {
                commit()
                closeDropdown()
              }}
              onKeyDown={handleKeyDown}
            />
            <span className={`insp-combo-arrow ${open ? 'insp-combo-arrow--open' : ''}`} />
          </div>
          {open && (
            <div className="insp-combo-dropdown">
              {filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  className={`insp-combo-item ${value === opt.value ? 'insp-combo-item--selected' : ''} ${idx === activeIdx ? 'insp-combo-item--active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <span className="insp-combo-item-text">{opt.label}</span>
                </div>
              ))}
              {noResults && <div className="insp-combo-hint">无匹配项，回车生效</div>}
            </div>
          )}
        </div>
        {unit && <span className="insp-unit">{unit}</span>}
      </div>
    </label>
  )
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: ReactNode
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <label className="insp-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

export function TextField({
  label,
  value,
  placeholder,
  onChange,
  action,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (val: string) => void
  action?: ReactNode
}) {
  return (
    <label className="insp-field">
      <div className="insp-field-label-row">
        <span className="insp-field-label">{label}</span>
        {action}
      </div>
      <input
        type="text"
        className="insp-input"
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </label>
  )
}

export function SwitchPill({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`insp-switch ${checked ? 'insp-switch--on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <span className="insp-switch-thumb" />
    </button>
  )
}

export function AccordionCard({
  title,
  expanded,
  onToggle,
  headerAction,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  headerAction?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="insp-acc">
      <div className={`insp-acc-header ${expanded ? 'insp-acc-header--open' : ''}`}>
        <button
          type="button"
          className="insp-acc-trigger"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <span className={`insp-acc-chevron ${expanded ? 'insp-acc-chevron--open' : ''}`} aria-hidden="true">
            ▸
          </span>
          <span className="insp-acc-title">{title}</span>
        </button>
        {headerAction && (
          <div className="insp-acc-action">
            {headerAction}
          </div>
        )}
      </div>

      {expanded && <div className="insp-acc-body">{children}</div>}
    </section>
  )
}

