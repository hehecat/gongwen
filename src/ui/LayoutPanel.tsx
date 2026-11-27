import { useMemo, useRef, useState } from 'react'
import {
  DOCUMENT_FORMAT_OPTIONS,
  FONT_OPTIONS,
  PAGE_NUMBER_STYLE_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
  type DocumentFormat,
  type HeaderOrgAlign,
  type HeaderSeparatorStyle,
  type PageNumberStyle,
} from '../types/documentConfig'
import type { RecentTemplateItem } from '../types/documentTemplate'
import type { BuiltinTemplate } from '../utils/builtinTemplates'
import { convertFileToSupportedDataUrl } from '../utils/imageConversion'
import {
  CollapsibleSection,
  NumberStepper,
  SegmentedControl,
  SelectField,
  SwitchField,
} from './FormControls'
import {
  ImageSealIcon,
  PlusIcon,
  SwatchTemplateIcon,
  TrashIcon,
} from './icons'
import { formatTodayChineseDate } from './nodeMeta'

interface LayoutPanelProps {
  config: DocumentConfig
  updateConfig: (patch: DeepPartial<DocumentConfig>) => void
  builtinTemplates: BuiltinTemplate[]
  activeBuiltinId: string | null
  onApplyBuiltin: (preset: BuiltinTemplate) => void
  activePresetLabel: string
  isPresetModified: boolean
  commonTemplates: RecentTemplateItem[]
  activeCustomTemplateId: string | null
  onApplyCustomTemplate: (templateId: string) => void
  onOpenTemplateModal: (mode?: 'list' | 'create') => void
  customFonts: string[]
  onNotifyError: (msg: string) => void
  onNotifySuccess: (msg: string) => void
}

