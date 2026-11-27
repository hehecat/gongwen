import { useState } from 'react'
import { useDocumentConfig } from '../../contexts/useDocumentConfig'
import { useCustomFonts } from '../../hooks/useCustomFonts'
import {
  ASCII_FONT_OPTIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  INDENT_OPTIONS,
  LINE_SPACING_OPTIONS,
  PAGE_NUMBER_STYLE_OPTIONS,
  type DeepPartial,
  type DocumentConfig,
  type PageNumberStyle,
} from '../../types/documentConfig'
import {
  STANDARD_MARGIN_BOTTOM_CM,
  STANDARD_MARGIN_LEFT_CM,
  STANDARD_MARGIN_RIGHT_CM,
  STANDARD_MARGIN_TOP_CM,
} from '../../layout/constants'
import { FontSelectField } from './fields/FontSelectField'
import {
  AccordionCard,
  CheckboxField,
  NumberField,
  NumberInputField,
  SelectField,
  SwitchPill,
  TextField,
} from './fields/FormFields'

export type TypoSectionId = 'margins' | 'titleBody' | 'headings' | 'sealPage' | 'sanitize'

interface TypographyTabProps {
  openSection: TypoSectionId | null
  onToggleSection: (id: TypoSectionId) => void
}

const INDENT_SELECT_OPTIONS = INDENT_OPTIONS.map((opt) => ({
  ...opt,
  label: String(opt.value),
}))

const FONT_SIZE_MIN = 8
const FONT_SIZE_MAX = 72
const LINE_SPACING_MIN = 10
const LINE_SPACING_MAX = 120

