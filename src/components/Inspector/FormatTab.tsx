import { useState, type ChangeEvent } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useCustomFonts } from '../../hooks/useCustomFonts'
import type { useDocumentTemplates } from '../../hooks/useDocumentTemplates'
import {
  DOCUMENT_FORMAT_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
  type DocumentFormat,
  type HeaderOrgAlign,
  type HeaderSeparatorStyle,
} from '../../types/documentConfig'
import { normalizeDocNumberText } from '../../layout/typography'
import { BUILTIN_TEMPLATES } from '../../utils/builtinTemplates'
import { getDocumentConfigSignature } from '../../utils/documentTemplates'
import { FontSelectField } from './fields/FontSelectField'
import {
  AccordionCard,
  NumberField,
  NumberInputField,
  SelectField,
  SwitchPill,
  TextField,
} from './fields/FormFields'
import { convertFileToSupportedDataUrl } from './fields/imageConversion'

export type DocumentTemplateStore = ReturnType<typeof useDocumentTemplates>

interface FormatTabProps {
  templateStore: DocumentTemplateStore
  onApplyBuiltinTemplate: (templateId: string) => void
  onOpenTemplatesModal: (initialCreate?: boolean) => void
}

function getPresetLineVariant(presetId: string): 'solid' | 'star' | 'double' | 'none' {
  if (presetId === 'builtin-upward-signer') return 'star'
  if (presetId === 'builtin-letter') return 'double'
  if (presetId === 'builtin-plain-notice') return 'none'
  return 'solid'
}

function getPresetShortDesc(presetId: string): string {
  switch (presetId) {
    case 'builtin-standard-redhead':
      return '标准红头 · 版记页码'
    case 'builtin-upward-signer':
      return '签发人 · 红星线'
    case 'builtin-letter':
      return '170mm 双红线'
    case 'builtin-minutes':
      return '纪要版头 · 出席回行'
    case 'builtin-plain-notice':
      return '无版头与版记'
    default:
      return ''
  }
}

