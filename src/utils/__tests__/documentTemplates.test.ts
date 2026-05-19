import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../types/documentConfig'
import type {
  DocumentTemplate,
  ImportedDocumentTemplateDraft,
  RecentTemplateUsageEntry,
} from '../../types/documentTemplate'
import {
    DOCUMENT_TEMPLATE_COLLECTION_SOURCE,
    DOCUMENT_TEMPLATE_SCHEMA_VERSION,
    DOCUMENT_TEMPLATE_SOURCE,
    buildCommonTemplateItems,
    buildDocumentTemplateCollectionExportPayload,
    buildRecentTemplateItems,
    buildTemplateSummary,
    getDocumentConfigSignature,
    mergeRecentTemplateUsageEntries,
    parseDocumentTemplateCollectionJson,
    parseDocumentTemplateJson,
    sortTemplatesByPinnedState,
    splitImportedTemplateCollection,
    suggestUniqueTemplateName,
} from '../documentTemplates'

describe('documentTemplates', () => {
  it('creates a stable signature for equivalent configs', () => {
    const reorderedConfig = {
      footerNote: { ...DEFAULT_CONFIG.footerNote },
      header: { ...DEFAULT_CONFIG.header },
      specialOptions: { ...DEFAULT_CONFIG.specialOptions },
      advanced: { ...DEFAULT_CONFIG.advanced },
      body: { ...DEFAULT_CONFIG.body },
      title: { ...DEFAULT_CONFIG.title },
      margins: { ...DEFAULT_CONFIG.margins },
    }

    expect(getDocumentConfigSignature(DEFAULT_CONFIG)).toBe(
      getDocumentConfigSignature(reorderedConfig),
    )
  })

  it('suggests a unique template name with numeric suffix', () => {
    expect(suggestUniqueTemplateName('市政府模板', ['市政府模板', '市政府模板（2）'])).toBe(
      '市政府模板（3）',
    )
  })

  it('builds collection export payload and summary for templates', () => {
    const template: DocumentTemplate = {
      id: 'tpl-1',
      name: '通用模板',
      description: '适用于常规通知',
      config: DEFAULT_CONFIG,
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:00.000Z',
    }

    const payload = buildDocumentTemplateCollectionExportPayload([template])
    const summary = buildTemplateSummary(DEFAULT_CONFIG)

    expect(payload.source).toBe(DOCUMENT_TEMPLATE_COLLECTION_SOURCE)
    expect(payload.schemaVersion).toBe(DOCUMENT_TEMPLATE_SCHEMA_VERSION)
    expect(payload.templates).toHaveLength(1)
    expect(payload.templates[0].name).toBe('通用模板')
    expect(summary.titleStyle.fontFamily).toBe('方正小标宋_GBK')
    expect(summary.bodyStyle.auxiliaryFontFamily).toBe('Times New Roman')
    expect(summary.headingStyles[0].levelLabel).toBe('一级')
    expect(summary.featureTags).toContain('页码: 开启 (国标)')
  })

  it('parses single template payload and normalizes legacy config', () => {
    const raw = JSON.stringify({
      source: DOCUMENT_TEMPLATE_SOURCE,
      schemaVersion: 1,
      template: {
        name: '旧版模板',
        description: '兼容历史导出',
        config: {
          title: {
            fontFamily: '方正小标宋简体',
            fontSize: 22,
            lineSpacing: 18,
          },
          body: {
            fontFamily: '仿宋',
            fontSize: 16,
            lineSpacing: 18,
            firstLineIndent: 2,
          },
          headings: {
            h1: {
              fontFamily: '黑体',
              fontSize: 18,
            },
            h2: {
              fontFamily: '楷体',
              fontSize: 17,
            },
          },
        },
      },
    })

    const parsed = parseDocumentTemplateJson(raw, '2026-05-19T12:00:00.000Z')

    expect(parsed.name).toBe('旧版模板')
    expect(parsed.description).toBe('兼容历史导出')
    expect(parsed.config.advanced.h1.fontFamily).toBe('黑体')
    expect(parsed.config.advanced.h2.fontFamily).toBe('楷体')
    expect(parsed.config.title.lineSpacing).toBe(22)
    expect(parsed.config.body.lineSpacing).toBe(18)
    expect(parsed.config.body.asciiFontFamily).toBe('Times New Roman')
  })

  it('parses collection payload and preserves all templates', () => {
    const raw = JSON.stringify({
      source: DOCUMENT_TEMPLATE_COLLECTION_SOURCE,
      schemaVersion: 1,
      templates: [
        {
          name: '模板 A',
          description: '第一个模板',
          config: DEFAULT_CONFIG,
        },
        {
          name: '模板 B',
          description: '第二个模板',
          config: {
            ...DEFAULT_CONFIG,
            body: {
              ...DEFAULT_CONFIG.body,
              fontFamily: '宋体',
            },
          },
        },
      ],
    })

    const parsed = parseDocumentTemplateCollectionJson(raw, '2026-05-19T12:00:00.000Z')

    expect(parsed.templates).toHaveLength(2)
    expect(parsed.templates[0].name).toBe('模板 A')
    expect(parsed.templates[1].config.body.fontFamily).toBe('宋体')
  })

  it('splits imported collection by skipping existing and duplicate names', () => {
    const existingTemplates: DocumentTemplate[] = [
      {
        id: 'tpl-1',
        name: '模板 A',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
    ]
    const importedDrafts: ImportedDocumentTemplateDraft[] = [
      {
        name: '模板 A',
        description: '重名',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
      {
        name: '模板 B',
        description: '可导入',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
      {
        name: '模板 B',
        description: '文件内重复',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
    ]

    const result = splitImportedTemplateCollection(existingTemplates, importedDrafts)

    expect(result.acceptedDrafts).toHaveLength(1)
    expect(result.acceptedDrafts[0].name).toBe('模板 B')
    expect(result.skippedNames).toEqual(['模板 A', '模板 B'])
  })

  it('builds recent template list from latest apply order', () => {
    const templates: DocumentTemplate[] = [
      {
        id: 'tpl-1',
        name: '模板 A',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
      {
        id: 'tpl-2',
        name: '模板 B',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
      {
        id: 'tpl-3',
        name: '模板 C',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T00:00:00.000Z',
      },
    ]
    const usageEntries: RecentTemplateUsageEntry[] = mergeRecentTemplateUsageEntries(
      mergeRecentTemplateUsageEntries(
        [
          { templateId: 'tpl-1', appliedAt: '2026-05-19T08:00:00.000Z' },
        ],
        'tpl-2',
        '2026-05-19T09:00:00.000Z',
      ),
      'tpl-1',
      '2026-05-19T10:00:00.000Z',
    )

    const recentItems = buildRecentTemplateItems(templates, usageEntries, 5)

    expect(recentItems.map((item) => item.template.id)).toEqual(['tpl-1', 'tpl-2'])
    expect(recentItems[0].appliedAt).toBe('2026-05-19T10:00:00.000Z')
  })

  it('sorts pinned templates before the normal updated-time order', () => {
    const templates: DocumentTemplate[] = [
      {
        id: 'tpl-1',
        name: '模板 A',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T08:00:00.000Z',
      },
      {
        id: 'tpl-2',
        name: '模板 B',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T10:00:00.000Z',
      },
      {
        id: 'tpl-3',
        name: '模板 C',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T09:00:00.000Z',
      },
    ]

    const sortedTemplates = sortTemplatesByPinnedState(templates, ['tpl-1', 'tpl-3'])

    expect(sortedTemplates.map((template) => template.id)).toEqual(['tpl-1', 'tpl-3', 'tpl-2'])
  })

  it('builds common template list with pinned templates first and fills remaining slots', () => {
    const templates: DocumentTemplate[] = [
      {
        id: 'tpl-1',
        name: '模板 A',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T08:00:00.000Z',
      },
      {
        id: 'tpl-2',
        name: '模板 B',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T07:00:00.000Z',
      },
      {
        id: 'tpl-3',
        name: '模板 C',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T06:00:00.000Z',
      },
      {
        id: 'tpl-4',
        name: '模板 D',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T05:00:00.000Z',
      },
    ]
    const usageEntries: RecentTemplateUsageEntry[] = [
      { templateId: 'tpl-3', appliedAt: '2026-05-19T11:00:00.000Z' },
      { templateId: 'tpl-2', appliedAt: '2026-05-19T10:00:00.000Z' },
    ]

    const commonItems = buildCommonTemplateItems(templates, usageEntries, ['tpl-1'], 3)

    expect(commonItems.map((item) => item.template.id)).toEqual(['tpl-1', 'tpl-3', 'tpl-2'])
  })

  it('shows all templates in common list when the total count is below the limit', () => {
    const templates: DocumentTemplate[] = [
      {
        id: 'tpl-1',
        name: '模板 A',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T08:00:00.000Z',
      },
      {
        id: 'tpl-2',
        name: '模板 B',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T10:00:00.000Z',
      },
      {
        id: 'tpl-3',
        name: '模板 C',
        description: '',
        config: DEFAULT_CONFIG,
        createdAt: '2026-05-19T00:00:00.000Z',
        updatedAt: '2026-05-19T09:00:00.000Z',
      },
    ]

    const commonItems = buildCommonTemplateItems(templates, [], ['tpl-1'], 6)

    expect(commonItems.map((item) => item.template.id)).toEqual(['tpl-1', 'tpl-2', 'tpl-3'])
  })

  it('rejects unsupported future schema versions', () => {
    expect(() => parseDocumentTemplateCollectionJson(JSON.stringify({
      source: DOCUMENT_TEMPLATE_COLLECTION_SOURCE,
      schemaVersion: DOCUMENT_TEMPLATE_SCHEMA_VERSION + 1,
      templates: [
        {
          name: '未来模板',
          config: DEFAULT_CONFIG,
        },
      ],
    }))).toThrow('模板版本过高')
  })
})
