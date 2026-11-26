import { useState, type ChangeEvent, type ReactNode } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useCustomFonts } from '../../hooks/useCustomFonts'
import {
  ASCII_FONT_OPTIONS,
  DOCUMENT_FORMAT_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  INDENT_OPTIONS,
  LINE_SPACING_OPTIONS,
  PAGE_NUMBER_STYLE_OPTIONS,
  formatFontSizeLabel,
  type DeepPartial,
  type DocumentConfig,
  type DocumentFormat,
  type HeaderOrgAlign,
  type HeaderSeparatorStyle,
  type PageNumberStyle,
} from '../../types/documentConfig'
import { normalizeDocNumberText } from '../../layout/typography'
import { STANDARD_MARGIN_BOTTOM_CM, STANDARD_MARGIN_LEFT_CM, STANDARD_MARGIN_RIGHT_CM, STANDARD_MARGIN_TOP_CM } from '../../layout/constants'
import alipayQr from '../../assets/alipay.png'
import wechatQr from '../../assets/wechat.png'
import { FontSelectField } from './FontSelectField'
import { TemplateManagerTab } from './TemplateManagerTab'
import { useComboBox } from './useComboBox'
import './SettingsDrawer.css'

export type SettingsTabId =
  | 'templates'
  | 'headerFooter'
  | 'pageBody'
  | 'headingsSeal'
  | 'sanitizeParser'
  | 'about'

interface SettingsDrawerProps {
  activeTab: SettingsTabId
  onTabChange: (tab: SettingsTabId) => void
  onClose: () => void
}

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: 'templates', label: '模板中心' },
  { id: 'headerFooter', label: '版头与版记' },
  { id: 'pageBody', label: '页面与正文' },
  { id: 'headingsSeal', label: '标题与落款' },
  { id: 'sanitizeParser', label: '净化与解析' },
  { id: 'about', label: '关于与国标' },
]

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
  { label: '支付宝', src: alipayQr },
  { label: '微信', src: wechatQr },
]

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
        <span className={`settings-unit ${unit ? '' : 'settings-unit--placeholder'}`}>{unit}</span>
      </div>
    </label>
  )
}

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
              {noResults && <div className="font-combo-hint">无匹配项，回车生效</div>}
            </div>
          )}
        </div>
        <span className={`settings-unit ${unit ? '' : 'settings-unit--placeholder'}`}>{unit}</span>
      </div>
    </label>
  )
}

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

function TextField({
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
    <label className="settings-field">
      <div className="settings-field-label-row">
        <span className="settings-field-label">{label}</span>
        {action}
      </div>
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

async function convertFileToSupportedDataUrl(file: File): Promise<string> {
  const isNativePngOrJpg = /^image\/(png|jpe?g)$/i.test(file.type)
    || /\.(png|jpe?g)$/i.test(file.name)

  if (isNativePngOrJpg) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(file)
    })
  }

  // SVG / WebP 等先经 Canvas 光栅化为高分辨率 PNG，确保 Word ImageRun 稳定嵌入
  return await new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const targetWidth = Math.max(1000, img.naturalWidth || 1200)
        const ratio = (img.naturalHeight || 200) / (img.naturalWidth || 1200)
        const targetHeight = Math.max(120, Math.round(targetWidth * ratio))
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('无法初始化画布')
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法解析该图片格式，建议使用 PNG、JPG 或标准 SVG'))
    }
    img.src = objectUrl
  })
}

