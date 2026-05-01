import { useState, type ChangeEvent, type ReactNode } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useCustomFonts } from '../../hooks/useCustomFonts'
import {
  FONT_OPTIONS,
  ASCII_FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_SPACING_OPTIONS,
  INDENT_OPTIONS,
  PAGE_NUMBER_LAYOUT_OPTIONS,
  HEADER_MODE_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
  type PageNumberStyle,
} from '../../types/documentConfig'
import { FontSelectField } from './FontSelectField'
import { useComboBox } from './useComboBox'
import './SettingsModal.css'

interface SettingsModalProps {
  onClose: () => void
}

const INDENT_SELECT_OPTIONS = INDENT_OPTIONS.map((opt) => ({
  ...opt,
  label: String(opt.value),
}))

const PROJECT_INFO = {
  repoUrl: 'https://github.com/hehecat/gongwen',
  releasesUrl: 'https://github.com/hehecat/gongwen/releases',
  authorEmail: 'hehecat@outlook.com',
  recentUpdates: __APP_RECENT_UPDATES__,
}

const DONATION_QR_CODES = [
  { label: '支付宝', src: `${import.meta.env.BASE_URL}alipay.png` },
  { label: '微信', src: `${import.meta.env.BASE_URL}wechat.png` },
]

/** 通用 select 组件 */
function SelectField({
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
    <label className="settings-field">
      <span className="settings-field-label">{label}</span>
      <div className="settings-control-row">
        <div className="settings-select-wrap settings-field-main">
          <select
            className="settings-select settings-select--custom"
            value={value}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
          >
            {options.map((opt) => (
              <option key={`${opt.value}`} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="font-combo-arrow" />
        </div>
        <span className={`settings-unit ${unit ? '' : 'settings-unit--placeholder'}`}>
          {unit}
        </span>
      </div>
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

  function commitAndClose() {
    commit()
    closeDropdown()
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
    <label className="settings-field">
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
              className="settings-number font-combo-input"
              type="text"
              inputMode="decimal"
              value={displayValue}
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
        <span className={`settings-unit ${unit ? '' : 'settings-unit--placeholder'}`}>
          {unit}
        </span>
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
  label: ReactNode
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
  const importInputRef = useRef<HTMLInputElement>(null)

  const patch = (p: DeepPartial<DocumentConfig>) => updateConfig(p)
  const FONT_SIZE_MIN = 8
  const FONT_SIZE_MAX = 72
  const LINE_SPACING_MIN = 10
  const LINE_SPACING_MAX = 120
  const titleLineSpacingMin = Math.max(LINE_SPACING_MIN, config.title.fontSize)
  const bodyLineSpacingMin = Math.max(
    LINE_SPACING_MIN,
    config.body.fontSize,
    config.advanced.h1.fontSize,
    config.advanced.h2.fontSize,
    config.advanced.h3.fontSize,
  )

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

  function handleExportSettings() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      config,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'gongwen-settings.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleImportSettings(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as { config?: DeepPartial<DocumentConfig> }
      if (!parsed.config) throw new Error('设置文件格式无效')
      updateConfig(parsed.config)
      alert('设置已导入并实时应用')
    } catch (error) {
      alert(error instanceof Error ? error.message : '导入设置失败')
    }
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
                  <SelectField
                    label="版头样式"
                    value={config.header.mode}
                    options={HEADER_MODE_OPTIONS}
                    onChange={(v) => patch({ header: { mode: v as 'formal' | 'note' } })}
                  />
                  <TextField
                    label="发文机关标志"
                    value={config.header.orgName}
                    placeholder="如：国务院办公厅"
                    onChange={(v) => patch({ header: { orgName: v } })}
                  />
                  {config.header.mode === 'formal' && (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              <div className="settings-panel">
                <div className="settings-options">
                  <CheckboxField
                    label="启用版记"
                    checked={config.footerNote.enabled}
                    onChange={(v) => patch({ footerNote: { enabled: v } })}
                  />
                  {config.footerNote.enabled && (
                    <div className="settings-panel-fields">
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
              </div>
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
                onChange={(v) => patch({ title: { fontSize: v, lineSpacing: Math.max(config.title.lineSpacing, v) } })}
              />
              <NumberInputField
                label="行距"
                value={config.title.lineSpacing}
                min={titleLineSpacingMin}
                max={LINE_SPACING_MAX}
                unit="磅"
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ title: { lineSpacing: v } })}
              />
            </div>
          </section>

          {/* 区块 3: 正文格式 */}
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
                onChange={(v) => patch({ body: { fontSize: v, lineSpacing: Math.max(config.body.lineSpacing, v) } })}
              />
              <NumberInputField
                label="行距"
                value={config.body.lineSpacing}
                min={bodyLineSpacingMin}
                max={LINE_SPACING_MAX}
                unit="磅"
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ body: { lineSpacing: v } })}
              />
              <SelectField
                label="首行缩进"
                value={config.body.firstLineIndent}
                unit="字符"
                options={INDENT_SELECT_OPTIONS}
                onChange={(v) => patch({ body: { firstLineIndent: Number(v) } })}
              />
            </div>
            <p className="settings-hint">正文行距和首行缩进同时应用于三级标题、四级标题、附件说明和成文日期</p>
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
                label="正文首段顶格"
                checked={config.specialOptions.firstParagraphNoIndent}
                onChange={(v) => patch({ specialOptions: { firstParagraphNoIndent: v } })}
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
                  <SelectField
                    label="页码位置"
                    value={config.specialOptions.pageNumberLayout}
                    options={PAGE_NUMBER_LAYOUT_OPTIONS}
                    onChange={(v) =>
                      patch({ specialOptions: { pageNumberLayout: v as 'center' | 'mirrored' } })
                    }
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
              <span className={`settings-arrow ${showAdvanced ? 'settings-arrow--open' : ''}`} />
            </button>
            {showAdvanced && (
              <div className="settings-advanced">
                <p className="settings-hint">一级、二级、三级标题统一在此配置中文字体、英数字体和字号</p>
                {(
                  [
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
                          patch({
                            advanced: { [key]: { fontSize: v } },
                            body: { lineSpacing: Math.max(config.body.lineSpacing, v) },
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div className="settings-advanced-row settings-advanced-row--text-fix">
                  <span className="settings-advanced-label">文本修复</span>
                  <div className="settings-options">
                    <CheckboxField
                      label="一键修复和实时解析时，将英文标点替换为中文标点"
                      checked={config.textFixOptions.convertEnglishPunctuation}
                      onChange={(v) => patch({ textFixOptions: { convertEnglishPunctuation: v } })}
                    />
                    <CheckboxField
                      label="一键修复和实时解析时，去除多余空格"
                      checked={config.textFixOptions.removeRedundantSpaces}
                      onChange={(v) => patch({ textFixOptions: { removeRedundantSpaces: v } })}
                    />
                    <p className="settings-hint">
                      关闭某项后，预览解析与“一键修复”都会跳过对应处理，仅保留你启用的文本修复规则。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 底部操作栏 */}
        <div className="settings-footer">
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImportSettings}
            style={{ display: 'none' }}
          />
          <div className="settings-footer-actions settings-footer-actions--left">
            <a
              className="settings-btn settings-btn--download"
              href="https://github.com/hehecat/gongwen/releases/latest/download/gongwen.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              下载离线版
            </a>
          </div>
          <div className="settings-footer-spacer" />
          <div className="settings-footer-actions settings-footer-actions--right">
            <button className="settings-btn settings-btn--close" onClick={handleExportSettings}>
              导出设置
            </button>
            <button className="settings-btn settings-btn--close" onClick={() => importInputRef.current?.click()}>
              导入设置
            </button>
            <button className="settings-btn settings-btn--reset" onClick={resetConfig}>
              恢复默认
            </button>
            <button className="settings-btn settings-btn--save" onClick={onClose}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
