import type {
  BuilderRow,
  BuilderSection,
  BuilderTemplate,
  ColumnLayout,
  ConditionOperator,
  InlineElement,
  InlineElementType,
  RowType,
  SimpleFieldType,
  VisibleIfCondition,
} from './advanced-builder/builder-types'
import { countSentenceColumns, MAX_SENTENCE_COLUMNS } from '@wartungsprotokoll/shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

export type TemplateFormat = 'builder' | 'maintenance' | 'legacy' | 'invalid'

export class TemplateImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateImportError'
  }
}

export interface ImportTemplateResult {
  template: BuilderTemplate
  warnings: string[]
}

function uid(): string {
  return crypto.randomUUID().slice(0, 8)
}

function newFieldId(prefix = 'field'): string {
  return `${prefix}_${uid()}`
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  return match ? match[1].trim() : trimmed
}

/** Bereinigt typische Copilot-/Markdown-Artefakte vor JSON.parse */
export function sanitizeImportJsonText(raw: string): string {
  let text = stripMarkdownCodeFence(raw.trim())

  // Copilot escaped oft Klammern und Unterstriche (\[, \], \_)
  text = text.replace(/\\([[\]_])/g, '$1')

  // Manchmal doppelte Backslashes
  text = text.replace(/\\\\([[\]_])/g, '$1')

  // Ganzes JSON als String in Anführungszeichen: "{ ... }"
  if (text.startsWith('"') && text.endsWith('"')) {
    const inner = text.slice(1, -1)
    if (inner.trimStart().startsWith('{') || inner.trimStart().startsWith('[')) {
      text = inner.replace(/\\([[\]_"])/g, (_, ch) => (ch === '"' ? '"' : ch))
      text = text.replace(/\\([[\]_])/g, '$1')
    }
  }

  return text.trim()
}

export function parseTemplateJson(raw: string): unknown {
  const attempts = [raw.trim(), sanitizeImportJsonText(raw)]

  let lastError: unknown
  for (const candidate of attempts) {
    if (!candidate) continue
    try {
      let parsed: unknown = JSON.parse(candidate)
      // Doppelt serialisiert: JSON-String der JSON enthält
      if (typeof parsed === 'string') {
        const inner = sanitizeImportJsonText(parsed)
        parsed = JSON.parse(inner)
      }
      return parsed
    } catch (e) {
      lastError = e
    }
  }

  throw new TemplateImportError(
    'Ungültiges JSON – Syntaxfehler beim Parsen. ' +
      'Häufige Ursache: Copilot liefert escapte Klammern (\\[ \\]) oder das JSON in Anführungszeichen. ' +
      'Bitte nur reines JSON ohne Markdown einfügen.',
  )
}

export function detectTemplateFormat(obj: unknown): TemplateFormat {
  if (!obj || typeof obj !== 'object') return 'invalid'
  const def = obj as AnyRecord

  const sections = def.sections
  if (!Array.isArray(sections) || sections.length === 0) return 'invalid'

  if (sections.some((sec: AnyRecord) => Array.isArray(sec.items))) {
    return 'legacy'
  }

  const rows = sections[0]?.rows
  if (!Array.isArray(rows)) return 'invalid'

  if (rows.length === 0) {
    return def.title || def.templateKey ? 'maintenance' : 'builder'
  }

  const hasBuilderFieldIds = rows.some(
    (row: AnyRecord) => !!row.templateFieldId && row.type !== undefined,
  )
  const hasMaintenanceFieldIds = rows.some(
    (row: AnyRecord) => !!row.fieldId && !row.templateFieldId,
  )

  if (hasBuilderFieldIds) return 'builder'
  if (hasMaintenanceFieldIds || def.title || def.templateKey) return 'maintenance'

  return rows.some((row: AnyRecord) => !!row.templateFieldId) ? 'builder' : 'maintenance'
}

const LAYOUT_MAP: Record<string, ColumnLayout> = {
  single: 'single',
  single_column: 'single',
  'single-column': 'single',
  two_column: 'two-column',
  'two-column': 'two-column',
  two_column_40_60: 'two-column',
  two_column_60_40: 'two-column',
  three_column: 'three-column',
  'three-column': 'three-column',
  grid: 'grid',
  compact: 'compact',
  table_like: 'compact',
}

const OPERATOR_MAP: Record<string, ConditionOperator> = {
  eq: 'eq',
  equals: 'eq',
  neq: 'neq',
  notEquals: 'neq',
  checked: 'checked',
  isChecked: 'checked',
  'not-checked': 'not-checked',
  isNotChecked: 'not-checked',
  contains: 'contains',
}

const INLINE_TYPE_MAP: Record<string, InlineElementType> = {
  textInput: 'text',
  numberInput: 'number',
  integerInput: 'integer',
  decimalInput: 'decimal',
  dateInput: 'date',
  staticText: 'staticText',
  unit: 'unit',
  select: 'select',
  checkbox: 'checkbox',
  text: 'text',
  number: 'number',
  integer: 'integer',
  decimal: 'decimal',
  date: 'date',
  columnBreak: 'columnBreak',
  colBreak: 'columnBreak',
  columnSeparator: 'columnBreak',
  textarea: 'textarea',
  multiSelect: 'multiSelect',
  measurement: 'measurement',
  photo: 'photo',
  signature: 'signature',
}

const NUMERIC_WIDTH_MAP: Record<number, InlineElement['width']> = {
  1: 'xs',
  2: 'sm',
  3: 'md',
  4: 'lg',
  5: 'xl',
}

function normalizeLayout(layout: unknown): ColumnLayout {
  if (typeof layout !== 'string') return 'single'
  return LAYOUT_MAP[layout] ?? 'single'
}

function normalizeOperator(op: unknown): ConditionOperator {
  if (typeof op !== 'string') return 'eq'
  return OPERATOR_MAP[op] ?? 'eq'
}

function normalizeVisibleIf(raw: unknown): VisibleIfCondition | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as AnyRecord
  if (typeof v.fieldId !== 'string' || !v.fieldId) return undefined
  return {
    fieldId: v.fieldId,
    fieldLabel: v.fieldLabel,
    operator: normalizeOperator(v.operator),
    value: v.value != null ? String(v.value) : null,
  }
}

function normalizeInlineWidth(width: unknown): InlineElement['width'] | undefined {
  if (typeof width === 'string' && ['xs', 'sm', 'md', 'lg', 'xl'].includes(width)) {
    return width as InlineElement['width']
  }
  if (typeof width === 'number') {
    return NUMERIC_WIDTH_MAP[width] ?? 'md'
  }
  return undefined
}

function mapInlineElement(el: AnyRecord, index: number, usedFieldIds: Set<string>): InlineElement {
  const rawType = String(el.type ?? 'text')
  const mappedType = INLINE_TYPE_MAP[rawType]
  const type: InlineElementType = mappedType ?? (rawType === 'columnBreak' || rawType === 'colBreak' || rawType === 'columnSeparator' ? 'columnBreak' : 'text')
  const id = el.id ? String(el.id) : uid()

  if (type === 'columnBreak') {
    return {
      id,
      templateFieldId: dedupeFieldId(
        String(el.templateFieldId ?? el.fieldId ?? `col_break_${index}`),
        usedFieldIds,
      ),
      type: 'columnBreak',
    }
  }

  if (type === 'staticText') {
    return {
      id,
      templateFieldId: dedupeFieldId(
        String(el.templateFieldId ?? el.fieldId ?? `static_${index}`),
        usedFieldIds,
      ),
      type: 'staticText',
      staticText: el.staticText ?? el.text ?? el.value ?? el.label ?? '',
    }
  }

  if (type === 'unit') {
    return {
      id,
      templateFieldId: dedupeFieldId(
        String(el.templateFieldId ?? el.fieldId ?? `unit_${index}`),
        usedFieldIds,
      ),
      type: 'unit',
      unit: el.unit ?? el.value ?? el.label ?? '',
    }
  }

  const rawFieldId = el.templateFieldId ?? el.fieldId
  const templateFieldId = dedupeFieldId(
    rawFieldId ? String(rawFieldId) : newFieldId('inline'),
    usedFieldIds,
  )

  return {
    id,
    templateFieldId,
    type,
    label: el.label,
    unit: el.unit,
    required: el.required ?? el.validation?.required ?? false,
    min: el.validation?.min ?? el.min,
    max: el.validation?.max ?? el.max,
    decimals: el.precision ?? el.decimals ?? el.validation?.decimalPlaces,
    placeholder: el.placeholder,
    options: Array.isArray(el.options)
      ? el.options.map((o: AnyRecord | string) =>
          typeof o === 'string' ? o : String(o.label ?? o.value ?? o),
        )
      : undefined,
    width: normalizeInlineWidth(el.width),
  }
}

function dedupeFieldId(fieldId: string, usedFieldIds: Set<string>): string {
  if (!usedFieldIds.has(fieldId)) {
    usedFieldIds.add(fieldId)
    return fieldId
  }
  let suffix = 2
  let candidate = `${fieldId}_${suffix}`
  while (usedFieldIds.has(candidate)) {
    suffix += 1
    candidate = `${fieldId}_${suffix}`
  }
  usedFieldIds.add(candidate)
  return candidate
}

/** Flacht inlineColumns zu inlineElements mit columnBreak ab (max. 4 Spalten) */
function flattenInlineColumns(
  row: AnyRecord,
  usedFieldIds: Set<string>,
  warnings: string[],
  rowLabel: string,
): InlineElement[] {
  const columns = row.inlineColumns as unknown
  if (!Array.isArray(columns)) return []

  if (columns.length > MAX_SENTENCE_COLUMNS) {
    warnings.push(
      `Zeile „${rowLabel}": inlineColumns hat ${columns.length} Spalten – nur ${MAX_SENTENCE_COLUMNS} werden importiert.`,
    )
  }

  const elements: InlineElement[] = []
  const limited = columns.slice(0, MAX_SENTENCE_COLUMNS)

  limited.forEach((col: unknown, colIdx: number) => {
    if (colIdx > 0) {
      elements.push(mapInlineElement({ type: 'columnBreak' }, elements.length, usedFieldIds))
    }
    if (!Array.isArray(col)) return
    for (const el of col) {
      if (el && typeof el === 'object') {
        elements.push(mapInlineElement(el as AnyRecord, elements.length, usedFieldIds))
      }
    }
  })

  return elements
}

function resolveInlineElements(
  row: AnyRecord,
  usedFieldIds: Set<string>,
  warnings: string[],
): InlineElement[] {
  const rowLabel = String(row.label ?? row.templateFieldId ?? row.id ?? 'Satzzeile')

  if (Array.isArray(row.inlineColumns) && row.inlineColumns.length > 0) {
    return flattenInlineColumns(row, usedFieldIds, warnings, rowLabel)
  }

  const elements = (row.inlineElements ?? []).map((el: AnyRecord, i: number) =>
    mapInlineElement(el, i, usedFieldIds),
  )

  const colCount = countSentenceColumns(elements)
  if (colCount > MAX_SENTENCE_COLUMNS) {
    warnings.push(
      `Zeile „${rowLabel}": ${colCount} Satzspalten – maximal ${MAX_SENTENCE_COLUMNS} werden unterstützt.`,
    )
  }

  return elements
}

function mapFieldType(raw: unknown): SimpleFieldType {
  const t = String(raw ?? 'text').toLowerCase()
  const map: Record<string, SimpleFieldType> = {
    text: 'text',
    textarea: 'textarea',
    number: 'number',
    integer: 'integer',
    decimal: 'decimal',
    date: 'date',
    select: 'select',
    multiselect: 'multiSelect',
    'multi-select': 'multiSelect',
    checkbox: 'checkbox',
    measurement: 'measurement',
    photo: 'photo',
    signature: 'signature',
    field: 'text',
    checklistitem: 'checkbox',
  }
  return map[t] ?? 'text'
}

function mapRow(row: AnyRecord, index: number, usedFieldIds: Set<string>, warnings: string[] = []): BuilderRow | null {
  const type = String(row.type ?? 'simpleField')

  if (type === 'divider' || type === 'separator') {
    const id = row.id ? String(row.id) : uid()
    return {
      id,
      type: 'separator',
      templateFieldId: dedupeFieldId(String(row.templateFieldId ?? row.fieldId ?? `sep_${index}`), usedFieldIds),
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  if (type === 'spacer') {
    const id = row.id ? String(row.id) : uid()
    const height = row.height ?? row.spacerSize
    const spacerSize =
      height === 'xs' || height === 'sm' || height === 'md' || height === 'lg'
        ? height
        : typeof height === 'number'
          ? height <= 8
            ? 'xs'
            : height <= 16
              ? 'sm'
              : 'md'
          : 'sm'
    return {
      id,
      type: 'spacer',
      templateFieldId: dedupeFieldId(String(row.templateFieldId ?? row.fieldId ?? `spacer_${index}`), usedFieldIds),
      spacerSize,
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  if (type === 'staticText') {
    const id = row.id ? String(row.id) : uid()
    return {
      id,
      type: 'staticText',
      templateFieldId: dedupeFieldId(String(row.templateFieldId ?? row.fieldId ?? `static_${index}`), usedFieldIds),
      content: row.content ?? row.label ?? row.text ?? '',
      contentStyle:
        row.contentStyle ??
        (row.style === 'bold' ? 'bold' : row.style === 'muted' ? 'caption' : 'body'),
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  if (type === 'field' || type === 'checklistItem' || type === 'simpleField') {
    const rawFieldId = row.templateFieldId ?? row.fieldId ?? row.id
    if (!rawFieldId) return null
    const id = row.id ? String(row.id) : String(rawFieldId)
    return {
      id,
      type: 'simpleField',
      templateFieldId: dedupeFieldId(String(rawFieldId), usedFieldIds),
      label: row.label ?? '',
      fieldType: mapFieldType(row.fieldType ?? row.type),
      required: row.required ?? row.validation?.required ?? false,
      placeholder: row.placeholder,
      unit: row.unit,
      min: row.validation?.min ?? row.min,
      max: row.validation?.max ?? row.max,
      decimals: row.decimals ?? row.validation?.precision ?? row.validation?.decimalPlaces,
      options: Array.isArray(row.options)
        ? row.options.map((o: AnyRecord | string) =>
            typeof o === 'string' ? o : String(o.label ?? o.value ?? o),
          )
        : undefined,
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  if (type === 'compositeChecklistRow') {
    const checkboxFieldId = row.checkbox?.fieldId ?? row.templateFieldId ?? row.fieldId ?? row.id
    if (!checkboxFieldId) return null
    const id = row.id ? String(row.id) : String(checkboxFieldId)
    const hasCheckbox = !!(row.checkbox ?? row.hasCheckbox ?? row.checkbox?.fieldId)
    return {
      id,
      type: 'compositeChecklistRow',
      templateFieldId: dedupeFieldId(String(checkboxFieldId), usedFieldIds),
      label: row.label ?? '',
      hasCheckbox,
      required: row.required ?? row.validation?.required ?? false,
      inlineElements: resolveInlineElements(row, usedFieldIds, warnings),
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  if (type === 'checkboxGroup' || type === 'radioGroup') {
    const rawFieldId = row.templateFieldId ?? row.fieldId ?? row.id
    if (!rawFieldId) return null
    const id = row.id ? String(row.id) : String(rawFieldId)
    const options = row.groupOptions ?? row.options ?? []
    return {
      id,
      type: type as RowType,
      templateFieldId: dedupeFieldId(String(rawFieldId), usedFieldIds),
      groupLabel: row.groupLabel ?? row.label ?? '',
      required: row.required ?? row.validation?.required ?? false,
      groupOptions: options.map((o: AnyRecord | string, i: number) => ({
        id: typeof o === 'string' ? String(i) : String(o.id ?? o.value ?? i),
        label: typeof o === 'string' ? o : String(o.label ?? o.value ?? o),
      })),
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  if (type === 'fieldGroup') {
    const rawFieldId = row.templateFieldId ?? row.fieldId ?? row.id ?? `group_${index}`
    const id = row.id ? String(row.id) : String(rawFieldId)
    return {
      id,
      type: 'fieldGroup',
      templateFieldId: dedupeFieldId(String(rawFieldId), usedFieldIds),
      groupFields: (row.groupFields ?? row.fields ?? [])
        .map((sub: AnyRecord, i: number) => mapRow(sub, i, usedFieldIds, warnings))
        .filter(Boolean) as BuilderRow[],
      column: row.column ?? 'full',
      visibleIf: normalizeVisibleIf(row.visibleIf),
    }
  }

  throw new TemplateImportError(`Unbekannter Zeilentyp „${type}" in Abschnitt Zeile ${index + 1}.`)
}

function normalizeBuilderRow(row: AnyRecord, index: number, usedFieldIds: Set<string>, warnings: string[] = []): BuilderRow {
  const mapped = mapRow(row, index, usedFieldIds, warnings)
  if (mapped) return mapped

  const rawFieldId = row.templateFieldId ?? row.fieldId ?? newFieldId('row')
  const id = row.id ? String(row.id) : uid()
  return {
    id,
    type: (row.type as RowType) ?? 'simpleField',
    templateFieldId: dedupeFieldId(String(rawFieldId), usedFieldIds),
    label: row.label ?? '',
    column: row.column ?? 'full',
    visibleIf: normalizeVisibleIf(row.visibleIf),
  }
}

function normalizePrintSettings(raw: unknown): BuilderTemplate['printSettings'] {
  if (!raw || typeof raw !== 'object') {
    return { fontSize: 'xs', spacing: 'compact', showBorders: false }
  }
  const ps = raw as AnyRecord
  const density = ps.density ?? ps.spacing
  return {
    fontSize:
      ps.fontSize === 'xs' || ps.fontSize === 'sm' || ps.fontSize === 'base'
        ? ps.fontSize
        : ps.fontSizePt != null && ps.fontSizePt <= 9
          ? 'xs'
          : 'sm',
    spacing:
      density === 'compact' || density === 'normal' || density === 'relaxed'
        ? density
        : 'compact',
    showBorders: ps.showBorders ?? false,
    twoColumn: ps.twoColumn ?? false,
  }
}

function fromLegacyItems(def: AnyRecord, usedFieldIds: Set<string>, warnings: string[] = []): BuilderSection[] {
  return (def.sections ?? []).map((sec: AnyRecord) => ({
    id: sec.id ? String(sec.id) : uid(),
    title: sec.title ?? sec.name ?? 'Abschnitt',
    layout: 'single' as const,
    rows: (sec.items ?? []).map((item: AnyRecord, i: number) =>
      mapRow(
        {
          type: 'simpleField',
          id: item.id,
          templateFieldId: item.id,
          fieldId: item.id,
          label: item.label,
          fieldType: item.type,
          required: item.required,
          options: item.options,
          unit: item.unit,
          placeholder: item.placeholder,
        },
        i,
        usedFieldIds,
        warnings,
      ),
    ).filter(Boolean) as BuilderRow[],
  }))
}

function fromMaintenanceTemplate(def: AnyRecord, usedFieldIds: Set<string>, warnings: string[] = []): BuilderSection[] {
  return (def.sections ?? []).map((sec: AnyRecord) => ({
    id: sec.id ? String(sec.id) : uid(),
    title: sec.title ?? sec.name ?? 'Abschnitt',
    description: sec.description,
    layout: normalizeLayout(sec.layout),
    visibleIf: normalizeVisibleIf(sec.visibleIf),
    rows: (sec.rows ?? [])
      .map((row: AnyRecord, i: number) => mapRow(row, i, usedFieldIds, warnings))
      .filter(Boolean) as BuilderRow[],
  }))
}

function fromBuilderTemplate(def: AnyRecord, usedFieldIds: Set<string>, warnings: string[] = []): BuilderSection[] {
  return (def.sections ?? []).map((sec: AnyRecord) => ({
    id: sec.id ? String(sec.id) : uid(),
    title: sec.title ?? sec.name ?? 'Abschnitt',
    description: sec.description,
    layout: normalizeLayout(sec.layout),
    visibleIf: normalizeVisibleIf(sec.visibleIf),
    rows: (sec.rows ?? []).map((row: AnyRecord, i: number) =>
      normalizeBuilderRow(row, i, usedFieldIds, warnings),
    ),
  }))
}

function resolveName(def: AnyRecord): string {
  const name = def.name ?? def.title
  if (typeof name !== 'string' || name.trim().length < 2) {
    throw new TemplateImportError('Name erforderlich – „name" oder „title" muss mindestens 2 Zeichen haben.')
  }
  return name.trim()
}

export function normalizeToBuilderTemplate(obj: unknown): ImportTemplateResult {
  if (!obj || typeof obj !== 'object') {
    throw new TemplateImportError('Ungültiges Template – erwartet wird ein JSON-Objekt.')
  }

  const def = obj as AnyRecord
  const format = detectTemplateFormat(def)
  if (format === 'invalid') {
    throw new TemplateImportError('Ungültiges Template – „sections" muss ein nicht-leeres Array sein.')
  }

  const usedFieldIds = new Set<string>()
  const warnings: string[] = []

  let sections: BuilderSection[]
  switch (format) {
    case 'legacy':
      sections = fromLegacyItems(def, usedFieldIds, warnings)
      break
    case 'maintenance':
      sections = fromMaintenanceTemplate(def, usedFieldIds, warnings)
      break
    case 'builder':
    default:
      sections = fromBuilderTemplate(def, usedFieldIds, warnings)
      break
  }

  if (sections.length === 0) {
    throw new TemplateImportError('Template muss mindestens einen Abschnitt enthalten.')
  }

  for (const sec of sections) {
    if (sec.rows.length === 0) {
      warnings.push(`Abschnitt „${sec.title}" enthält keine Zeilen.`)
    }

    let consecutiveSimpleFields = 0
    for (const row of sec.rows) {
      if (row.type === 'simpleField') {
        consecutiveSimpleFields += 1
        if (consecutiveSimpleFields > 5) {
          warnings.push(
            `Abschnitt „${sec.title}": ${consecutiveSimpleFields} aufeinanderfolgende simpleField-Zeilen – ` +
              'besser als compositeChecklistRow mit columnBreak (max. 4 Satzspalten) zusammenfassen.',
          )
          break
        }
      } else {
        consecutiveSimpleFields = 0
      }
    }
  }

  const template: BuilderTemplate = {
    name: resolveName(def),
    description: def.description ?? def.subtitle ?? '',
    category: def.category ?? '',
    assetType: def.assetType,
    printSettings: normalizePrintSettings(def.printSettings),
    sections,
  }

  return { template, warnings }
}

export function importTemplateFromJson(raw: string): ImportTemplateResult {
  const parsed = parseTemplateJson(raw)
  return normalizeToBuilderTemplate(parsed)
}