export function SettingsDrawer({ activeTab, onTabChange, onClose }: SettingsDrawerProps) {
  const { config, updateConfig, resetConfig } = useDocumentConfig()
  const { customFonts, addFont, removeFont } = useCustomFonts()
  const [imageError, setImageError] = useState('')
  const [imageWarning, setImageWarning] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

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

  const fontFieldProps = {
    options: FONT_OPTIONS,
    customFonts,
    onAddCustomFont: addFont,
    onRemoveCustomFont: removeFont,
  }

  const asciiFontFieldProps = {
    options: ASCII_FONT_OPTIONS,
    customFonts,
    onAddCustomFont: addFont,
    onRemoveCustomFont: removeFont,
  }

  const sealMode: 'stamp' | 'none' | 'signerStamp' =
    config.specialOptions.signerTitle.trim() || config.specialOptions.signerStampName.trim()
      ? 'signerStamp'
      : config.specialOptions.hasStamp
        ? 'stamp'
        : 'none'

  async function handleCustomHeaderImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImageError('')
    setImageWarning('')
    try {
      const dataUrl = await convertFileToSupportedDataUrl(file)
      if (dataUrl.length > 420_000) {
        setImageWarning('当前图片体积较大，可能使模板与导出文件偏大，建议压缩到 300KB 以内。')
      }
      patch({ header: { customImageDataUrl: dataUrl } })
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '图片导入失败')
    }
  }

  return (
    <aside className="settings-drawer" role="dialog" aria-label="公文格式与版式设置">
      <div className="settings-header">
        <div>
          <h2 className="settings-title">格式与版式设置</h2>
          <p className="settings-subtitle">右侧 A4 预览实时同步更新，按 Esc 关闭</p>
        </div>
        <button type="button" className="settings-close" onClick={onClose} aria-label="关闭设置">
          ✕
        </button>
      </div>

      <nav className="settings-tabs" role="tablist" aria-label="设置分组">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab-btn ${activeTab === tab.id ? 'settings-tab-btn--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="settings-body">
        {activeTab === 'templates' && <TemplateManagerTab />}

        {activeTab === 'headerFooter' && (
          <div className="settings-tab-stack">
            <section className="settings-section">
              <div className="settings-section-header-row">
                <h3 className="settings-section-title settings-section-title--inline">版头设置（GB/T 9704 §7.2 & §10）</h3>
                <CheckboxField
                  label="启用版头"
                  checked={config.header.enabled}
                  onChange={(v) => patch({ header: { enabled: v } })}
                />
              </div>

              {config.header.enabled && (
                <div className="settings-tab-stack">
                  <div className="settings-format-grid">
                    {DOCUMENT_FORMAT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`settings-format-card ${config.header.format === opt.value ? 'settings-format-card--active' : ''}`}
                        onClick={() => patch({ header: { format: opt.value as DocumentFormat } })}
                      >
                        <strong>{opt.label}</strong>
                        <span>{opt.description}</span>
                      </button>
                    ))}
                  </div>

                  <div className="settings-panel">
                    <label className="settings-field">
                      <span className="settings-field-label">
                        发文机关标志（支持换行表示联合行文）
                      </span>
                      <textarea
                        className="settings-textarea"
                        rows={2}
                        value={config.header.orgName}
                        placeholder="如：国务院办公厅文件（联合行文可换行输入多个机关）"
                        onChange={(e) => patch({ header: { orgName: e.target.value } })}
                      />
                    </label>

                    <div className="settings-grid settings-grid--3" style={{ marginTop: 10 }}>
                      <FontSelectField
                        label="标志字体"
                        value={config.header.orgNameFontFamily}
                        {...fontFieldProps}
                        onChange={(v) => patch({ header: { orgNameFontFamily: v } })}
                      />
                      <NumberInputField
                        label="标志字号"
                        value={config.header.orgNameFontSize}
                        min={16}
                        max={72}
                        unit="pt"
                        options={FONT_SIZE_OPTIONS}
                        onChange={(v) => patch({ header: { orgNameFontSize: v } })}
                      />
                      <SelectField
                        label="排列方式"
                        value={config.header.orgNameAlign}
                        options={[
                          { label: '居中排布', value: 'center' },
                          { label: '分散对齐（撑满整行）', value: 'distribute' },
                        ]}
                        onChange={(v) => patch({ header: { orgNameAlign: v as HeaderOrgAlign } })}
                      />
                    </div>

                    <div className="settings-grid settings-grid--3" style={{ marginTop: 10 }}>
                      <TextField
                        label="联合行文右侧缀字"
                        value={config.header.orgNameSuffix}
                        placeholder="如：文件（可选）"
                        onChange={(v) => patch({ header: { orgNameSuffix: v } })}
                      />
                      <NumberField
                        label="附加字距"
                        value={config.header.orgNameLetterSpacing}
                        min={0}
                        max={30}
                        step={0.5}
                        unit="pt"
                        onChange={(v) => patch({ header: { orgNameLetterSpacing: v } })}
                      />
                      {config.header.format !== 'letter' && config.header.format !== 'command' && (
                        <SelectField
                          label="分隔线样式"
                          value={config.header.separatorStyle}
                          options={[
                            { label: '红色单线（国标）', value: 'solid' },
                            { label: '红线居中五角星 ★', value: 'star' },
                            { label: '无分隔线', value: 'none' },
                          ]}
                          onChange={(v) => patch({ header: { separatorStyle: v as HeaderSeparatorStyle } })}
                        />
                      )}
                    </div>
                  </div>

                  <div className="settings-panel">
                    <div className="settings-grid settings-grid--2">
                      <TextField
                        label={config.header.format === 'command' ? '令号（§10.2）' : '发文字号（§7.2.5）'}
                        value={config.header.docNumber}
                        placeholder={config.header.format === 'command' ? '如：第 777 号' : '如：国办发〔2026〕1号'}
                        onChange={(v) => patch({ header: { docNumber: v } })}
                        action={
                          config.header.docNumber.trim()
                          && normalizeDocNumberText(config.header.docNumber) !== config.header.docNumber.trim() ? (
                            <button
                              type="button"
                              className="settings-mini-link"
                              onClick={() => patch({ header: { docNumber: normalizeDocNumberText(config.header.docNumber) } })}
                            >
                              转为〔〕
                            </button>
                            ) : undefined
                        }
                      />
                      {config.header.format === 'standard' && (
                        <TextField
                          label="签发人（上行文，多人以逗号分隔）"
                          value={config.header.signer}
                          placeholder="留空不显示；如：张三, 李四"
                          onChange={(v) => patch({ header: { signer: v } })}
                        />
                      )}
                    </div>

                    {(config.header.format === 'standard' || config.header.format === 'letter') && (
                      <div className="settings-grid settings-grid--3" style={{ marginTop: 10 }}>
                        <TextField
                          label="份号（§7.2.1）"
                          value={config.header.copyNumber}
                          placeholder="如：000001"
                          onChange={(v) => patch({ header: { copyNumber: v } })}
                        />
                        <TextField
                          label="密级和保密期限（§7.2.2）"
                          value={config.header.secretLevel}
                          placeholder="如：秘密★1年"
                          onChange={(v) => patch({ header: { secretLevel: v } })}
                        />
                        <TextField
                          label="紧急程度（§7.2.3）"
                          value={config.header.urgency}
                          placeholder="如：特急 / 加急"
                          onChange={(v) => patch({ header: { urgency: v } })}
                        />
                      </div>
                    )}
                  </div>

                  {/* 自定义图片版头 */}
                  <div className="settings-panel">
                    <div className="settings-section-header-row">
                      <span className="settings-field-label">自定义红头图片版头（替代文字标志）</span>
                      <div className="settings-inline-actions">
                        <label className="settings-btn settings-btn--ghost settings-file-btn">
                          上传 PNG / JPG / SVG
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml"
                            style={{ display: 'none' }}
                            onChange={handleCustomHeaderImage}
                          />
                        </label>
                        {config.header.customImageDataUrl && (
                          <button
                            type="button"
                            className="settings-btn settings-btn--ghost settings-btn--danger-text"
                            onClick={() => patch({ header: { customImageDataUrl: '' } })}
                          >
                            清除图片
                          </button>
                        )}
                      </div>
                    </div>
                    {imageError && <p className="settings-error-text">{imageError}</p>}
                    {imageWarning && <p className="settings-warn-text">{imageWarning}</p>}
                    {config.header.customImageDataUrl && (
                      <div className="settings-header-image-preview">
                        <img src={config.header.customImageDataUrl} alt="已上传版头" />
                        <NumberField
                          label="图片高度"
                          value={config.header.customImageHeightMm}
                          min={10}
                          max={80}
                          step={1}
                          unit="mm"
                          onChange={(v) => patch({ header: { customImageHeightMm: v } })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="settings-section">
              <div className="settings-section-header-row">
                <h3 className="settings-section-title settings-section-title--inline">版记设置（GB/T 9704 §7.4）</h3>
                <CheckboxField
                  label="启用版记"
                  checked={config.footerNote.enabled}
                  onChange={(v) => patch({ footerNote: { enabled: v } })}
                />
              </div>

              {config.footerNote.enabled && (
                <div className="settings-panel settings-panel-fields">
                  <TextField
                    label="移至版记的主送机关（§7.4.2 可选，置于抄送之上）"
                    value={config.footerNote.mainRecipient}
                    placeholder="仅当首页主送过多需移至版记时填写"
                    onChange={(v) => patch({ footerNote: { mainRecipient: v } })}
                  />
                  <TextField
                    label="抄送机关（末位自动补中文句号）"
                    value={config.footerNote.cc}
                    placeholder="如：市委办公室，市政府各部门"
                    onChange={(v) => patch({ footerNote: { cc: v } })}
                  />
                  {config.header.format !== 'letter' && (
                    <div className="settings-grid settings-grid--2">
                      <TextField
                        label="印发机关"
                        value={config.footerNote.printer}
                        placeholder="如：国务院办公厅"
                        onChange={(v) => patch({ footerNote: { printer: v } })}
                      />
                      <TextField
                        label="印发日期"
                        value={config.footerNote.printDate}
                        placeholder="如：2026年11月26日"
                        onChange={(v) => patch({ footerNote: { printDate: v } })}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'pageBody' && (
          <div className="settings-tab-stack">
            <section className="settings-section">
              <div className="settings-section-header-row">
                <h3 className="settings-section-title settings-section-title--inline">页面边距（§5.2.1 版心 156×225 mm）</h3>
                <button
                  type="button"
                  className="settings-btn settings-btn--ghost"
                  onClick={() => patch({
                    margins: {
                      top: STANDARD_MARGIN_TOP_CM,
                      bottom: STANDARD_MARGIN_BOTTOM_CM,
                      left: STANDARD_MARGIN_LEFT_CM,
                      right: STANDARD_MARGIN_RIGHT_CM,
                    },
                  })}
                >
                  恢复国标 3.7/3.5/2.8/2.6
                </button>
              </div>
              <div className="settings-grid settings-grid--4">
                <NumberField label="上边距" value={config.margins.top} unit="cm" onChange={(v) => patch({ margins: { top: v } })} />
                <NumberField label="下边距" value={config.margins.bottom} unit="cm" onChange={(v) => patch({ margins: { bottom: v } })} />
                <NumberField label="左边距" value={config.margins.left} unit="cm" onChange={(v) => patch({ margins: { left: v } })} />
                <NumberField label="右边距" value={config.margins.right} unit="cm" onChange={(v) => patch({ margins: { right: v } })} />
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">
                公文标题（§7.3.1 默认 2 号小标宋）
                <span className="font-tooltip-icon" title="所有字体选择均支持直接输入本机已安装字体名称，预览和导出将同步使用。">?</span>
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

            <section className="settings-section">
              <h3 className="settings-section-title">正文格式（§5.2.2 & §5.2.3 默认 3 号仿宋，22 行×28 字）</h3>
              <div className="settings-grid settings-grid--3">
                <FontSelectField
                  label="中文字体"
                  value={config.body.fontFamily}
                  {...fontFieldProps}
                  onChange={(v) => patch({ body: { fontFamily: v } })}
                />
                <FontSelectField
                  label="英数字体"
                  value={config.body.asciiFontFamily}
                  {...asciiFontFieldProps}
                  onChange={(v) => patch({ body: { asciiFontFamily: v } })}
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
              <p className="settings-hint">正文行距同时应用于一至四级标题、附注、附件说明与落款日期。</p>
            </section>
          </div>
        )}

        {activeTab === 'headingsSeal' && (
          <div className="settings-tab-stack">
            <section className="settings-section">
              <h3 className="settings-section-title">正文细节与各级标题加粗</h3>
              <div className="settings-special-grid">
                <div className="settings-special-card">
                  <CheckboxField
                    label="正文段落首句加粗"
                    checked={config.specialOptions.boldFirstSentence}
                    onChange={(v) => patch({ specialOptions: { boldFirstSentence: v } })}
                  />
                </div>
                <div className="settings-special-card">
                  <CheckboxField
                    label="二级标题（楷体）加粗"
                    checked={config.specialOptions.boldHeading2}
                    onChange={(v) => patch({ specialOptions: { boldHeading2: v } })}
                  />
                </div>
                <div className="settings-special-card">
                  <CheckboxField
                    label="三级小标题（首句）加粗"
                    checked={config.specialOptions.boldHeading3}
                    onChange={(v) => patch({ specialOptions: { boldHeading3: v } })}
                  />
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">印章、落款与签名章（GB/T 9704 §7.3.5）</h3>
              <div className="settings-format-grid settings-format-grid--3">
                <button
                  type="button"
                  className={`settings-format-card ${sealMode === 'none' ? 'settings-format-card--active' : ''}`}
                  onClick={() => patch({ specialOptions: { hasStamp: false, signerTitle: '', signerStampName: '' } })}
                >
                  <strong>不加盖印章</strong>
                  <span>§7.3.5.2 空一行，右空二字</span>
                </button>
                <button
                  type="button"
                  className={`settings-format-card ${sealMode === 'stamp' ? 'settings-format-card--active' : ''}`}
                  onClick={() => patch({ specialOptions: { hasStamp: true, signerTitle: '', signerStampName: '' } })}
                >
                  <strong>加盖公章</strong>
                  <span>§7.3.5.1 空二行，日期右空四字</span>
                </button>
                <button
                  type="button"
                  className={`settings-format-card ${sealMode === 'signerStamp' ? 'settings-format-card--active' : ''}`}
                  onClick={() => patch({
                    specialOptions: {
                      hasStamp: true,
                      signerTitle: config.specialOptions.signerTitle || '市长',
                    },
                  })}
                >
                  <strong>签发人签名章</strong>
                  <span>§7.3.5.3 / §10.2 职务+签名章</span>
                </button>
              </div>

              {sealMode === 'signerStamp' && (
                <div className="settings-panel settings-grid settings-grid--2" style={{ marginTop: 10 }}>
                  <TextField
                    label="签发人职务（全称，3号仿宋）"
                    value={config.specialOptions.signerTitle}
                    placeholder="如：国务院总理 / 市长"
                    onChange={(v) => patch({ specialOptions: { signerTitle: v } })}
                  />
                  <TextField
                    label="签发人签名章姓名（3号楷体占位）"
                    value={config.specialOptions.signerStampName}
                    placeholder="如：张三"
                    onChange={(v) => patch({ specialOptions: { signerStampName: v } })}
                  />
                </div>
              )}
            </section>

            <section className="settings-section">
              <div className="settings-section-header-row">
                <h3 className="settings-section-title settings-section-title--inline">页码设置（GB/T 9704 §7.5）</h3>
                <CheckboxField
                  label="显示页码"
                  checked={config.specialOptions.showPageNumber}
                  onChange={(v) => patch({ specialOptions: { showPageNumber: v } })}
                />
              </div>
              {config.specialOptions.showPageNumber && (
                <div className="settings-panel settings-grid settings-grid--2">
                  <FontSelectField
                    label="页码字体（默认 4 号宋体）"
                    value={config.specialOptions.pageNumberFont}
                    {...fontFieldProps}
                    onChange={(v) => patch({ specialOptions: { pageNumberFont: v } })}
                  />
                  <SelectField
                    label="页码对齐样式"
                    value={config.specialOptions.pageNumberStyle}
                    options={PAGE_NUMBER_STYLE_OPTIONS}
                    onChange={(v) => patch({ specialOptions: { pageNumberStyle: v as PageNumberStyle } })}
                  />
                </div>
              )}
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">一至三级标题字体与字号</h3>
              <div className="settings-advanced">
                {(
                  [
                    ['h1', '一级标题（默认黑体）'],
                    ['h2', '二级标题（默认楷体）'],
                    ['h3', '三级标题（默认仿宋）'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="settings-advanced-row">
                    <span className="settings-advanced-label">{label}</span>
                    <div className="settings-grid settings-grid--3">
                      <FontSelectField
                        label="中文字体"
                        value={config.advanced[key].fontFamily}
                        {...fontFieldProps}
                        onChange={(v) => patch({ advanced: { [key]: { fontFamily: v } } })}
                      />
                      <FontSelectField
                        label="英数字体"
                        value={config.advanced[key].asciiFontFamily}
                        {...asciiFontFieldProps}
                        onChange={(v) => patch({ advanced: { [key]: { asciiFontFamily: v } } })}
                      />
                      <NumberInputField
                        label="字号"
                        value={config.advanced[key].fontSize}
                        min={FONT_SIZE_MIN}
                        max={FONT_SIZE_MAX}
                        unit="pt"
                        options={FONT_SIZE_OPTIONS}
                        onChange={(v) => patch({
                          advanced: { [key]: { fontSize: v } },
                          body: { lineSpacing: Math.max(config.body.lineSpacing, v) },
                        })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'sanitizeParser' && (
          <div className="settings-tab-stack">
            <section className="settings-section">
              <div className="settings-section-header-row">
                <h3 className="settings-section-title settings-section-title--inline">标点与空白自动净化</h3>
                <CheckboxField
                  label="启用自动净化"
                  checked={config.sanitize.enabled}
                  onChange={(v) => patch({ sanitize: { enabled: v } })}
                />
              </div>
              <p className="settings-hint">
                净化仅作用于右侧预览与导出，不会强行改写左侧编辑区原文；URL、邮箱、时间（14:30）和千分位数字（1,000）自动受保护不被误转。
              </p>
              <div className="settings-special-grid">
                <div className="settings-special-card">
                  <CheckboxField
                    label="半角标点转全角（，。：；（）？！）"
                    checked={config.sanitize.convertPunctuation}
                    onChange={(v) => patch({ sanitize: { convertPunctuation: v } })}
                  />
                </div>
                <div className="settings-special-card">
                  <CheckboxField
                    label="半角双引号转中文“”"
                    checked={config.sanitize.convertQuotes}
                    onChange={(v) => patch({ sanitize: { convertQuotes: v } })}
                  />
                </div>
                <div className="settings-special-card">
                  <CheckboxField
                    label="清理多余空格与连续空行"
                    checked={config.sanitize.cleanWhitespace}
                    onChange={(v) => patch({ sanitize: { cleanWhitespace: v } })}
                  />
                </div>
                <div className="settings-special-card">
                  <CheckboxField
                    label="发文字号括号自动规范为〔〕"
                    checked={config.sanitize.normalizeDocNumberBrackets}
                    onChange={(v) => patch({ sanitize: { normalizeDocNumberBrackets: v } })}
                  />
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">公文结构自动解析规则</h3>
              <div className="settings-special-grid">
                <div className="settings-special-card">
                  <CheckboxField
                    label="将行首「一是/二要」识别为三级标题"
                    checked={config.parser.recognizeChineseThreeLevel}
                    onChange={(v) => patch({ parser: { recognizeChineseThreeLevel: v } })}
                  />
                </div>
                <div className="settings-special-card">
                  <CheckboxField
                    label="严格数字三级标题（防 3.5万元 / 2026.4月 误判）"
                    checked={config.parser.strictNumericHeading3}
                    onChange={(v) => patch({ parser: { strictNumericHeading3: v } })}
                  />
                </div>
              </div>
              <p className="settings-hint">如需针对个别段落微调识别类型，可点击编辑区顶部「结构标注」手动指定。</p>
            </section>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="settings-tab-stack">
            <section className="settings-section">
              <h3 className="settings-section-title">GB/T 9704—2012 核心排版参数速查</h3>
              <div className="settings-spec-table-wrap">
                <table className="settings-spec-table">
                  <thead>
                    <tr>
                      <th>要素</th>
                      <th>标准规定</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>用纸与版心</td><td>A4 (210×297mm)；天头 37mm / 订口 28mm / 版心 156×225mm</td></tr>
                    <tr><td>版面行数</td><td>一般每面 22 行、每行 28 字（约 28.9pt 固定行距）</td></tr>
                    <tr><td>公文标题</td><td>2 号小标宋体居中，红色分隔线下空二行</td></tr>
                    <tr><td>正文与层级</td><td>3 号仿宋；一、黑体 /（一）楷体 / 1. 仿宋 /（1）仿宋</td></tr>
                    <tr><td>印章与日期</td><td>加盖印章：日期右空四字；不加盖：空一行、日期右空二字</td></tr>
                    <tr><td>版记与页码</td><td>4 号仿宋（0.35mm/0.25mm 线）；页码 4 号宋体单右双左距底 7mm</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">项目信息与离线版</h3>
              <div className="settings-panel settings-about-panel">
                <div className="settings-about-links">
                  <div>
                    <span className="settings-field-label">开源仓库：</span>
                    <a href={PROJECT_INFO.repoUrl} target="_blank" rel="noopener noreferrer">{PROJECT_INFO.repoUrl}</a>
                  </div>
                  <div>
                    <span className="settings-field-label">单文件离线版：</span>
                    <a
                      href="https://github.com/hehecat/gongwen/releases/latest/download/gongwen.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      下载 gongwen.html（双击即用）
                    </a>
                    {' · '}
                    <a href={PROJECT_INFO.releasesUrl} target="_blank" rel="noopener noreferrer">
                      全部 Releases
                    </a>
                  </div>
                  <div>
                    <span className="settings-field-label">联系作者：</span>
                    <a href={`mailto:${PROJECT_INFO.authorEmail}`}>{PROJECT_INFO.authorEmail}</a>
                  </div>
                </div>

                {PROJECT_INFO.recentUpdates.length > 0 && (
                  <div className="settings-about-updates">
                    <span className="settings-field-label">近期更新记录</span>
                    <ul>
                      {PROJECT_INFO.recentUpdates.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="settings-about-donate">
                  <span className="settings-field-label">打赏支持作者</span>
                  <div className="settings-donate-row">
                    {DONATION_QR_CODES.map((qr) => (
                      <figure key={qr.label} className="settings-donate-card">
                        <img className="settings-donate-image" src={qr.src} alt={`${qr.label}收款码`} />
                        <figcaption>{qr.label}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="settings-footer">
        {confirmReset ? (
          <div className="settings-footer-confirm">
            <span>确认恢复所有设置为 GB/T 9704 国标默认？</span>
            <button
              type="button"
              className="settings-btn settings-btn--danger"
              onClick={() => {
                resetConfig()
                setConfirmReset(false)
              }}
            >
              确认重置
            </button>
            <button
              type="button"
              className="settings-btn settings-btn--ghost"
              onClick={() => setConfirmReset(false)}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="settings-btn settings-btn--ghost settings-btn--danger-text"
            onClick={() => setConfirmReset(true)}
          >
            恢复国标默认
          </button>
        )}
        <button type="button" className="settings-btn settings-btn--primary" onClick={onClose}>
          完成
        </button>
      </div>
    </aside>
  )
}
