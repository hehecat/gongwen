import { useState, type ChangeEvent } from 'react'
import { useDocumentConfig } from '../../contexts/DocumentConfigContext'
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

/** 保存配置弹窗组件 */
function SaveConfigDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onConfirm(name.trim())
    }
  }

  return (
    <div className="settings-dialog-overlay" onClick={onCancel}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="settings-dialog-header">
            <h3 className="settings-dialog-title">保存配置</h3>
          </div>
          <div className="settings-dialog-body">
            <label className="settings-field">
              <span className="settings-field-label">配置名称</span>
              <input
                type="text"
                className="settings-input"
                value={name}
                placeholder="请输入配置名称"
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
          </div>
          <div className="settings-dialog-footer">
            <button type="button" className="settings-btn settings-btn--cancel" onClick={onCancel}>
              取消
            </button>
            <button
              type="submit"
              className="settings-btn settings-btn--save"
              disabled={!name.trim()}
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    config,
    savedConfigs,
    activeConfigId,
    updateConfig,
    switchConfig,
    saveAsCustomConfig,
    saveCurrentConfig,
    deleteCustomConfig,
  } = useDocumentConfig()
  const { customFonts, addFont, removeFont } = useCustomFonts()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showMarginHint, setShowMarginHint] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  const patch = (p: DeepPartial<DocumentConfig>) => updateConfig(p)

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

  /** 处理保存配置 */
  const handleSaveConfig = (name: string) => {
    saveAsCustomConfig(name)
    setShowSaveDialog(false)
  }

  /** 处理删除配置 */
  const handleDeleteConfig = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteCustomConfig(id)
  }

  /** 处理保存当前修改 */
  const handleSaveCurrentConfig = () => {
    saveCurrentConfig()
    setShowSaveSuccess(true)
    setTimeout(function () {
      setShowSaveSuccess(false)
    }, 2000)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        {/* 顶部 */}
        <div className="settings-header">
          <div className="settings-header-left">
            <h2 className="settings-title">设置</h2>
            <div className="settings-tabs">
              <button
                className={'settings-tab' + (activeConfigId === null ? ' settings-tab--active' : '')}
                onClick={() => switchConfig(null)}
              >
                公文规范配置
              </button>
              {savedConfigs.map(function (cfg) {
                return (
                  <button
                    key={cfg.id}
                    className={'settings-tab' + (activeConfigId === cfg.id ? ' settings-tab--active' : '')}
                    onClick={() => switchConfig(cfg.id)}
                  >
                    <span className="settings-tab-name">{cfg.name}</span>
                    <span
                      className="settings-tab-delete"
                      onClick={(e) => handleDeleteConfig(cfg.id, e)}
                      title="删除此配置"
                    >
                      x
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <button className="settings-close" onClick={onClose} aria-label="关闭">
            x
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
            <div className="settings-margin-hint">
              <button
                className="settings-margin-hint-toggle"
                onClick={() => setShowMarginHint(!showMarginHint)}
              >
                <span className="settings-margin-hint-icon">!</span>
                <span>关于页面上下边距设置的规范说明</span>
                <span className={'settings-margin-hint-arrow' + (showMarginHint ? ' settings-margin-hint-arrow--open' : '')}>v</span>
              </button>
              {showMarginHint && (
                <div className="settings-margin-hint-content">
                  <p>GB/T 9704-2012 规定公文用纸天头（上白边）为37mm，此为纸张上边缘至版心上边缘的距离。</p>
                  <p>部分用户将办公软件中的"上边距"设置为37mm，这与规范要求存在偏差。办公软件中的"上边距"是指版心上边缘至纸张上边缘的距离减去页眉高度后的剩余值。</p>
                  <p>为规范电子公文格式，GB/T 33476.2-2016《党政机关电子公文格式规范 第2部分：显现》明确规定：</p>
                  <ul>
                    <li>上边距：34.58mm</li>
                    <li>下边距：32.58mm</li>
                  </ul>
                  <p>建议按照 GB/T 33476.2-2016 的参数设置页面边距。</p>
                </div>
              )}
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
              <FontSelectField
                label="一级标题字体"
                value={config.headings.h1.fontFamily}
                {...fontFieldProps}
                onChange={(v) => patch({ headings: { h1: { fontFamily: v } } })}
              />
              <SelectField
                label="一级标题字号"
                value={config.headings.h1.fontSize}
                options={FONT_SIZE_OPTIONS}
                onChange={(v) => patch({ headings: { h1: { fontSize: Number(v) } } })}
              />
              <FontSelectField
                label="二级标题字体"
                value={config.headings.h2.fontFamily}
                {...fontFieldProps}
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
              <FontSelectField
                label="字体"
                value={config.body.fontFamily}
                {...fontFieldProps}
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
              <FontSelectField
                label="字体"
                value={config.table.fontFamily}
                {...fontFieldProps}
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
              <span className={'settings-arrow' + (showAdvanced ? ' settings-arrow--open' : '')}>
                &gt;
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
                ).map(function ([key, label]) {
                  return (
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
                  )
                })}
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
          <button
            className="settings-btn settings-btn--primary"
            onClick={() => setShowSaveDialog(true)}
          >
            另存为自定义配置
          </button>
          <button
            className="settings-btn settings-btn--primary"
            disabled={activeConfigId === null}
            title={activeConfigId === null ? '公文规范配置不可修改，请另存为新配置' : ''}
            onClick={handleSaveCurrentConfig}
          >
            保存当前修改
          </button>
          <div className="settings-footer-spacer" />
          <button className="settings-btn settings-btn--close" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {/* 保存成功提示 */}
      {showSaveSuccess && (
        <div className="settings-toast">
          保存成功
        </div>
      )}

      {/* 保存配置弹窗 */}
      {showSaveDialog && (
        <SaveConfigDialog
          onConfirm={handleSaveConfig}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}
