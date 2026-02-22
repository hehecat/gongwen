import { useState, type ChangeEvent } from 'react'
import { useDocumentConfig } from '../../contexts/DocumentConfigContext'
import {
  FONT_OPTIONS,
  ASCII_FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_SPACING_OPTIONS,
  INDENT_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
} from '../../types/documentConfig'
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

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, updateConfig, resetConfig } = useDocumentConfig()
  const [showAdvanced, setShowAdvanced] = useState(false)

  const patch = (p: DeepPartial<DocumentConfig>) => updateConfig(p)

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部 */}
        <div className="settings-header">
          <h2 className="settings-title">格式设置</h2>
          <button className="settings-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {/* 内容区 */}
        <div className="settings-body">
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
            <h3 className="settings-section-title">公文标题</h3>
            <div className="settings-grid settings-grid--3">
              <SelectField
                label="字体"
                value={config.title.fontFamily}
                options={FONT_OPTIONS}
                onChange={(v) => patch({ title: { fontFamily: v } })}
              />
              <SelectField
                label="字号"
                value={config.title.fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ title: { fontSize: Number(v) } })}
              />
              <SelectField
                label="行距"
                value={config.title.lineSpacing}
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ title: { lineSpacing: Number(v) } })}
              />
            </div>
          </section>

          {/* 区块 3: 各级标题字体 */}
          <section className="settings-section">
            <h3 className="settings-section-title">各级标题</h3>
            <div className="settings-grid settings-grid--2">
              <SelectField
                label="一级标题字体"
                value={config.headings.h1.fontFamily}
                options={FONT_OPTIONS}
                onChange={(v) => patch({ headings: { h1: { fontFamily: v } } })}
              />
              <SelectField
                label="一级标题字号"
                value={config.headings.h1.fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ headings: { h1: { fontSize: Number(v) } } })}
              />
              <SelectField
                label="二级标题字体"
                value={config.headings.h2.fontFamily}
                options={FONT_OPTIONS}
                onChange={(v) => patch({ headings: { h2: { fontFamily: v } } })}
              />
              <SelectField
                label="二级标题字号"
                value={config.headings.h2.fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ headings: { h2: { fontSize: Number(v) } } })}
              />
            </div>
          </section>

          {/* 区块 4: 正文格式 */}
          <section className="settings-section">
            <h3 className="settings-section-title">正文格式</h3>
            <div className="settings-grid settings-grid--2">
              <SelectField
                label="字体"
                value={config.body.fontFamily}
                options={FONT_OPTIONS}
                onChange={(v) => patch({ body: { fontFamily: v } })}
              />
              <SelectField
                label="字号"
                value={config.body.fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ body: { fontSize: Number(v) } })}
              />
              <SelectField
                label="行距"
                value={config.body.lineSpacing}
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ body: { lineSpacing: Number(v) } })}
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

          {/* 区块 5: 表格格式（预留） */}
          <section className="settings-section">
            <h3 className="settings-section-title">
              表格格式 <span className="settings-tag">预留</span>
            </h3>
            <div className="settings-grid settings-grid--2">
              <SelectField
                label="字体"
                value={config.table.fontFamily}
                options={FONT_OPTIONS}
                onChange={(v) => patch({ table: { fontFamily: v } })}
              />
              <SelectField
                label="字号"
                value={config.table.fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ table: { fontSize: Number(v) } })}
              />
              <SelectField
                label="行距"
                value={config.table.lineSpacing}
                options={LINE_SPACING_OPTIONS}
                onChange={(v) => patch({ table: { lineSpacing: Number(v) } })}
              />
              <CheckboxField
                label="表头加粗"
                checked={config.table.boldHeader}
                onChange={(v) => patch({ table: { boldHeader: v } })}
              />
            </div>
          </section>

          {/* 区块 6: 特殊选项 */}
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
                  <SelectField
                    label="页码字体"
                    value={config.specialOptions.pageNumberFont}
                    options={FONT_OPTIONS}
                    onChange={(v) => patch({ specialOptions: { pageNumberFont: v } })}
                  />
                </div>
              )}
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
                      <SelectField
                        label="中文字体"
                        value={config.advanced[key].fontFamily}
                        options={FONT_OPTIONS}
                        onChange={(v) =>
                          patch({ advanced: { [key]: { fontFamily: v } } })
                        }
                      />
                      <SelectField
                        label="英数字体"
                        value={config.advanced[key].asciiFontFamily}
                        options={ASCII_FONT_OPTIONS}
                        onChange={(v) =>
                          patch({ advanced: { [key]: { asciiFontFamily: v } } })
                        }
                      />
                      <SelectField
                        label="字号"
                        value={config.advanced[key].fontSize}
                        options={FONT_SIZE_OPTIONS}
                        onChange={(v) =>
                          patch({ advanced: { [key]: { fontSize: Number(v) } } })
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