export function FormatTab({
  templateStore,
  onApplyBuiltinTemplate,
  onOpenTemplatesModal,
}: FormatTabProps) {
  const { config, updateConfig } = useDocumentConfig()
  const { customFonts, addFont, removeFont } = useCustomFonts()
  const [headerExpanded, setHeaderExpanded] = useState(true)
  const [headerAdvancedOpen, setHeaderAdvancedOpen] = useState(false)
  const [footerExpanded, setFooterExpanded] = useState(config.footerNote.enabled)
  const [imageError, setImageError] = useState('')
  const [imageWarning, setImageWarning] = useState('')

  const patch = (p: DeepPartial<DocumentConfig>) => updateConfig(p)
  const currentSignature = getDocumentConfigSignature(config)

  const fontFieldProps = {
    options: FONT_OPTIONS,
    customFonts,
    onAddCustomFont: addFont,
    onRemoveCustomFont: removeFont,
  }

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

  const quickTemplates = templateStore.templates.slice(0, 6)

  return (
    <div className="insp-stack">
      {/* 1. 国标版式预设 */}
      <section className="insp-section">
        <div className="insp-section-head">
          <span className="insp-section-label">国标版式预设</span>
          <button
            type="button"
            className="insp-link-btn"
            onClick={() => onOpenTemplatesModal(false)}
          >
            管理模板 ({templateStore.templateCount})
          </button>
        </div>

        <div className="insp-preset-list">
          {BUILTIN_TEMPLATES.map((preset) => {
            const isSelected = getDocumentConfigSignature(preset.config) === currentSignature
            const lineVariant = getPresetLineVariant(preset.id)
            return (
              <button
                key={preset.id}
                type="button"
                className={`insp-preset-row ${isSelected ? 'insp-preset-row--active' : ''}`}
                onClick={() => onApplyBuiltinTemplate(preset.id)}
                title={preset.description}
              >
                <span className={`insp-preset-mark insp-preset-mark--${lineVariant}`} aria-hidden="true">
                  {lineVariant === 'star' && <span className="insp-preset-mark-star">★</span>}
                </span>
                <span className="insp-preset-name">{preset.name}</span>
                <span className="insp-preset-meta">{getPresetShortDesc(preset.id)}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 2. 我的模板 */}
      <section className="insp-section">
        <div className="insp-section-head">
          <span className="insp-section-label">我的模板</span>
          <button
            type="button"
            className="insp-link-btn"
            onClick={() => onOpenTemplatesModal(true)}
          >
            + 保存当前
          </button>
        </div>

        {quickTemplates.length === 0 ? (
          <p className="insp-hint">
            暂无自定义模板，可点右上角保存当前设置。
          </p>
        ) : (
          <div className="insp-chip-wrap">
            {quickTemplates.map((tpl) => {
              const isCurrent = templateStore.activeTemplateMeta?.templateId === tpl.id
                || (!templateStore.activeTemplateMeta && templateStore.currentMatchingTemplate?.id === tpl.id)
              return (
                <button
                  key={tpl.id}
                  type="button"
                  className={`insp-tpl-item ${isCurrent ? 'insp-tpl-item--active' : ''}`}
                  onClick={() => templateStore.applyTemplate(tpl.id)}
                  title={tpl.description || `套用模板「${tpl.name}」`}
                >
                  {tpl.name}
                </button>
              )
            })}
            {templateStore.templates.length > quickTemplates.length && (
              <button
                type="button"
                className="insp-tpl-item insp-tpl-item--more"
                onClick={() => onOpenTemplatesModal(false)}
              >
                全部 {templateStore.templates.length} 项…
              </button>
            )}
          </div>
        )}
      </section>

      {/* 3. 版头要素 */}
      <AccordionCard
        title="版头要素"
        expanded={headerExpanded && config.header.enabled}
        onToggle={() => {
          if (!config.header.enabled) {
            patch({ header: { enabled: true } })
            setHeaderExpanded(true)
          } else {
            setHeaderExpanded((prev) => !prev)
          }
        }}
        headerAction={(
          <SwitchPill
            label="启用版头"
            checked={config.header.enabled}
            onChange={(next) => {
              patch({ header: { enabled: next } })
              if (next) setHeaderExpanded(true)
            }}
          />
        )}
      >
        <div className="insp-seg-4" role="group" aria-label="公文版式类型">
          {DOCUMENT_FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`insp-seg-btn ${config.header.format === opt.value ? 'insp-seg-btn--active' : ''}`}
              onClick={() => patch({ header: { format: opt.value as DocumentFormat } })}
              title={opt.description}
            >
              {opt.label.replace('（§10.1）', '').replace('（§10.2）', '').replace('（§10.3）', '').replace('格式', '')}
            </button>
          ))}
        </div>

        <label className="insp-field">
          <span className="insp-field-label">发文机关标志（换行可联合行文）</span>
          <textarea
            className="insp-textarea"
            rows={2}
            value={config.header.orgName}
            placeholder="如：XX市人民政府办公厅文件"
            onChange={(e) => patch({ header: { orgName: e.target.value } })}
          />
        </label>

        <TextField
          label={config.header.format === 'command' ? '令号（§10.2）' : '发文字号（§7.2.5）'}
          value={config.header.docNumber}
          placeholder={config.header.format === 'command' ? '如：第 777 号' : '如：X政办发〔2026〕1号'}
          onChange={(v) => patch({ header: { docNumber: v } })}
          action={
            config.header.docNumber.trim()
            && normalizeDocNumberText(config.header.docNumber) !== config.header.docNumber.trim() ? (
              <button
                type="button"
                className="insp-mini-link"
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

        <div className="insp-grid-2">
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
        </div>

        <div className="insp-grid-2">
          <SelectField
            label="排列方式"
            value={config.header.orgNameAlign}
            options={[
              { label: '居中排布', value: 'center' },
              { label: '分散对齐', value: 'distribute' },
            ]}
            onChange={(v) => patch({ header: { orgNameAlign: v as HeaderOrgAlign } })}
          />
          {config.header.format !== 'letter' && config.header.format !== 'command' ? (
            <SelectField
              label="分隔线样式"
              value={config.header.separatorStyle}
              options={[
                { label: '红单线（国标）', value: 'solid' },
                { label: '居中五角星 ★', value: 'star' },
                { label: '无分隔线', value: 'none' },
              ]}
              onChange={(v) => patch({ header: { separatorStyle: v as HeaderSeparatorStyle } })}
            />
          ) : (
            <TextField
              label="联合行文后缀"
              value={config.header.orgNameSuffix}
              placeholder="如：文件"
              onChange={(v) => patch({ header: { orgNameSuffix: v } })}
            />
          )}
        </div>

        {/* 更多版头细节子折叠 */}
        <button
          type="button"
          className="insp-sub-toggle"
          onClick={() => setHeaderAdvancedOpen((prev) => !prev)}
        >
          <span>{headerAdvancedOpen ? '▾' : '▸'}</span>
          <span>更多细节（密级 / 紧急 / 份号 / 自定义图片）</span>
        </button>

        {headerAdvancedOpen && (
          <div className="insp-sub-panel">
            {(config.header.format === 'standard' || config.header.format === 'letter') && (
              <>
                <div className="insp-grid-2">
                  <TextField
                    label="份号（§7.2.1）"
                    value={config.header.copyNumber}
                    placeholder="如：000001"
                    onChange={(v) => patch({ header: { copyNumber: v } })}
                  />
                  <TextField
                    label="紧急程度（§7.2.3）"
                    value={config.header.urgency}
                    placeholder="特急 / 加急"
                    onChange={(v) => patch({ header: { urgency: v } })}
                  />
                </div>
                <TextField
                  label="密级和保密期限（§7.2.2）"
                  value={config.header.secretLevel}
                  placeholder="如：秘密★1年"
                  onChange={(v) => patch({ header: { secretLevel: v } })}
                />
              </>
            )}

            <div className="insp-grid-2">
              {config.header.format !== 'letter' && config.header.format !== 'command' && (
                <TextField
                  label="联合行文后缀"
                  value={config.header.orgNameSuffix}
                  placeholder="如：文件"
                  onChange={(v) => patch({ header: { orgNameSuffix: v } })}
                />
              )}
              <NumberField
                label="标志附加字距"
                value={config.header.orgNameLetterSpacing}
                min={0}
                max={30}
                step={0.5}
                unit="pt"
                onChange={(v) => patch({ header: { orgNameLetterSpacing: v } })}
              />
            </div>

            <div className="insp-image-box">
              <div className="insp-section-head">
                <span className="insp-field-label">自定义图片版头</span>
                <div className="insp-inline-actions">
                  <label className="insp-mini-btn">
                    上传图片
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
                      className="insp-mini-btn insp-mini-btn--danger"
                      onClick={() => patch({ header: { customImageDataUrl: '' } })}
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
              {imageError && <p className="insp-error-text">{imageError}</p>}
              {imageWarning && <p className="insp-warn-text">{imageWarning}</p>}
              {config.header.customImageDataUrl && (
                <div className="insp-image-preview">
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
      </AccordionCard>

      {/* 4. 版记要素 */}
      <AccordionCard
        title="版记要素"
        expanded={footerExpanded && config.footerNote.enabled}
        onToggle={() => {
          if (!config.footerNote.enabled) {
            patch({ footerNote: { enabled: true } })
            setFooterExpanded(true)
          } else {
            setFooterExpanded((prev) => !prev)
          }
        }}
        headerAction={(
          <SwitchPill
            label="启用版记"
            checked={config.footerNote.enabled}
            onChange={(next) => {
              patch({ footerNote: { enabled: next } })
              if (next) setFooterExpanded(true)
            }}
          />
        )}
      >
        <TextField
          label="抄送机关（末位自动补句号）"
          value={config.footerNote.cc}
          placeholder="如：市委办公室，市政府各部门"
          onChange={(v) => patch({ footerNote: { cc: v } })}
        />
        {config.header.format !== 'letter' && (
          <div className="insp-grid-2">
            <TextField
              label="印发机关"
              value={config.footerNote.printer}
              placeholder="如：国务院办公厅"
              onChange={(v) => patch({ footerNote: { printer: v } })}
            />
            <TextField
              label="印发日期"
              value={config.footerNote.printDate}
              placeholder="2026年11月26日"
              onChange={(v) => patch({ footerNote: { printDate: v } })}
            />
          </div>
        )}
        <TextField
          label="移至版记的主送机关（可选）"
          value={config.footerNote.mainRecipient}
          placeholder="首页主送过多时填写"
          onChange={(v) => patch({ footerNote: { mainRecipient: v } })}
        />
      </AccordionCard>
    </div>
  )
}