export function TypographyTab({ openSection, onToggleSection }: TypographyTabProps) {
  const { config, updateConfig, resetConfig } = useDocumentConfig()
  const { customFonts, addFont, removeFont } = useCustomFonts()
  const [expandedMap, setExpandedMap] = useState<Record<TypoSectionId, boolean>>({
    margins: true,
    titleBody: true,
    headings: false,
    sealPage: false,
    sanitize: false,
  })
  const [confirmReset, setConfirmReset] = useState(false)

  const patch = (p: DeepPartial<DocumentConfig>) => updateConfig(p)

  const isOpen = (id: TypoSectionId) => openSection === id || expandedMap[id]
  const toggle = (id: TypoSectionId) => {
    onToggleSection(id)
    setExpandedMap((prev) => ({ ...prev, [id]: !isOpen(id) }))
  }

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

  return (
    <div className="insp-stack">
      {/* 1. 页面与版心 */}
      <AccordionCard
        title="页面与版心"
        expanded={isOpen('margins')}
        onToggle={() => toggle('margins')}
        headerAction={(
          <button
            type="button"
            className="insp-link-btn"
            onClick={() => patch({
              margins: {
                top: STANDARD_MARGIN_TOP_CM,
                bottom: STANDARD_MARGIN_BOTTOM_CM,
                left: STANDARD_MARGIN_LEFT_CM,
                right: STANDARD_MARGIN_RIGHT_CM,
              },
            })}
            title="恢复 GB/T 9704 §5.2.1 默认边距"
          >
            恢复国标
          </button>
        )}
      >
        <div className="insp-grid-2">
          <NumberField label="上边距（天头）" value={config.margins.top} unit="cm" onChange={(v) => patch({ margins: { top: v } })} />
          <NumberField label="下边距（地脚）" value={config.margins.bottom} unit="cm" onChange={(v) => patch({ margins: { bottom: v } })} />
          <NumberField label="左边距（订口）" value={config.margins.left} unit="cm" onChange={(v) => patch({ margins: { left: v } })} />
          <NumberField label="右边距" value={config.margins.right} unit="cm" onChange={(v) => patch({ margins: { right: v } })} />
        </div>
      </AccordionCard>

      {/* 2. 标题与正文 */}
      <AccordionCard
        title="标题与正文"
        expanded={isOpen('titleBody')}
        onToggle={() => toggle('titleBody')}
      >
        <div className="insp-subhead">公文标题（§7.3.1 默认 2 号小标宋）</div>
        <FontSelectField
          label="标题字体"
          value={config.title.fontFamily}
          {...fontFieldProps}
          onChange={(v) => patch({ title: { fontFamily: v } })}
        />
        <div className="insp-grid-2">
          <NumberInputField
            label="标题字号"
            value={config.title.fontSize}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            unit="pt"
            options={FONT_SIZE_OPTIONS}
            onChange={(v) => patch({ title: { fontSize: v, lineSpacing: Math.max(config.title.lineSpacing, v) } })}
          />
          <NumberInputField
            label="标题行距"
            value={config.title.lineSpacing}
            min={titleLineSpacingMin}
            max={LINE_SPACING_MAX}
            unit="磅"
            options={LINE_SPACING_OPTIONS}
            onChange={(v) => patch({ title: { lineSpacing: v } })}
          />
        </div>

        <div className="insp-divider" />

        <div className="insp-subhead">正文格式（§5.2.2 默认 3 号仿宋）</div>
        <div className="insp-grid-2">
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
        </div>
        <div className="insp-grid-2">
          <NumberInputField
            label="正文字号"
            value={config.body.fontSize}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            unit="pt"
            options={FONT_SIZE_OPTIONS}
            onChange={(v) => patch({ body: { fontSize: v, lineSpacing: Math.max(config.body.lineSpacing, v) } })}
          />
          <NumberInputField
            label="正文行距"
            value={config.body.lineSpacing}
            min={bodyLineSpacingMin}
            max={LINE_SPACING_MAX}
            unit="磅"
            options={LINE_SPACING_OPTIONS}
            onChange={(v) => patch({ body: { lineSpacing: v } })}
          />
        </div>
        <SelectField
          label="首行缩进"
          unit="字符"
          value={config.body.firstLineIndent}
          options={INDENT_SELECT_OPTIONS}
          onChange={(v) => patch({ body: { firstLineIndent: Number(v) } })}
        />
        <p className="insp-hint">正文行距同步应用于各级标题、附注、附件与落款日期。</p>
      </AccordionCard>

      {/* 3. 一至三级标题 */}
      <AccordionCard
        title="一至三级标题"
        expanded={isOpen('headings')}
        onToggle={() => toggle('headings')}
      >
        <div className="insp-check-list">
          <CheckboxField
            label="正文段落首句加粗"
            checked={config.specialOptions.boldFirstSentence}
            onChange={(v) => patch({ specialOptions: { boldFirstSentence: v } })}
          />
          <CheckboxField
            label="二级标题（楷体）加粗"
            checked={config.specialOptions.boldHeading2}
            onChange={(v) => patch({ specialOptions: { boldHeading2: v } })}
          />
          <CheckboxField
            label="三级小标题（首句）加粗"
            checked={config.specialOptions.boldHeading3}
            onChange={(v) => patch({ specialOptions: { boldHeading3: v } })}
          />
        </div>

        {(
          [
            ['h1', '一级标题（默认黑体）'],
            ['h2', '二级标题（默认楷体）'],
            ['h3', '三级标题（默认仿宋）'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="insp-heading-block">
            <div className="insp-subhead">{label}</div>
            <div className="insp-grid-2">
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
            </div>
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
        ))}
      </AccordionCard>

      {/* 4. 印章落款与页码 */}
      <AccordionCard
        title="印章落款与页码"
        expanded={isOpen('sealPage')}
        onToggle={() => toggle('sealPage')}
      >
        <div className="insp-subhead">成文日期与印章位置</div>
        <div className="insp-seal-cards">
          <button
            type="button"
            className={`insp-seal-card ${sealMode === 'none' ? 'insp-seal-card--active' : ''}`}
            onClick={() => patch({ specialOptions: { hasStamp: false, signerTitle: '', signerStampName: '' } })}
          >
            <strong>不加盖印章</strong>
            <span>§7.3.5.2 空一行，日期右空二字</span>
          </button>
          <button
            type="button"
            className={`insp-seal-card ${sealMode === 'stamp' ? 'insp-seal-card--active' : ''}`}
            onClick={() => patch({ specialOptions: { hasStamp: true, signerTitle: '', signerStampName: '' } })}
          >
            <strong>加盖公章</strong>
            <span>§7.3.5.1 空二行，日期右空四字</span>
          </button>
          <button
            type="button"
            className={`insp-seal-card ${sealMode === 'signerStamp' ? 'insp-seal-card--active' : ''}`}
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
          <div className="insp-grid-2">
            <TextField
              label="签发人职务"
              value={config.specialOptions.signerTitle}
              placeholder="如：市长"
              onChange={(v) => patch({ specialOptions: { signerTitle: v } })}
            />
            <TextField
              label="签名章姓名"
              value={config.specialOptions.signerStampName}
              placeholder="如：张三"
              onChange={(v) => patch({ specialOptions: { signerStampName: v } })}
            />
          </div>
        )}

        <div className="insp-divider" />

        <div className="insp-section-head">
          <span className="insp-subhead">页码样式（§7.5）</span>
          <SwitchPill
            label="显示页码"
            checked={config.specialOptions.showPageNumber}
            onChange={(next) => patch({ specialOptions: { showPageNumber: next } })}
          />
        </div>

        {config.specialOptions.showPageNumber && (
          <>
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
          </>
        )}
      </AccordionCard>

      {/* 5. 标点净化与解析规则 */}
      <AccordionCard
        title="标点净化与解析规则"
        expanded={isOpen('sanitize')}
        onToggle={() => toggle('sanitize')}
        headerAction={(
          <SwitchPill
            label="启用自动净化"
            checked={config.sanitize.enabled}
            onChange={(next) => patch({ sanitize: { enabled: next } })}
          />
        )}
      >
        <p className="insp-hint insp-hint--top">
          仅作用于预览与导出，不改写左侧原文；URL、邮箱、时间与千分位数字自动受保护。
        </p>
        <div className="insp-check-list">
          <CheckboxField
            label="半角标点转全角（，。：；（）？！）"
            checked={config.sanitize.convertPunctuation}
            onChange={(v) => patch({ sanitize: { convertPunctuation: v } })}
          />
          <CheckboxField
            label="半角双引号转中文“”"
            checked={config.sanitize.convertQuotes}
            onChange={(v) => patch({ sanitize: { convertQuotes: v } })}
          />
          <CheckboxField
            label="清理多余空格与连续空行"
            checked={config.sanitize.cleanWhitespace}
            onChange={(v) => patch({ sanitize: { cleanWhitespace: v } })}
          />
          <CheckboxField
            label="发文字号括号规范为〔〕"
            checked={config.sanitize.normalizeDocNumberBrackets}
            onChange={(v) => patch({ sanitize: { normalizeDocNumberBrackets: v } })}
          />
        </div>

        <div className="insp-divider" />
        <div className="insp-subhead">结构解析规则</div>
        <div className="insp-check-list">
          <CheckboxField
            label="行首「一是/二要」识别为三级标题"
            checked={config.parser.recognizeChineseThreeLevel}
            onChange={(v) => patch({ parser: { recognizeChineseThreeLevel: v } })}
          />
          <CheckboxField
            label="严格数字三级标题（防 3.5万元 误判）"
            checked={config.parser.strictNumericHeading3}
            onChange={(v) => patch({ parser: { strictNumericHeading3: v } })}
          />
        </div>
      </AccordionCard>

      {/* 底部：恢复全部国标默认 */}
      <div className="insp-reset-bar">
        {confirmReset ? (
          <div className="insp-reset-confirm">
            <span>确认恢复所有格式为 GB/T 9704 默认？</span>
            <div className="insp-inline-actions">
              <button
                type="button"
                className="insp-mini-btn"
                onClick={() => setConfirmReset(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="insp-mini-btn insp-mini-btn--danger-solid"
                onClick={() => {
                  resetConfig()
                  setConfirmReset(false)
                }}
              >
                确认重置
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="insp-reset-btn"
            onClick={() => setConfirmReset(true)}
          >
            恢复全部 GB/T 9704 国标默认
          </button>
        )}
      </div>
    </div>
  )
}
