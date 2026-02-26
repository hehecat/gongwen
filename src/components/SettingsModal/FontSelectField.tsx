import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'

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
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  // 区分「键盘/输入触发」和「鼠标点击触发」，避免 focus+click 冲突
  const mouseDownOnWrapRef = useRef(false)

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

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commitAndClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  function commitAndClose() {
    const trimmed = filter.trim()
    if (trimmed && !builtinValues.has(trimmed) && trimmed !== value) {
      onAddCustomFont(trimmed)
      onChange(trimmed)
    }
    setOpen(false)
    setFilter('')
    setActiveIdx(-1)
  }

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
    setFilter('')
    setActiveIdx(-1)
    inputRef.current?.blur()
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    setFilter(e.target.value)
    setActiveIdx(-1)
    if (!open) setOpen(true)
  }

  // mousedown 在 wrap 上记录标记，用于 onFocus 判断来源
  function handleWrapMouseDown() {
    mouseDownOnWrapRef.current = true
  }

  // 点击箭头或输入框区域：toggle
  function handleWrapClick() {
    if (open) {
      commitAndClose()
    } else {
      setOpen(true)
      setFilter('')
      setActiveIdx(-1)
      inputRef.current?.focus()
    }
  }

  // onFocus 只在非鼠标点击（如 Tab 键）时打开
  function handleFocus() {
    if (mouseDownOnWrapRef.current) {
      mouseDownOnWrapRef.current = false
      return // 鼠标点击触发的 focus，由 handleWrapClick 处理
    }
    // Tab 键聚焦时打开
    if (!open) {
      setOpen(true)
      setFilter('')
      setActiveIdx(-1)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIdx((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIdx >= 0 && activeIdx < flatItems.length) {
          handleSelect(flatItems[activeIdx].value)
        } else {
          commitAndClose()
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        setFilter('')
        setActiveIdx(-1)
        break
    }
  }

  function handleRemoveCustom(e: React.MouseEvent, fontName: string) {
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
      <div className="font-combo" ref={wrapRef}>
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
    </label>
  )
}
