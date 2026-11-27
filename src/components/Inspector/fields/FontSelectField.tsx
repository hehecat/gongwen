import { useState, type ChangeEvent, type MouseEvent } from 'react'
import { useComboBox } from './useComboBox'

interface FontOption {
  label: string
  value: string
}

interface FontSelectFieldProps {
  label: string
  value: string
  options: FontOption[]
  customFonts: string[]
  onChange: (val: string) => void
  onAddCustomFont: (name: string) => void
  onRemoveCustomFont: (name: string) => void
}

export function FontSelectField({
  label,
  value,
  options,
  customFonts,
  onChange,
  onAddCustomFont,
  onRemoveCustomFont,
}: FontSelectFieldProps) {
  const [filter, setFilter] = useState('')

  const builtinValues = new Set(options.map((o) => o.value))
  const uniqueCustom = customFonts.filter((f) => !builtinValues.has(f))

  const lowerFilter = filter.toLowerCase()
  const filteredBuiltin = lowerFilter
    ? options.filter((o) => o.label.toLowerCase().includes(lowerFilter))
    : options
  const filteredCustom = lowerFilter
    ? uniqueCustom.filter((f) => f.toLowerCase().includes(lowerFilter))
    : uniqueCustom

  const flatItems: { value: string; label: string; isCustom: boolean }[] = [
    ...filteredBuiltin.map((o) => ({ ...o, isCustom: false })),
    ...filteredCustom.map((f) => ({ value: f, label: f, isCustom: true })),
  ]

  function commitFilter() {
    const trimmed = filter.trim()
    if (trimmed && !builtinValues.has(trimmed) && trimmed !== value) {
      onAddCustomFont(trimmed)
      onChange(trimmed)
    }
    setFilter('')
  }

  function handleSelect(val: string) {
    onChange(val)
    setFilter('')
    closeDropdown()
    inputRef.current?.blur()
  }

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
    itemCount: flatItems.length,
    onOpen: () => setFilter(''),
    onCommit: commitFilter,
    onSelect: (index) => handleSelect(flatItems[index].value),
    onEscape: () => setFilter(''),
  })

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setFilter(e.target.value)
    setActiveIdx(-1)
    if (!open) setOpen(true)
  }

  function handleRemoveCustom(e: MouseEvent<HTMLButtonElement>, fontName: string) {
    e.stopPropagation()
    onRemoveCustomFont(fontName)
  }

  const displayValue = open ? filter : value
  const hasCustomSection = filteredCustom.length > 0
  const hasBuiltinSection = filteredBuiltin.length > 0
  const noResults = !hasBuiltinSection && !hasCustomSection && filter.length > 0

  return (
    <label className="insp-field" onClick={(e) => e.preventDefault()}>
      <span className="insp-field-label">{label}</span>
      <div className="insp-combo" ref={wrapRef}>
        <div
          className="insp-combo-input-wrap"
          onMouseDown={handleWrapMouseDown}
          onClick={handleWrapClick}
        >
          <input
            ref={inputRef}
            className="insp-input insp-combo-input"
            type="text"
            value={displayValue}
            placeholder={value || '选择或输入字体'}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <span className={`insp-combo-arrow ${open ? 'insp-combo-arrow--open' : ''}`} />
        </div>

        {open && (
          <div className="insp-combo-dropdown">
            {hasCustomSection && (
              <>
                <div className="insp-combo-group-title">自定义字体</div>
                {filteredCustom.map((f) => {
                  const idx = flatItems.findIndex((item) => item.isCustom && item.value === f)
                  return (
                    <div
                      key={`custom-${f}`}
                      className={`insp-combo-item ${value === f ? 'insp-combo-item--selected' : ''} ${idx === activeIdx ? 'insp-combo-item--active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(f) }}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="insp-combo-item-text">{f}</span>
                      <button
                        type="button"
                        className="insp-combo-item-remove"
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveCustom(e, f) }}
                        title="删除"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
                {hasBuiltinSection && <div className="insp-combo-divider" />}
              </>
            )}

            {hasBuiltinSection &&
              filteredBuiltin.map((opt) => {
                const idx = flatItems.findIndex((item) => !item.isCustom && item.value === opt.value)
                return (
                  <div
                    key={`builtin-${opt.value}`}
                    className={`insp-combo-item ${value === opt.value ? 'insp-combo-item--selected' : ''} ${idx === activeIdx ? 'insp-combo-item--active' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value) }}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className="insp-combo-item-text">{opt.label}</span>
                  </div>
                )
              })}

            {noResults && (
              <div className="insp-combo-hint">
                按 Enter 添加「{filter}」为自定义字体
              </div>
            )}
          </div>
        )}
      </div>
    </label>
  )
}