export function LayoutPanel({
  config,
  updateConfig,
  builtinTemplates,
  activeBuiltinId,
  onApplyBuiltin,
  activePresetLabel,
  isPresetModified,
  commonTemplates,
  activeCustomTemplateId,
  onApplyCustomTemplate,
  onOpenTemplateModal,
  customFonts,
  onNotifyError,
  onNotifySuccess,
}: LayoutPanelProps) {
  const [uploadingImage, setUploadingImage] = useState(false)
  const redheadInputRef = useRef<HTMLInputElement | null>(null)

  const mergedFontOptions = useMemo(() => {
    const existingValues = new Set(FONT_OPTIONS.map((f) => f.value))
    const extras = customFonts
      .filter((name) => !existingValues.has(name))
      .map((name) => ({ label: `${name}（本机）`, value: name }))
    return [...FONT_OPTIONS, ...extras]
  }, [customFonts])

  const handleUploadRedheadImage = async (file: File | undefined) => {
    if (!file) return
    setUploadingImage(true)
    try {
      const dataUrl = await convertFileToSupportedDataUrl(file)
      updateConfig({ header: { enabled: true, customImageDataUrl: dataUrl } })
      onNotifySuccess('已载入自定义红头版头图片')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '红头图片读取失败'
      onNotifyError(msg)
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="cb-panel-scroll">
      {/* 当前版式模板 & 快捷预设卡片 */}
      <div className="cb-tpl-quick-card">
        <div className="cb-tpl-quick-top">
          <div className="cb-tpl-quick-meta">
            <span className="cb-tpl-quick-label">当前版式模板</span>
            <div className="cb-tpl-quick-name-row">
              <span className="cb-tpl-quick-name" title={activePresetLabel}>
                {activePresetLabel}
              </span>
              {isPresetModified && <span className="cb-tpl-dirty-badge">已微调</span>}
            </div>
          </div>
          <div className="cb-quick-presets-actions">
            <button
              type="button"
              className="cb-link-btn"
              onClick={() => onOpenTemplateModal('create')}
            >
              <PlusIcon size={12} />
              <span>存为模板</span>
            </button>
            <span className="cb-foot-dot">·</span>
            <button
              type="button"
              className="cb-link-btn"
              onClick={() => onOpenTemplateModal('list')}
            >
              <SwatchTemplateIcon size={12} />
              <span>模板库</span>
            </button>
          </div>
        </div>

        <div className="cb-preset-chips">
          {builtinTemplates.map((preset) => {
            const active = preset.id === activeBuiltinId
            return (
              <button
                key={preset.id}
                type="button"
                className={`cb-preset-chip${active ? ' is-active' : ''}`}
                title={preset.description}
                onClick={() => onApplyBuiltin(preset)}
              >
                {preset.name.replace(/^GB\/T 9704 /, '').replace(/（.*?）/, '')}
              </button>
            )
          })}
        </div>

        {commonTemplates.length > 0 && (
          <>
            <div className="cb-divider" />
            <div className="cb-field">
              <span className="cb-tpl-quick-label">常用 / 置顶自定义模板</span>
              <div className="cb-preset-chips">
                {commonTemplates.map((item) => {
                  const active =
                    item.template.id === activeCustomTemplateId && !isPresetModified
                  return (
                    <button
                      key={item.template.id}
                      type="button"
                      className={`cb-preset-chip${active ? ' is-active' : ''}`}
                      title={item.template.description || item.template.name}
                      onClick={() => onApplyCustomTemplate(item.template.id)}
                    >
                      {item.template.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 1. 版头与红头要素 */}
      <CollapsibleSection
        title="版头与红头要素"
        defaultOpen
        meta={
          <>
            <span
              className={`cb-section-badge${config.header.enabled ? ' is-accent' : ''}`}
            >
              {config.header.enabled ? '已开启' : '关闭'}
            </span>
            <SwitchField
              checked={config.header.enabled}
              onChange={(enabled) => updateConfig({ header: { enabled } })}
            />
          </>
        }
      >
        <div className="cb-fields-stack">
          {!config.header.enabled ? (
            <div className="cb-hint-banner">
              当前已关闭红头版头（适合普通通知或内部材料）。开启右侧开关即可配置红头、发文字号与签发人。
            </div>
          ) : (
            <>
              {!config.header.orgName.trim()
                && !config.header.customImageDataUrl.trim() && (
                  <div className="cb-hint-banner">
                    请填写下方「发文机关标志」文字（或上传自定义红头图片），红头版头即可在首页上方渲染。
                  </div>
                )}

              <div className="cb-field">
                <label className="cb-label">公文版式（GB/T 9704 §7 / §10）</label>
                <div className="cb-format-grid">
                  {DOCUMENT_FORMAT_OPTIONS.map((opt) => {
                    const active = config.header.format === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`cb-format-card${active ? ' is-active' : ''}`}
                        onClick={() =>
                          updateConfig({
                            header: { enabled: true, format: opt.value as DocumentFormat },
                          })
                        }
                      >
                        <span className="cb-format-card-name">{opt.label}</span>
                        <span className="cb-format-card-desc">{opt.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="cb-field">
                <div className="cb-field-label-row">
                  <label className="cb-label">发文机关标志（支持多行联合行文）</label>
                  <input
                    ref={redheadInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    className="cb-sr-only"
                    onChange={(e) => {
                      void handleUploadRedheadImage(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    className="cb-link-btn"
                    disabled={uploadingImage}
                    onClick={() => redheadInputRef.current?.click()}
                  >
                    <ImageSealIcon size={12.5} />
                    <span>{uploadingImage ? '转换中…' : '上传红头图'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  className="cb-input cb-input--textarea"
                  placeholder="例如：XX市人民政府办公厅文件（多行可回车联合行文）"
                  value={config.header.orgName}
                  onChange={(e) => updateConfig({ header: { orgName: e.target.value } })}
                />
              </div>

              {config.header.customImageDataUrl.trim() !== '' && (
                <div className="cb-redhead-img-box">
                  <div className="cb-redhead-img-preview">
                    <img src={config.header.customImageDataUrl} alt="自定义红头预览" />
                  </div>
                  <div className="cb-field-row">
                    <span className="cb-label">图片高度</span>
                    <div className="cb-inline-controls">
                      <NumberStepper
                        ariaLabel="红头图片高度毫米"
                        value={config.header.customImageHeightMm}
                        min={12}
                        max={90}
                        step={1}
                        unit="mm"
                        onChange={(customImageHeightMm) =>
                          updateConfig({ header: { customImageHeightMm } })
                        }
                      />
                      <button
                        type="button"
                        className="cb-icon-danger-btn"
                        title="清除自定义红头图片，恢复文字红头"
                        onClick={() => updateConfig({ header: { customImageDataUrl: '' } })}
                      >
                        <TrashIcon size={13.5} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="cb-grid-2">
                <div className="cb-field">
                  <label className="cb-label">右侧居中缀字</label>
                  <input
                    type="text"
                    className="cb-input"
                    placeholder="联合行文如：文件"
                    value={config.header.orgNameSuffix}
                    onChange={(e) =>
                      updateConfig({ header: { orgNameSuffix: e.target.value } })
                    }
                  />
                </div>
                <div className="cb-field">
                  <label className="cb-label">标志对齐</label>
                  <SegmentedControl<HeaderOrgAlign>
                    size="sm"
                    fullWidth
                    value={config.header.orgNameAlign}
                    onChange={(orgNameAlign) =>
                      updateConfig({ header: { orgNameAlign } })
                    }
                    options={[
                      { value: 'center', label: '居中' },
                      { value: 'distribute', label: '分散对齐' },
                    ]}
                  />
                </div>
              </div>

              <div className="cb-field">
                <label className="cb-label">标志字体</label>
                <SelectField
                  ariaLabel="发文机关标志字体"
                  value={config.header.orgNameFontFamily}
                  options={mergedFontOptions}
                  onChange={(orgNameFontFamily) =>
                    updateConfig({ header: { orgNameFontFamily } })
                  }
                />
              </div>

              <div className="cb-grid-2">
                <div className="cb-field">
                  <label className="cb-label">标志字号</label>
                  <NumberStepper
                    ariaLabel="发文机关标志字号"
                    value={config.header.orgNameFontSize}
                    min={16}
                    max={72}
                    step={1}
                    unit="pt"
                    onChange={(orgNameFontSize) =>
                      updateConfig({ header: { orgNameFontSize } })
                    }
                  />
                </div>
                <div className="cb-field">
                  <label className="cb-label">附加字距</label>
                  <NumberStepper
                    ariaLabel="发文机关标志附加字距"
                    value={config.header.orgNameLetterSpacing}
                    min={0}
                    max={24}
                    step={0.5}
                    unit="pt"
                    onChange={(orgNameLetterSpacing) =>
                      updateConfig({ header: { orgNameLetterSpacing } })
                    }
                  />
                </div>
              </div>

              <div className="cb-grid-2">
                <div className="cb-field">
                  <label className="cb-label">发文字号（§7.2.5）</label>
                  <input
                    type="text"
                    className="cb-input"
                    placeholder="国办发〔2026〕1号"
                    value={config.header.docNumber}
                    onChange={(e) =>
                      updateConfig({ header: { docNumber: e.target.value } })
                    }
                  />
                </div>
                <div className="cb-field">
                  <label className="cb-label">签发人（上行文）</label>
                  <input
                    type="text"
                    className="cb-input"
                    placeholder="多人用顿号分隔"
                    value={config.header.signer}
                    onChange={(e) => updateConfig({ header: { signer: e.target.value } })}
                  />
                </div>
              </div>

              {config.header.format !== 'command' && config.header.format !== 'minutes' && (
                <div className="cb-grid-3">
                  <div className="cb-field">
                    <label className="cb-label">份号</label>
                    <input
                      type="text"
                      className="cb-input cb-tabular"
                      placeholder="000001"
                      value={config.header.copyNumber}
                      onChange={(e) =>
                        updateConfig({ header: { copyNumber: e.target.value } })
                      }
                    />
                  </div>
                  <div className="cb-field">
                    <label className="cb-label">密级期限</label>
                    <input
                      type="text"
                      className="cb-input"
                      placeholder="秘密★1年"
                      value={config.header.secretLevel}
                      onChange={(e) =>
                        updateConfig({ header: { secretLevel: e.target.value } })
                      }
                    />
                  </div>
                  <div className="cb-field">
                    <label className="cb-label">紧急程度</label>
                    <input
                      type="text"
                      className="cb-input"
                      placeholder="特急 / 加急"
                      value={config.header.urgency}
                      onChange={(e) => updateConfig({ header: { urgency: e.target.value } })}
                    />
                  </div>
                </div>
              )}

              {config.header.format !== 'letter' && config.header.format !== 'command' && (
                <div className="cb-field">
                  <label className="cb-label">红色分隔线样式（§7.2.7）</label>
                  <SegmentedControl<HeaderSeparatorStyle>
                    size="sm"
                    fullWidth
                    value={config.header.separatorStyle}
                    onChange={(separatorStyle) =>
                      updateConfig({ header: { separatorStyle } })
                    }
                    options={[
                      { value: 'solid', label: '单红线' },
                      { value: 'star', label: '红星红线 ★' },
                      { value: 'none', label: '无分隔线' },
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. 末页版记 */}
      <CollapsibleSection
        title="末页版记（§7.4）"
        defaultOpen={config.footerNote.enabled}
        meta={
          <>
            <span
              className={`cb-section-badge${config.footerNote.enabled ? ' is-accent' : ''}`}
            >
              {config.footerNote.enabled ? '已开启' : '关闭'}
            </span>
            <SwitchField
              checked={config.footerNote.enabled}
              onChange={(enabled) => updateConfig({ footerNote: { enabled } })}
            />
          </>
        }
      >
        <div className="cb-fields-stack">
          {!config.footerNote.enabled ? (
            <div className="cb-hint-banner">
              末页版记锚定在公文最后一页版心最下方（GB/T 9704 §7.4）。需要抄送或印发信息时请开启。
            </div>
          ) : (
            <>
              <div className="cb-field">
                <label className="cb-label">移至版记的主送机关（§7.4.2 置于抄送之上）</label>
                <input
                  type="text"
                  className="cb-input"
                  placeholder="主送机关过多无法首页显示正文时填写"
                  value={config.footerNote.mainRecipient}
                  onChange={(e) =>
                    updateConfig({ footerNote: { mainRecipient: e.target.value } })
                  }
                />
              </div>
              <div className="cb-field">
                <label className="cb-label">抄送机关</label>
                <input
                  type="text"
                  className="cb-input"
                  placeholder="如：市委办公室，市人大常委会办公室（自动补句号）"
                  value={config.footerNote.cc}
                  onChange={(e) => updateConfig({ footerNote: { cc: e.target.value } })}
                />
              </div>
              {config.header.format !== 'letter' && (
                <div className="cb-grid-2">
                  <div className="cb-field">
                    <label className="cb-label">印发机关</label>
                    <input
                      type="text"
                      className="cb-input"
                      placeholder="如：XX市政府办公厅"
                      value={config.footerNote.printer}
                      onChange={(e) =>
                        updateConfig({ footerNote: { printer: e.target.value } })
                      }
                    />
                  </div>
                  <div className="cb-field">
                    <div className="cb-field-label-row">
                      <label className="cb-label">印发日期</label>
                      <button
                        type="button"
                        className="cb-link-btn"
                        onClick={() =>
                          updateConfig({
                            footerNote: { printDate: formatTodayChineseDate() },
                          })
                        }
                      >
                        今日
                      </button>
                    </div>
                    <input
                      type="text"
                      className="cb-input cb-tabular"
                      placeholder="2026年11月27日"
                      value={config.footerNote.printDate}
                      onChange={(e) =>
                        updateConfig({ footerNote: { printDate: e.target.value } })
                      }
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>

      {/* 3. 印章、签名章与页码 */}
      <CollapsibleSection title="印章、签名章与页码" defaultOpen>
        <div className="cb-fields-stack">
          <SwitchField
            label="加盖印章排布（§7.3.5）"
            description={
              config.specialOptions.hasStamp
                ? '已开启：成文日期右空四字，署名居中对齐（§7.3.5.1）'
                : '未开启：署名右空二字，成文日期错位排布（§7.3.5.2）'
            }
            checked={config.specialOptions.hasStamp}
            onChange={(hasStamp) => updateConfig({ specialOptions: { hasStamp } })}
          />

          <div className="cb-grid-2">
            <div className="cb-field">
              <label className="cb-label">签名章职务（命令/决定）</label>
              <input
                type="text"
                className="cb-input"
                placeholder="如：市长（留空不显示）"
                value={config.specialOptions.signerTitle}
                onChange={(e) =>
                  updateConfig({ specialOptions: { signerTitle: e.target.value } })
                }
              />
            </div>
            <div className="cb-field">
              <label className="cb-label">签名章姓名</label>
              <input
                type="text"
                className="cb-input"
                placeholder="如：李明（楷体排印）"
                value={config.specialOptions.signerStampName}
                onChange={(e) =>
                  updateConfig({ specialOptions: { signerStampName: e.target.value } })
                }
              />
            </div>
          </div>

          <div className="cb-divider" />

          <SwitchField
            label="显示页码（§7.5 四号半角一字线）"
            description="位于版心下 7mm，格式为 — 1 —"
            checked={config.specialOptions.showPageNumber}
            onChange={(showPageNumber) =>
              updateConfig({ specialOptions: { showPageNumber } })
            }
          />

          {config.specialOptions.showPageNumber && (
            <div className="cb-grid-2">
              <div className="cb-field">
                <label className="cb-label">页码排布</label>
                <SegmentedControl<PageNumberStyle>
                  size="sm"
                  fullWidth
                  value={config.specialOptions.pageNumberStyle}
                  onChange={(pageNumberStyle) =>
                    updateConfig({ specialOptions: { pageNumberStyle } })
                  }
                  options={PAGE_NUMBER_STYLE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.value === 'mirrored' ? '单右双左' : '全居中',
                    title: o.label,
                  }))}
                />
              </div>
              <div className="cb-field">
                <label className="cb-label">页码字体</label>
                <SelectField
                  ariaLabel="页码字体"
                  value={config.specialOptions.pageNumberFont}
                  options={mergedFontOptions}
                  onChange={(pageNumberFont) =>
                    updateConfig({ specialOptions: { pageNumberFont } })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}
