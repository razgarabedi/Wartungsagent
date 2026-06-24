# 09 – Vorlagen-Editor (Checklisten-Builder)

**Pfad:** `apps/web/src/features/checklist-builder/advanced-builder/`  
**Routen:** `/templates/new`, `/templates/:id/edit`  
**Legacy-Redirects:** `/templates/build` → `/templates/new`, `/templates/:id/build` → `/templates/:id/edit`  
**Zugriff:** `MANAGER`+ (Erstellen/Bearbeiten: `ADMIN`)

---

## Überblick

Der Vorlagen-Editor ist der einzige Checklisten-Builder der Anwendung. Er ermöglicht Admins, einfache und komplexe papierähnliche Wartungsprotokolle per UI zu erstellen – ohne JSON manuell zu schreiben.

Funktionen:

- Einfache Felder (Text, Zahl, Datum, Select, Messwert, Foto, Unterschrift …)
- Mehrspalten-Layouts (ein-/zwei-/dreispaltig, Grid, Kompakt)
- `compositeChecklistRow` mit Inline-Elementen
- Bedingte Sichtbarkeit (Abschnitt, Zeile, Feld)
- Undo/Redo, Live-Vorschau (Desktop / Tablet / Druck), JSON-Export
- Zod-Validierung vor dem Speichern
- Vollständiger Edit-Roundtrip über `MaintenanceTemplateVersion.schema` (JSONB)

---

## Architektur

```
TemplateBuilderPage
├── Toolbar (Undo/Redo, Editor/Vorschau/JSON, Speichern)
├── TemplateMeta (linkes Panel: Name, Kategorie, PDF-Einstellungen, Abschnittsbaum)
├── SectionCanvas (Mitte: Drag & Drop Abschnitte)
│   └── SectionPanel (pro Abschnitt)
│       ├── Layout-Auswahl
│       ├── RowCard[] (sortierbar)
│       └── AddRowMenu
└── PropertiesPanel (rechts: kontextabhängiger Editor)
    ├── SectionPropertiesEditor
    └── RowEditor
        ├── CompositeRowEditor
        │   └── InlineElementEditor
        └── ConditionalLogicEditor
```

### State-Management

| Datei | Technologie | Zweck |
|---|---|---|
| `builder-store.ts` | Zustand + zundo | Template-State, Undo/Redo (50 Schritte) |
| `builder-types.ts` | TypeScript | `BuilderTemplate`, `BuilderSection`, `BuilderRow`, `InlineElement` |

---

## Abschnitte (Sections)

Jeder Abschnitt hat:

| Eigenschaft | Typ | Beschreibung |
|---|---|---|
| `title` | string | Abschnittstitel |
| `description` | string? | Optionale Beschreibung |
| `layout` | ColumnLayout | `single`, `two-column`, `three-column`, `grid`, `compact` |
| `visibleIf` | VisibleIfCondition? | Bedingte Sichtbarkeit |
| `rows` | BuilderRow[] | Zeilen des Abschnitts |

---

## Zeilentypen (Row Types)

| Typ | Beschreibung |
|---|---|
| `simpleField` | Einfaches Feld (Text, Zahl, Datum, Select, Messwert, Foto …) |
| `compositeChecklistRow` | Checkbox + Label + Inline-Elemente in einer Zeile |
| `fieldGroup` | Gruppe zusammengehöriger Felder |
| `checkboxGroup` | Mehrfachauswahl per Checkbox |
| `radioGroup` | Einfachauswahl per Radio |
| `staticText` | Statischer Text (Überschrift, Fließtext, Beschriftung) |
| `separator` | Trennlinie |
| `spacer` | Vertikaler Abstand (xs/sm/md/lg) |

---

## Composite Checklist Row

Beispiel aus der Kleinenthärtungsanlage:

```
[ ] Rohwasserhärte gemessen [____] °dH / eingestellt [____] °dH
```

Konfiguration im Builder:

- **Checkbox** aktivieren/deaktivieren
- **Hauptbeschreibung** (Label)
- **Inline-Elemente** pro Satzspalte (gleiche Typen wie einfaches Feld):
  - `text`, `textarea`, `number`, `integer`, `decimal`, `measurement`, `date`, `select`, `multiSelect`, `checkbox`, `photo`, `signature`, `staticText`, `unit`
  - Layout: `columnBreak` (nur im JSON, im Editor automatisch bei 2–4 Spalten)
- **Satzspalten** (2–4 pro Zeile): Umschalter **2 | 3 | 4 Spalten** im Satzzeilen-Editor
- Pro Spalte eigenes **„+ Feld“**-Menü mit allen Feldtypen wie beim einfachen Feld (Kurztext, Dezimalzahl, Unterschrift, …)
- Vorlagen: **Satzzeile 2/3/4 Spalten** im Zeilen-Menü
- Pro Inline-Element: Einheit, Min/Max, Dezimalstellen, Pflichtfeld, Breite, Platzhalter

