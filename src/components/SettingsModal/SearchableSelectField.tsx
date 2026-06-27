import { useEffect, useRef, type ChangeEvent, type MouseEvent } from 'react'
import { useComboBox } from './useComboBox'

export interface SearchableSelectItem {
  key: string
  label: string
  value: string
  selected?: boolean
  removeButtonTitle?: string
  onRemove?: (event: MouseEvent<HTMLButtonElement>) => void
}

export interface SearchableSelectSection {
  title?: string
  items: SearchableSelectItem[]
  showDividerAfter?: boolean
}

interface SearchableSelectFieldProps {
  label: string
  closedValue: string
  openValue: string
  placeholder?: string
  sections: SearchableSelectSection[]
  emptyHint?: string
  onCommit: () => void
  onInputChange: (value: string) => void
  onSelect: (value: string) => void
  onEscape?: () => void
  onOpen?: () => void
}

export function SearchableSelectField({
  label,
  closedValue,
  openValue,
  placeholder,
  sections,
  emptyHint,
  onCommit,
  onInputChange,
  onSelect,
  onEscape,
  onOpen,
}: SearchableSelectFieldProps) {
  const pendingBlurRef = useRef(false)
  const flatItems = sections.flatMap((section) => section.items)
  const itemIndexes = new Map(flatItems.map((item, index) => [item.key, index]))
  const itemCount = flatItems.length
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
    itemCount,
    onOpen,
    onCommit,
    onSelect: (index) => handleSelect(flatItems[index]?.value),
    onEscape,
  })

  useEffect(() => {
    if (!pendingBlurRef.current || open) return

    inputRef.current?.blur()
    pendingBlurRef.current = false
  }, [inputRef, open])

  function handleSelect(value?: string) {
    if (!value) return

    onSelect(value)
    closeDropdown()
    pendingBlurRef.current = true
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    onInputChange(event.target.value)
    setActiveIdx(-1)
    if (!open) setOpen(true)
  }

  const displayValue = open ? openValue : closedValue
  const showEmptyHint = itemCount === 0 && open && emptyHint

  return (
    <label className="settings-field" onClick={(event) => event.preventDefault()}>
      <span className="settings-field-label">{label}</span>
      <div className="settings-control-row">
        <div className="font-combo settings-field-main" ref={wrapRef}>
          <div
            className="font-combo-input-wrap"
            onMouseDown={handleWrapMouseDown}
            onClick={handleWrapClick}
          >
            <input
              ref={inputRef}
              className="settings-select font-combo-input"
              type="text"
              value={displayValue}
              placeholder={placeholder}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <span className={`font-combo-arrow ${open ? 'font-combo-arrow--open' : ''}`} />
          </div>

          {open && (
            <div className="font-combo-dropdown">
              {sections.map((section, sectionIndex) => (
                <div key={`section-${section.title ?? sectionIndex}`}>
                  {section.title && (
                    <div className="font-combo-group-title">{section.title}</div>
                  )}
                  {section.items.map((item) => {
                    const currentIndex = itemIndexes.get(item.key) ?? -1

                    return (
                      <div
                        key={item.key}
                        className={`font-combo-item ${item.selected ? 'font-combo-item--selected' : ''} ${currentIndex === activeIdx ? 'font-combo-item--active' : ''}`}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          handleSelect(item.value)
                        }}
                        onMouseEnter={() => setActiveIdx(currentIndex)}
                      >
                        <span className="font-combo-item-text">{item.label}</span>
                        {item.onRemove && (
                          <button
                            className="font-combo-item-remove"
                            onMouseDown={(event) => {
                              event.preventDefault()
                              event.stopPropagation()
                              item.onRemove?.(event)
                            }}
                            title={item.removeButtonTitle ?? '删除'}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {section.showDividerAfter && <div className="font-combo-divider" />}
                </div>
              ))}
              {showEmptyHint && (
                <div className="font-combo-hint">
                  {emptyHint}
                </div>
              )}
            </div>
          )}
        </div>
        <span className="settings-unit settings-unit--placeholder" aria-hidden="true" />
      </div>
    </label>
  )
}
