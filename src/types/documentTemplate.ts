import type { DocumentConfig } from './documentConfig'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  config: DocumentConfig
  createdAt: string
  updatedAt: string
}

export interface ActiveTemplateMetadata {
  templateId: string
  templateName: string
  appliedAt: string
  configSignature: string
}

export interface RecentTemplateUsageEntry {
  templateId: string
  appliedAt: string
}

export interface RecentTemplateItem {
  template: DocumentTemplate
  appliedAt: string
}

export interface TemplateStyleSummary {
  fontFamily: string
  auxiliaryFontFamily?: string
  fontSizeLabel: string
  lineSpacingLabel: string
  firstLineIndentLabel?: string
}

export interface TemplateHeadingStyleSummary {
  levelLabel: string
  fontFamily: string
  fontSizeLabel: string
}

export interface TemplateSummary {
  titleStyle: TemplateStyleSummary
  bodyStyle: TemplateStyleSummary
  headingStyles: TemplateHeadingStyleSummary[]
  featureTags: string[]
}

export interface ImportedDocumentTemplateDraft {
  name: string
  description: string
  config: DocumentConfig
  createdAt: string
  updatedAt: string
}

export interface ImportedDocumentTemplateCollectionDraft {
  templates: ImportedDocumentTemplateDraft[]
}

export interface DocumentTemplatePayloadItem {
  name: string
  description?: string
  createdAt?: string
  updatedAt?: string
  config: DocumentConfig
}

export interface DocumentTemplateExportPayload {
  source: 'gongwen-document-template'
  schemaVersion: number
  exportedAt: string
  template: DocumentTemplatePayloadItem
}

export interface DocumentTemplateCollectionExportPayload {
  source: 'gongwen-document-templates'
  schemaVersion: number
  exportedAt: string
  templates: DocumentTemplatePayloadItem[]
}
