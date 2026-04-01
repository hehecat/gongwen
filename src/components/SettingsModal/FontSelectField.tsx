import { useState, type ChangeEvent, type MouseEvent } from 'react'
import { useComboBox } from './useComboBox'

interface FontOption {
  label: string
  value: string
}

interface FontSelectFieldProps {
  label: string
  value: string
  /** 内置字体选项 */
  options: FontOption[]
  /** 用户自定义字体列表 */
  customFonts: string[]
  /** 值变化回调 */
  onChange: (val: string) => void
  /** 新增自定义字体 */
  onAddCustomFont: (name: string) => void
  /** 删除自定义字体 */
  onRemoveCustomFont: (name: string) => void
}

/** 字体选择字段：可输入 + 自定义下拉面板 */
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

  // 内置选项 value 集合
  const builtinValues = new Set(options.map((o) => o.value))

  // 自定义字体（去除与内置重复的）
  const uniqueCustom = customFonts.filter((f) => !builtinValues.has(f))

  // 过滤后的内置选项
  const lowerFilter = filter.toLowerCase()
  const filteredBuiltin = lowerFilter
    ? options.filter((o) => o.label.toLowerCase().includes(lowerFilter))
    : options

  // 过滤后的自定义选项
  const filteredCustom = lowerFilter
    ? uniqueCustom.filter((f) => f.toLowerCase().includes(lowerFilter))
    : uniqueCustom

  // 扁平化用于键盘导航的列表（内置在前，自定义在后）
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

  // 显示值：打开编辑时显示 filter，关闭时显示当前选中值
  const displayValue = open ? filter : value

  const hasCustomSection = filteredCustom.length > 0
  const hasBuiltinSection = filteredBuiltin.length > 0
  const noResults = !hasBuiltinSection && !hasCustomSection && filter.length > 0

  return (
    <label className="settings-field" onClick={(e) => e.preventDefault()}>
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
              placeholder={value || '选择或输入字体'}
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
              {/* 自定义字体区 */}
              {hasCustomSection && (
                <>
                  <div className="font-combo-group-title">自定义字体</div>
                  {filteredCustom.map((f) => {
                    const idx = flatItems.findIndex((item) => item.isCustom && item.value === f)
                    return (
                      <div
                        key={`custom-${f}`}
                        className={`font-combo-item ${value === f ? 'font-combo-item--selected' : ''} ${idx === activeIdx ? 'font-combo-item--active' : ''}`}
                        onMouseDown={(e) => { e.preventDefault(); handleSelect(f) }}
                        onMouseEnter={() => setActiveIdx(idx)}
                      >
                        <span className="font-combo-item-text">{f}</span>
                        <button
                          className="font-combo-item-remove"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveCustom(e, f) }}
                          title="删除"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                  {hasBuiltinSection && <div className="font-combo-divider" />}
                </>
              )}

              {/* 内置字体区 */}
              {hasBuiltinSection &&
                filteredBuiltin.map((opt) => {
                  const idx = flatItems.findIndex((item) => !item.isCustom && item.value === opt.value)
                  return (
                    <div
                      key={`builtin-${opt.value}`}
                      className={`font-combo-item ${value === opt.value ? 'font-combo-item--selected' : ''} ${idx === activeIdx ? 'font-combo-item--active' : ''}`}
                      onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value) }}
                      onMouseEnter={() => setActiveIdx(idx)}
                    >
                      <span className="font-combo-item-text">{opt.label}</span>
                    </div>
                  )
                })}

              {/* 输入新字体提示 */}
              {noResults && (
                <div className="font-combo-hint">
                  按 Enter 添加「{filter}」为自定义字体
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
