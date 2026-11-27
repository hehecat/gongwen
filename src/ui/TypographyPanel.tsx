import { useMemo, useState } from 'react'
import {
  ASCII_FONT_OPTIONS,
  DEFAULT_CONFIG,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  INDENT_OPTIONS,
  LINE_SPACING_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
} from '../types/documentConfig'
import {
  CollapsibleSection,
  NumberStepper,
  SelectField,
  SwitchField,
} from './FormControls'
import {
  CloseIcon,
  PlusIcon,
  RotateResetIcon,
  SparkCleanIcon,
} from './icons'

interface TypographyPanelProps {
  config: DocumentConfig
  updateConfig: (patch: DeepPartial<DocumentConfig>) => void
  onResetConfig: () => void
  customFonts: string[]
  onAddCustomFont: (name: string) => void
  onRemoveCustomFont: (name: string) => void
  sanitizeCount: number
  onCommitSanitizedToRaw: () => void
  onNotifySuccess: (msg: string) => void
}

export function TypographyPanel({
  config,
  updateConfig,
  onResetConfig,
  customFonts,
  onAddCustomFont,
  onRemoveCustomFont,
  sanitizeCount,
  onCommitSanitizedToRaw,
  onNotifySuccess,
}: TypographyPanelProps) {
  const [newFontName, setNewFontName] = useState('')

  const mergedFontOptions = useMemo(() => {
    const existingValues = new Set(FONT_OPTIONS.map((f) => f.value))
    const extras = customFonts
      .filter((name) => !existingValues.has(name))
      .map((name) => ({ label: `${name}（本机）`, value: name }))
    return [...FONT_OPTIONS, ...extras]
  }, [customFonts])

  const mergedAsciiOptions = useMemo(() => {
    const existingValues = new Set(ASCII_FONT_OPTIONS.map((f) => f.value))
    const extras = customFonts
      .filter((name) => !existingValues.has(name))
      .map((name) => ({ label: `${name}（本机）`, value: name }))
    return [...ASCII_FONT_OPTIONS, ...extras]
  }, [customFonts])

  const marginsModified =
    config.margins.top !== DEFAULT_CONFIG.margins.top
    || config.margins.bottom !== DEFAULT_CONFIG.margins.bottom
    || config.margins.left !== DEFAULT_CONFIG.margins.left
    || config.margins.right !== DEFAULT_CONFIG.margins.right

  const handleAddFontSubmit = () => {
    const trimmed = newFontName.trim()
    if (!trimmed) return
    onAddCustomFont(trimmed)
    setNewFontName('')
    onNotifySuccess(`已添加本机字体「${trimmed}」`)
  }

  return (
    <div className="cb-panel-scroll">
      {/* 1. 页面边距与版心 */}
      <CollapsibleSection
        title="页面边距与版心"
        defaultOpen
        meta={
          <span className={`cb-section-badge cb-tabular${!marginsModified ? ' is-accent' : ''}`}>
            {marginsModified ? '自定义' : '国标 22×28'}
          </span>
        }
      >
        <div className="cb-fields-stack">
          <div className="cb-grid-2">
            <div className="cb-field">
              <label className="cb-label">天头（上）</label>
              <NumberStepper
                ariaLabel="上边距厘米"
                value={config.margins.top}
                min={0.5}
                max={8}
                step={0.1}
                unit="cm"
                onChange={(top) => updateConfig({ margins: { top } })}
              />
            </div>
            <div className="cb-field">
              <label className="cb-label">下白边（下）</label>
              <NumberStepper
                ariaLabel="下边距厘米"
                value={config.margins.bottom}
                min={0.5}
                max={8}
                step={0.1}
                unit="cm"
                onChange={(bottom) => updateConfig({ margins: { bottom } })}
              />
            </div>
            <div className="cb-field">
              <label className="cb-label">订口（左）</label>
              <NumberStepper
                ariaLabel="左边距厘米"
                value={config.margins.left}
                min={0.5}
                max={8}
                step={0.1}
                unit="cm"
                onChange={(left) => updateConfig({ margins: { left } })}
              />
            </div>
            <div className="cb-field">
              <label className="cb-label">右白边（右）</label>
              <NumberStepper
                ariaLabel="右边距厘米"
                value={config.margins.right}
                min={0.5}
                max={8}
                step={0.1}
                unit="cm"
                onChange={(right) => updateConfig({ margins: { right } })}
              />
            </div>
          </div>

          {marginsModified && (
            <div className="cb-margins-reset-row cb-tabular">
              <span>国标标准：上 3.7 · 下 3.5 · 左 2.8 · 右 2.6 cm</span>
              <button
                type="button"
                className="cb-link-btn"
                onClick={() => updateConfig({ margins: { ...DEFAULT_CONFIG.margins } })}
              >
                还原边距
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* 2. 标题与正文 */}
      <CollapsibleSection title="标题与正文字型" defaultOpen>
        <div className="cb-fields-stack">
          <div className="cb-level-card">
            <div className="cb-level-card-head">
              <span className="cb-level-card-title">公文标题</span>
              <span className="cb-level-card-sample">二号小标宋居中</span>
            </div>
            <div className="cb-field">
              <label className="cb-label">标题字体</label>
              <SelectField
                ariaLabel="公文标题字体"
                value={config.title.fontFamily}
                options={mergedFontOptions}
                onChange={(fontFamily) => updateConfig({ title: { fontFamily } })}
              />
            </div>
            <div className="cb-grid-2">
              <div className="cb-field">
                <label className="cb-label">标题字号</label>
                <SelectField
                  ariaLabel="公文标题字号"
                  value={config.title.fontSize}
                  options={FONT_SIZE_OPTIONS}
                  onChange={(v) => updateConfig({ title: { fontSize: Number(v) } })}
                />
              </div>
              <div className="cb-field">
                <label className="cb-label">标题固定行距</label>
                <NumberStepper
                  ariaLabel="公文标题固定行距"
                  value={config.title.lineSpacing}
                  min={16}
                  max={56}
                  step={0.5}
                  unit="磅"
                  onChange={(lineSpacing) => updateConfig({ title: { lineSpacing } })}
                />
              </div>
            </div>
          </div>

          <div className="cb-level-card">
            <div className="cb-level-card-head">
              <span className="cb-level-card-title">正文段落</span>
              <span className="cb-level-card-sample cb-tabular">三号仿宋 · 28.9 磅</span>
            </div>
            <div className="cb-grid-2">
              <div className="cb-field">
                <label className="cb-label">中文字体</label>
                <SelectField
                  ariaLabel="正文中文字体"
                  value={config.body.fontFamily}
                  options={mergedFontOptions}
                  onChange={(fontFamily) => updateConfig({ body: { fontFamily } })}
                />
              </div>
              <div className="cb-field">
                <label className="cb-label">西文与数字</label>
                <SelectField
                  ariaLabel="正文英数字体"
                  value={config.body.asciiFontFamily}
                  options={mergedAsciiOptions}
                  onChange={(asciiFontFamily) =>
                    updateConfig({ body: { asciiFontFamily } })
                  }
                />
              </div>
            </div>
            <div className="cb-grid-2">
              <div className="cb-field">
                <label className="cb-label">正文字号</label>
                <SelectField
                  ariaLabel="正文字号"
                  value={config.body.fontSize}
                  options={FONT_SIZE_OPTIONS}
                  onChange={(v) => updateConfig({ body: { fontSize: Number(v) } })}
                />
              </div>
              <div className="cb-field">
                <label className="cb-label">首行缩进</label>
                <SelectField
                  ariaLabel="正文首行缩进"
                  value={config.body.firstLineIndent}
                  options={INDENT_OPTIONS}
                  onChange={(v) => updateConfig({ body: { firstLineIndent: Number(v) } })}
                />
              </div>
            </div>
            <div className="cb-field">
              <div className="cb-field-label-row">
                <label className="cb-label">正文固定行距（支持 0.1 磅孤行微调）</label>
                {config.body.lineSpacing !== 28.9 && (
                  <button
                    type="button"
                    className="cb-link-btn cb-tabular"
                    onClick={() => updateConfig({ body: { lineSpacing: 28.9 } })}
                  >
                    恢复 28.9 磅
                  </button>
                )}
              </div>
              <div className="cb-grid-2">
                <SelectField
                  ariaLabel="常用行距预设"
                  value={config.body.lineSpacing}
                  options={LINE_SPACING_OPTIONS}
                  onChange={(v) => updateConfig({ body: { lineSpacing: Number(v) } })}
                />
                <NumberStepper
                  ariaLabel="正文精确行距"
                  value={config.body.lineSpacing}
                  min={16}
                  max={48}
                  step={0.1}
                  unit="磅"
                  onChange={(lineSpacing) => updateConfig({ body: { lineSpacing } })}
                />
              </div>
            </div>
            <SwitchField
              label="正文首句自动加粗"
              description="将每段第一句（至首个句号/冒号/问号）加粗突出"
              checked={config.specialOptions.boldFirstSentence}
              onChange={(boldFirstSentence) =>
                updateConfig({ specialOptions: { boldFirstSentence } })
              }
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* 3. 一至三级标题字型 */}
      <CollapsibleSection title="一至三级标题字型" defaultOpen={false}>
        <div className="cb-fields-stack">
          {(
            [
              { key: 'h1', title: '一级标题', sample: '一、二、三、' },
              { key: 'h2', title: '二级标题', sample: '（一）（二）' },
              { key: 'h3', title: '三级标题', sample: '1. 2. / 一是、二要' },
            ] as const
          ).map(({ key, title, sample }) => {
            const elem = config.advanced[key]
            return (
              <div key={key} className="cb-level-card">
                <div className="cb-level-card-head">
                  <span className="cb-level-card-title">{title}</span>
                  <span className="cb-level-card-sample">{sample}</span>
                </div>
                <div className="cb-grid-2">
                  <div className="cb-field">
                    <label className="cb-label">中文字体</label>
                    <SelectField
                      ariaLabel={`${title}中文字体`}
                      value={elem.fontFamily}
                      options={mergedFontOptions}
                      onChange={(fontFamily) =>
                        updateConfig({ advanced: { [key]: { fontFamily } } })
                      }
                    />
                  </div>
                  <div className="cb-field">
                    <label className="cb-label">西文字体</label>
                    <SelectField
                      ariaLabel={`${title}西文字体`}
                      value={elem.asciiFontFamily}
                      options={mergedAsciiOptions}
                      onChange={(asciiFontFamily) =>
                        updateConfig({ advanced: { [key]: { asciiFontFamily } } })
                      }
                    />
                  </div>
                </div>
                <div className="cb-field">
                  <label className="cb-label">字号</label>
                  <SelectField
                    ariaLabel={`${title}字号`}
                    value={elem.fontSize}
                    options={FONT_SIZE_OPTIONS}
                    onChange={(v) =>
                      updateConfig({
                        advanced: { [key]: { fontSize: Number(v) } },
                      })
                    }
                  />
                </div>
                {key === 'h2' && (
                  <SwitchField
                    label="二级标题加粗"
                    checked={config.specialOptions.boldHeading2}
                    onChange={(boldHeading2) =>
                      updateConfig({ specialOptions: { boldHeading2 } })
                    }
                  />
                )}
                {key === 'h3' && (
                  <SwitchField
                    label="三级标题加粗"
                    checked={config.specialOptions.boldHeading3}
                    onChange={(boldHeading3) =>
                      updateConfig({ specialOptions: { boldHeading3 } })
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      </CollapsibleSection>

      {/* 4. 自定义系统字体 */}
      <CollapsibleSection
        title="自定义系统字体"
        defaultOpen={false}
        meta={
          customFonts.length > 0 ? (
            <span className="cb-section-badge cb-tabular">{customFonts.length} 个</span>
          ) : undefined
        }
      >
        <div className="cb-fields-stack">
          <div className="cb-field">
            <label className="cb-label">添加本机已安装字体（写入导出 Word 字体名）</label>
            <div className="cb-font-adder">
              <input
                type="text"
                className="cb-input"
                placeholder="如：方正公文仿宋 / 思源宋体"
                value={newFontName}
                onChange={(e) => setNewFontName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddFontSubmit()
                  }
                }}
              />
              <button
                type="button"
                className="cb-ctrl-btn cb-ctrl-btn--secondary"
                disabled={!newFontName.trim()}
                onClick={handleAddFontSubmit}
              >
                <PlusIcon size={13} />
                <span>添加</span>
              </button>
            </div>
            {customFonts.length > 0 && (
              <div className="cb-custom-font-tags">
                {customFonts.map((font) => (
                  <span key={font} className="cb-font-tag">
                    <span>{font}</span>
                    <button
                      type="button"
                      aria-label={`移除字体 ${font}`}
                      onClick={() => onRemoveCustomFont(font)}
                    >
                      <CloseIcon size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* 5. 标点净化与结构解析 */}
      <CollapsibleSection
        title="标点净化与结构解析"
        defaultOpen={false}
        meta={
          <span
            className={`cb-section-badge${config.sanitize.enabled ? ' is-accent' : ''}`}
          >
            {config.sanitize.enabled ? '自动净化' : '已暂停'}
          </span>
        }
      >
        <div className="cb-fields-stack">
          <SwitchField
            label="自动标点与空白净化"
            description="实时修正半角标点、直引号、多余空行及发文字号六角括号"
            checked={config.sanitize.enabled}
            onChange={(enabled) => updateConfig({ sanitize: { enabled } })}
          />
          {config.sanitize.enabled && (
            <div className="cb-sanitize-sublist">
              <SwitchField
                label="转换中文半角标点（，。：；！？）"
                checked={config.sanitize.convertPunctuation}
                onChange={(convertPunctuation) =>
                  updateConfig({ sanitize: { convertPunctuation } })
                }
              />
              <SwitchField
                label="成对转换中文双引号（“ ”）"
                checked={config.sanitize.convertQuotes}
                onChange={(convertQuotes) =>
                  updateConfig({ sanitize: { convertQuotes } })
                }
              />
              <SwitchField
                label="清理行首尾空白与超量空行"
                checked={config.sanitize.cleanWhitespace}
                onChange={(cleanWhitespace) =>
                  updateConfig({ sanitize: { cleanWhitespace } })
                }
              />
              <SwitchField
                label="规范发文字号六角括号〔〕"
                checked={config.sanitize.normalizeDocNumberBrackets}
                onChange={(normalizeDocNumberBrackets) =>
                  updateConfig({ sanitize: { normalizeDocNumberBrackets } })
                }
              />
            </div>
          )}

          {sanitizeCount > 0 && (
            <button
              type="button"
              className="cb-ctrl-btn cb-ctrl-btn--secondary cb-full-btn cb-tabular"
              onClick={onCommitSanitizedToRaw}
            >
              <SparkCleanIcon size={13.5} />
              <span>将 {sanitizeCount} 处净化结果写回编辑器原文</span>
            </button>
          )}

          <div className="cb-divider" />

          <div className="cb-subhead">层次结构识别引擎</div>
          <SwitchField
            label="识别「一是 / 二要」为三级标题"
            description="开启后将行首“一是…”“二要…”按三级标题字型与加粗规则编排"
            checked={config.parser.recognizeChineseThreeLevel}
            onChange={(recognizeChineseThreeLevel) =>
              updateConfig({ parser: { recognizeChineseThreeLevel } })
            }
          />
          <SwitchField
            label="严格数字三级标题识别"
            description="防止“3.5万元”“2026.4”等小数或年月在行首被误判为三级标题"
            checked={config.parser.strictNumericHeading3}
            onChange={(strictNumericHeading3) =>
              updateConfig({ parser: { strictNumericHeading3 } })
            }
          />
        </div>
      </CollapsibleSection>

      {/* 底部恢复默认按钮 */}
      <div className="cb-panel-bottom-reset">
        <button
          type="button"
          className="cb-ctrl-btn cb-ctrl-btn--ghost cb-full-btn"
          onClick={onResetConfig}
        >
          <RotateResetIcon size={13.5} />
          <span>恢复 GB/T 9704—2012 默认参数</span>
        </button>
      </div>
    </div>
  )
}