---

## Satzspalten (mehrspaltige Satzzeilen)

Innerhalb einer `compositeChecklistRow` können **2–4 Satzspalten** definiert werden:

- Editor: Button-Gruppe **2 | 3 | 4 Spalten** – Spalten-Trenner (`columnBreak`) werden automatisch gesetzt
- Pro Spalte: eigenes Feld-Menü (gleiche Typen wie **Einfaches Feld**)
- JSON: `{ "type": "columnBreak" }` zwischen Spalten oder `"inlineColumns": [[...], [...]]`

Unterschied zu **Abschnitts-Mehrspalten** (`layout: two-column`): Satzspalten betreffen **eine logische Zeile** mit mehreren Messwertgruppen nebeneinander.

---

## Mehrspalten-Editor

Bei Layout `two-column` oder `three-column`:

- Zeilen können `column: 'left' | 'right' | 'full'` zugewiesen werden
- Drag & Drop innerhalb und zwischen Spalten
- Volle Breite (`full`) spannt alle Spalten

---

## Bedingte Sichtbarkeit

`ConditionalLogicEditor` erlaubt Regeln wie:

- Zeige Abschnitt nur wenn Feld X = Wert Y
- Zeige Zeile nur wenn Checkbox X aktiviert ist
- Operatoren: `eq`, `neq`, `checked`, `not-checked`, `contains`

Feldauswahl basiert auf `collectFieldRefs()` – alle referenzierbaren Felder im Template.

---

## Vorschau-Modi

| Modus | Komponente | Beschreibung |
|---|---|---|
| Editor | `SectionCanvas` | Bearbeitungsansicht |
| Vorschau | `BuilderPreview` | Desktop / Tablet / Druck-PDF |
| JSON | `TemplateJsonPreview` | Vollständiges Template-JSON, Kopieren/Download/Import |

---

## JSON-Import

Im Tab **JSON** kann eine Vorlage per **Importieren** geladen werden:

- JSON einfügen oder `.json`-Datei hochladen
- Unterstützte Formate: **BuilderTemplate** (Export aus dem Builder), **MaintenanceTemplate** (`fieldId`, `decimalInput`, …) und **Legacy** (`sections[].items[]`)
- Bei ungespeicherten Änderungen erscheint eine Sicherheitsabfrage
- Nach erfolgreichem Import wechselt der Editor automatisch in den **Editor**-Tab; `id`/`versionId` werden entfernt (neue Vorlage)

**KI-Workflow:** Papierformular per externer KI in JSON umwandeln → siehe [KI-Anleitung](./ki.md).

Implementierung: [`template-import.ts`](../apps/web/src/features/checklist-builder/template-import.ts), UI in [`TemplateJsonImportDialog.tsx`](../apps/web/src/features/checklist-builder/advanced-builder/TemplateJsonImportDialog.tsx).

---

## Speichern

Beim Speichern wird `BuilderTemplate` über `template-mapper.ts` in das API-Format konvertiert:

- Vollständiges Builder-JSON → `MaintenanceTemplateVersion.schema` (JSONB)
- Beantwortbare Felder → `sections[].items[]` (Rückwärtskompatibilität)
- Validierung via `CreateChecklistTemplateSchema` (Zod)
- Route: `checklists.create` / `checklists.update`

Beim Laden: Wenn `schema` vorhanden ist, wird es direkt geladen. Sonst Fallback aus flachen `sections[].items[]` (Legacy-Vorlagen).

---

## Wichtige Dateien

| Datei | Funktion |
|---|---|
| `TemplateBuilderPage.tsx` | 3-Spalten-Layout, Toolbar, Tab-Switcher |
| `template-mapper.ts` | Bidirektionale Konvertierung API ↔ Builder |
| `builder-store.ts` | Zustand-Store mit CRUD + Undo/Redo |
| `builder-types.ts` | TypeScript-Typen + `collectFieldRefs()` |
| `SectionPanel.tsx` | Abschnitt mit DnD-Zeilen |
| `CompositeRowEditor.tsx` | Composite-Row-Editor mit Inline-Chips |
| `InlineElementEditor.tsx` | Einzelnes Inline-Element konfigurieren |
| `ConditionalLogicEditor.tsx` | Sichtbarkeitsregeln |
| `BuilderPreview.tsx` | Live-Vorschau (Desktop/Tablet/Print) |
| `TemplateJsonPreview.tsx` | JSON-Ansicht (Export + Import) |
| `TemplateJsonImportDialog.tsx` | JSON-Import-Dialog |
