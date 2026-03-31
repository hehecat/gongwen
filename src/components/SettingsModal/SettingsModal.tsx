import { useState, useEffect, useRef, type ChangeEvent, type KeyboardEvent } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useCustomFonts } from '../../hooks/useCustomFonts'
import {
  FONT_OPTIONS,
  ASCII_FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_SPACING_OPTIONS,
  INDENT_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
} from '../../types/documentConfig'
import { FontSelectField } from './FontSelectField'
import './SettingsModal.css'

interface SettingsModalProps {
  onClose: () => void
}

/** 通用 select 组件 */
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | number
  options: { label: string; value: string | number }[]
  onChange: (val: string) => void
}) {
  return (
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      <select
        className="settings-select"
        value={value}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={`${opt.value}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** 通用 number input */
function NumberField({
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
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      <div className="settings-number-wrap">
        <input
          className="settings-number"
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        />
        {unit && <span className="settings-unit">{unit}</span>}
      </div>
    </label>
  )
}

/** 可输入数值字段（支持建议值 + 基本校验） */
function NumberInputField({
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
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mouseDownOnWrapRef = useRef(false)
  const filterText = open ? draft.trim() : ''
  const filteredOptions = filterText.length > 0
    ? options.filter((opt) => opt.label.includes(filterText) || String(opt.value).includes(filterText))
    : options
  const noResults = filterText.length > 0 && filteredOptions.length === 0

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

  function commitAndClose() {
    commit()
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleSelect(nextValue: number) {
    onChange(nextValue)
    setDraft(String(nextValue))
    setOpen(false)
    setActiveIdx(-1)
    inputRef.current?.blur()
  }

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

  function handleWrapMouseDown() {
    mouseDownOnWrapRef.current = true
  }

  function handleWrapClick() {
    if (open) {
      commitAndClose()
    } else {
      setDraft(String(value))
      setOpen(true)
      setActiveIdx(-1)
      inputRef.current?.focus()
    }
  }

  function handleFocus() {
    if (mouseDownOnWrapRef.current) {
      mouseDownOnWrapRef.current = false
      return
    }
    if (!open) {
      setDraft(String(value))
      setOpen(true)
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
        setActiveIdx((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIdx((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (open && activeIdx >= 0 && activeIdx < filteredOptions.length) {
          handleSelect(filteredOptions[activeIdx].value)
        } else {
          commitAndClose()
          inputRef.current?.blur()
        }
        break
      case 'Escape':
        e.preventDefault()
        setDraft(String(value))
        setOpen(false)
        setActiveIdx(-1)
        inputRef.current?.blur()
        break
    }
  }

  return (
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      <div className="settings-number-wrap">
        <div className="font-combo" ref={wrapRef} style={{ flex: 1 }}>
          <div
            className="font-combo-input-wrap"
            onMouseDown={handleWrapMouseDown}
            onClick={handleWrapClick}
          >
            <input
              ref={inputRef}
              className="settings-number font-combo-input"
              type="text"
              inputMode="decimal"
              value={open ? draft : String(value)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const next = e.target.value
                setDraft(next)
                setActiveIdx(-1)
                if (!open) setOpen(true)
              }}
              onFocus={handleFocus}
              onBlur={() => commitAndClose()}
              onKeyDown={handleKeyDown}
            />
            <span className={`font-combo-arrow ${open ? 'font-combo-arrow--open' : ''}`} />
          </div>
          {open && (
            <div className="font-combo-dropdown">
              {filteredOptions.map((opt, idx) => (
                <div
                  key={opt.value}
                  className={`font-combo-item ${value === opt.value ? 'font-combo-item--selected' : ''} ${idx === activeIdx ? 'font-combo-item--active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value) }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <span className="font-combo-item-text">{opt.label}</span>
                </div>
              ))}
              {noResults && (
                <div className="font-combo-hint">
                  无匹配项，回车生效
                </div>
              )}
            </div>
          )}
        </div>
        {unit && <span className="settings-unit">{unit}</span>}
      </div>
    </label>
  )
}

/** 通用 checkbox */
function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <label className="settings-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

