import { useId, useState, type ReactNode } from 'react'
import { ChevronDownIcon, MinusIcon, PlusIcon } from './icons'

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
