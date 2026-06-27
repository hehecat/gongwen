import { useState, type MouseEvent } from 'react'
import { SearchableSelectField, type SearchableSelectSection } from './SearchableSelectField'

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
  }

  function handleRemoveCustom(e: MouseEvent<HTMLButtonElement>, fontName: string) {
    e.stopPropagation()
    onRemoveCustomFont(fontName)
  }

  const hasCustomSection = filteredCustom.length > 0
  const hasBuiltinSection = filteredBuiltin.length > 0
  const noResults = !hasBuiltinSection && !hasCustomSection && filter.length > 0
  const sections: SearchableSelectSection[] = []

  if (hasCustomSection) {
    sections.push({
      title: '自定义字体',
      showDividerAfter: hasBuiltinSection,
      items: filteredCustom.map((fontName) => ({
        key: `custom-${fontName}`,
        label: fontName,
        value: fontName,
        selected: value === fontName,
        removeButtonTitle: '删除',
        onRemove: (event) => handleRemoveCustom(event, fontName),
      })),
    })
  }

  if (hasBuiltinSection) {
    sections.push({
      items: filteredBuiltin.map((option) => ({
        key: `builtin-${option.value}`,
        label: option.label,
        value: option.value,
        selected: value === option.value,
      })),
    })
  }

  return (
    <SearchableSelectField
      label={label}
      closedValue={value}
      openValue={filter}
      placeholder={value || '选择或输入字体'}
      sections={sections}
      emptyHint={noResults ? `按 Enter 添加「${filter}」为自定义字体` : undefined}
      onOpen={() => setFilter('')}
      onCommit={commitFilter}
      onEscape={() => setFilter('')}
      onInputChange={setFilter}
      onSelect={handleSelect}
    />
  )
}