/** 通用 text input */
function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (val: string) => void
}) {
  return (
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      <input
        type="text"
        className="settings-input"
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </label>
  )
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, updateConfig, resetConfig } = useDocumentConfig()
  const { customFonts, addFont, removeFont } = useCustomFonts()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const patch = (p: DeepPartial<DocumentConfig>) => updateConfig(p)
  const FONT_SIZE_MIN = 8
  const FONT_SIZE_MAX = 72
  const LINE_SPACING_MIN = 10
  const LINE_SPACING_MAX = 120

  /** 通用字体选择属性（中文字体） */
  const fontFieldProps = {
    options: FONT_OPTIONS,
    customFonts,
    onAddCustomFont: addFont,
    onRemoveCustomFont: removeFont,
  }

  /** 通用字体选择属性（英数字体） */
  const asciiFontFieldProps = {
    options: ASCII_FONT_OPTIONS,
    customFonts,
    onAddCustomFont: addFont,
    onRemoveCustomFont: removeFont,
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部 */}
        <div className="settings-header">
          <h2 className="settings-title">设置</h2>
          <button className="settings-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="settings-body">
          {/* 区块: 版头配置 */}
          <section className="settings-section">
            <h3 className="settings-section-title">版头</h3>
            <div className="settings-options">
              <CheckboxField
                label="启用版头"
                checked={config.header.enabled}
                onChange={(v) => patch({ header: { enabled: v } })}
              />
              {config.header.enabled && (
                <div className="settings-grid settings-grid--3">
                  <TextField
                    label="发文机关标志"
                    value={config.header.orgName}
                    placeholder="如：国务院办公厅"
                    onChange={(v) => patch({ header: { orgName: v } })}
                  />
                  <TextField
                    label="发文字号"
                    value={config.header.docNumber}
                    placeholder="如：国办发〔2024〕1号"
                    onChange={(v) => patch({ header: { docNumber: v } })}
                  />
                  <TextField
                    label="签发人"
                    value={config.header.signer}
                    placeholder="选填，上行文使用"
                    onChange={(v) => patch({ header: { signer: v } })}
                  />
                </div>
              )}
            </div>
          </section>

          {/* 区块: 版记配置 */}
          <section className="settings-section">
            <h3 className="settings-section-title">版记</h3>
            <div className="settings-options">
              <CheckboxField
                label="启用版记"
                checked={config.footerNote.enabled}
                onChange={(v) => patch({ footerNote: { enabled: v } })}
              />
              {config.footerNote.enabled && (
                <div className="settings-grid settings-grid--3">
                  <TextField
                    label="抄送"
                    value={config.footerNote.cc}
                    placeholder="抄送机关"
                    onChange={(v) => patch({ footerNote: { cc: v } })}
                  />
                  <TextField
                    label="印发机关"
                    value={config.footerNote.printer}
                    placeholder="如：国务院办公厅"
                    onChange={(v) => patch({ footerNote: { printer: v } })}
                  />
                  <TextField
                    label="印发日期"
                    value={config.footerNote.printDate}
                    placeholder="如：2024年1月1日"
                    onChange={(v) => patch({ footerNote: { printDate: v } })}
                  />
                </div>
              )}
            </div>
          </section>

          {/* 区块 1: 页面边距 */}
          <section className="settings-section">
            <h3 className="settings-section-title">页面边距</h3>
            <div className="settings-grid settings-grid--4">
              <NumberField
                label="上边距"
                value={config.margins.top}
                unit="cm"
                onChange={(v) => patch({ margins: { top: v } })}
              />
              <NumberField
                label="下边距"
                value={config.margins.bottom}
                unit="cm"
                onChange={(v) => patch({ margins: { bottom: v } })}
              />
              <NumberField
                label="左边距"
                value={config.margins.left}
                unit="cm"
                onChange={(v) => patch({ margins: { left: v } })}
              />
              <NumberField
                label="右边距"
                value={config.margins.right}
                unit="cm"
                onChange={(v) => patch({ margins: { right: v } })}
              />
            </div>
          </section>

          {/* 区块 2: 标题格式 */}
          <section className="settings-section">
            <h3 className="settings-section-title">
              公文标题
              <span className="font-tooltip-icon" title="所有字体选择均支持直接输入本机已安装的字体名称，预览和导出将使用您输入的字体。">?</span>
            </h3>
            <div className="settings-grid settings-grid--3">
              <FontSelectField
                label="字体"
                value={config.title.fontFamily}
                {...fontFieldProps}
                onChange={(v) => patch({ title: { fontFamily: v } })}
              />
              <NumberInputField
                label="字号"
                value={config.title.fontSize}
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                unit="pt"
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ title: { fontSize: v } })}
              />
              <NumberInputField
                label="行距"
                value={config.title.lineSpacing}
                min={LINE_SPACING_MIN}
                max={LINE_SPACING_MAX}
                unit="磅"
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ title: { lineSpacing: v } })}
              />
            </div>
          </section>

          {/* 区块 3: 各级标题字体 */}
          <section className="settings-section">
            <h3 className="settings-section-title">各级标题</h3>
            <div className="settings-grid settings-grid--2">
              <FontSelectField
                label="一级标题字体"
                value={config.headings.h1.fontFamily}
                {...fontFieldProps}
                onChange={(v) => patch({ headings: { h1: { fontFamily: v } } })}
              />
              <NumberInputField
                label="一级标题字号"
                value={config.headings.h1.fontSize}
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                unit="pt"
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ headings: { h1: { fontSize: v } } })}
              />
              <FontSelectField
                label="二级标题字体"
                value={config.headings.h2.fontFamily}
                {...fontFieldProps}
                onChange={(v) => patch({ headings: { h2: { fontFamily: v } } })}
              />
              <NumberInputField
                label="二级标题字号"
                value={config.headings.h2.fontSize}
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                unit="pt"
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ headings: { h2: { fontSize: v } } })}
              />
            </div>
          </section>

          {/* 区块 4: 正文格式 */}
          <section className="settings-section">
            <h3 className="settings-section-title">正文格式</h3>
            <div className="settings-grid settings-grid--2">
              <FontSelectField
                label="字体"
                value={config.body.fontFamily}
                {...fontFieldProps}
                onChange={(v) => patch({ body: { fontFamily: v } })}
              />
              <NumberInputField
                label="字号"
                value={config.body.fontSize}
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                unit="pt"
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ body: { fontSize: v } })}
              />
              <NumberInputField
                label="行距"
                value={config.body.lineSpacing}
                min={LINE_SPACING_MIN}
                max={LINE_SPACING_MAX}
                unit="磅"
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ body: { lineSpacing: v } })}
              />
              <SelectField
                label="首行缩进"
                value={config.body.firstLineIndent}
                options={INDENT_OPTIONS}
                onChange={(v) => patch({ body: { firstLineIndent: Number(v) } })}
              />
            </div>
            <p className="settings-hint">正文格式同时应用于三级标题、四级标题、附件说明和成文日期</p>
          </section>

          {/* 区块 5: 特殊选项 */}
          <section className="settings-section">
            <h3 className="settings-section-title">特殊选项</h3>
            <div className="settings-options">
              <CheckboxField
                label="正文段落首句加粗"
                checked={config.specialOptions.boldFirstSentence}
                onChange={(v) => patch({ specialOptions: { boldFirstSentence: v } })}
              />
              <CheckboxField
                label="添加页码"
                checked={config.specialOptions.showPageNumber}
                onChange={(v) => patch({ specialOptions: { showPageNumber: v } })}
              />
              {config.specialOptions.showPageNumber && (
                <div className="settings-sub-option">
                  <FontSelectField
                    label="页码字体"
                    value={config.specialOptions.pageNumberFont}
                    {...fontFieldProps}
                    onChange={(v) => patch({ specialOptions: { pageNumberFont: v } })}
                  />
                </div>
              )}
              <CheckboxField
                label="加盖印章（成文日期右空四字）"
                checked={config.specialOptions.hasStamp}
                onChange={(v) => patch({ specialOptions: { hasStamp: v } })}
              />
              <p className="settings-hint">
                {config.specialOptions.hasStamp
                  ? '加盖印章：成文日期右空四字，发文机关署名以成文日期为基准居中 (GB/T 9704 7.3.5.1)'
                  : '不加盖印章：成文日期右空二字，发文机关署名以成文日期为基准居中 (GB/T 9704 7.3.5.2)'}
              </p>
              <p className="settings-hint">
                发文机关署名自动识别：成文日期上一行、不超过15字、不以标点结尾的段落
              </p>
            </div>
          </section>

          {/* 区块 7: 高级设置（折叠面板） */}
          <section className="settings-section">
            <button
              className="settings-section-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>高级设置</span>
              <span className={`settings-arrow ${showAdvanced ? 'settings-arrow--open' : ''}`}>
                ▸
              </span>
            </button>
            {showAdvanced && (
              <div className="settings-advanced">
                <p className="settings-hint">按元素类型独立配置中文字体、英数字体和字号</p>
                {(
                  [
                    ['addressee', '主送机关'],
                    ['h1', '一级标题'],
                    ['h2', '二级标题'],
                    ['h3', '三级标题'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="settings-advanced-row">
                    <span className="settings-advanced-label">{label}</span>
                    <div className="settings-grid settings-grid--3">
                      <FontSelectField
                        label="中文字体"
                        value={config.advanced[key].fontFamily}
                        {...fontFieldProps}
                        onChange={(v) =>
                          patch({ advanced: { [key]: { fontFamily: v } } })
                        }
                      />
                      <FontSelectField
                        label="英数字体"
                        value={config.advanced[key].asciiFontFamily}
                        {...asciiFontFieldProps}
                        onChange={(v) =>
                          patch({ advanced: { [key]: { asciiFontFamily: v } } })
                        }
                      />
                      <NumberInputField
                        label="字号"
                        value={config.advanced[key].fontSize}
                        min={FONT_SIZE_MIN}
                        max={FONT_SIZE_MAX}
                        unit="pt"
                        options={FONT_SIZE_OPTIONS}
                        onChange={(v) =>
                          patch({ advanced: { [key]: { fontSize: v } } })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 底部操作栏 */}
        <div className="settings-footer">
          <a
            className="settings-btn settings-btn--download"
            href="https://github.com/hehecat/gongwen/releases/latest/download/gongwen.html"
            target="_blank"
            rel="noopener noreferrer"
          >
            下载离线版
          </a>
          <div className="settings-footer-spacer" />
          <button className="settings-btn settings-btn--reset" onClick={resetConfig}>
            恢复默认
          </button>
          <button className="settings-btn settings-btn--close" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
