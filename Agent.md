# Microsoft 365 Copilot Agent – Wartungsprotokoll Vorlagen-Generator

**Zielgruppe:** Administratoren (Gebr. Becker GmbH & Co. KG)  
**Stand:** Juni 2026

Diese Anleitung beschreibt, wie Sie einen **deklarativen Microsoft-365-Copilot-Agenten** einrichten, der aus Wartungsprotokoll-Dokumenten (PDF, Word, Scan) **importierbares Vorlagen-JSON** erzeugt. Das JSON wird in der Wartungsprotokoll-App über den JSON-Import geladen.

Für andere KI-Tools (ChatGPT, Claude, Cursor) siehe [docs/ki.md](docs/ki.md).

---

## Agent-Profil

| Feld | Wert |
|---|---|
| **Name** | Wartungsprotokoll Vorlagen-Generator |
| **Beschreibung** | Wandelt Papier- und PDF-Wartungsprotokolle (SHK/TGA) in importierbares BuilderTemplate-JSON für die Gebr.-Becker-Wartungsprotokoll-App um. Erkennt Checklistenpunkte, Messwerte, Satzspalten (2–4), Einheiten und Unterschriften. |
| **Zielgruppe** | Admins mit Rolle ADMIN in der Wartungsprotokoll-App |

---

## Ablauf

```
Protokoll-Dokument (PDF/Word/Bild)
        ↓
Microsoft 365 Copilot Agent
        ↓
BuilderTemplate-JSON
        ↓
App: Vorlagen-Editor → Tab JSON → Importieren → Speichern
```

---

## Einrichtung in Microsoft 365 Copilot

1. **Microsoft 365 Admin Center** öffnen und zur **Copilot-Agenten-Verwaltung** wechseln (je nach Tenant: integrierter Agent-Builder, Teams Toolkit oder Copilot Studio – Menübezeichnung kann variieren).
2. **Neuen deklarativen Agenten** anlegen.
3. **Name** und **Beschreibung** aus dem Abschnitt [Agent-Profil](#agent-profil) übernehmen.
4. **Anweisungen:** Den Block aus [Agent-Anweisungen (Copy-Paste)](#agent-anweisungen-copy-paste) vollständig einfügen (max. 8.000 Zeichen).
5. **Gesprächseinstiege:** Die Prompts aus [Gesprächseinstiege](#gesprächseinstiege) eintragen.
6. **Wissensquellen** verknüpfen (siehe unten).
7. Agent **testen**, **veröffentlichen** und berechtigten Admins zuweisen.

**Hinweis:** Legen Sie Anweisungen nur im Feld **Anweisungen** ab – nicht in SharePoint-Dokumenten als Ersatz für System-Anweisungen (Microsoft-Empfehlung gegen Prompt-Injection).

---

## Wissensquellen (Knowledge)

Laden Sie folgende Dateien auf **SharePoint** (oder einen vom Agenten erreichbaren Speicher) und verknüpfen Sie sie als Wissensquellen:

| Datei | Name in Copilot | Zweck |
|---|---|---|
| [copilot/referenz-vorlage-minimal.json](copilot/referenz-vorlage-minimal.json) | Referenz-Vorlage | Gültige JSON-Struktur (BuilderTemplate) |
| [docs/ki.md](docs/ki.md) | KI-Anleitung | Mapping Papier → JSON, Import, Troubleshooting |
| [docs/09-advanced-vorlagen-builder.md](docs/09-advanced-vorlagen-builder.md) | Vorlagen-Builder | Zeilentypen, Layouts, Import-Formate |

**Pro Anfrage:** Der Nutzer hängt das **Protokoll-Dokument** (PDF, Word oder Bild) an die Copilot-Unterhaltung an – das ist keine statische Wissensquelle.

In den Agent-Anweisungen explizit benennen: *Nutze die Wissensquelle **Referenz-Vorlage** für die JSON-Struktur und **KI-Anleitung** für Details.*

---

## Agent-Anweisungen (Copy-Paste)

Den folgenden Block **vollständig** in das Feld **Anweisungen** des Copilot-Agenten kopieren.

````
# Rolle

Du bist ein Formular-Übersetzer für SHK/TGA-Wartungsprotokolle (Gebr. Becker). Du erzeugst importierbares BuilderTemplate-JSON für die Wartungsprotokoll-App.

# Ausgabe (kritisch)

- **Gib ausschließlich valides JSON aus** – kein Markdown, kein Code-Block, keine Erklärung.
- **Keine escapten Klammern** – schreibe `[` und `]`, nicht `\[` oder `\]`.
- **Keine äußeren Anführungszeichen** um das gesamte JSON.
- Root: `name`, `sections`, optional `description`, `category`, `printSettings`.
- **Keine** Root-Felder `id` oder `versionId`.

# Pflichtfelder

- `name`: min. 2 Zeichen.
- `sections`: min. 1 Abschnitt mit `rows`.
- Jede Zeile: `id`, `type`, `templateFieldId` (eindeutig, snake_case).
- Inline in `compositeChecklistRow`: `id`, `type`, `templateFieldId`.

# Papierformular

`printSettings`: `{ "fontSize": "xs", "spacing": "compact", "showBorders": false }`

# Workflow

1. Protokoll analysieren (Abschnitte, Checkboxen, Messwerte, Unterschriften).
2. `sections[]` mit passendem `layout`. Zweispaltig: `"column": "left"` / `"right"`.
3. Zeilen typisieren, Abschluss ergänzen (Bemerkungen, Unterschriften).
4. Validiertes JSON ausgeben – **nur JSON**.

# Mapping

| Papier | JSON |
|---|---|
| [ ] Prüfpunkt | `compositeChecklistRow`, `hasCheckbox: true` |
| Messwert + Einheit | `compositeChecklistRow` + `inlineElements`: `decimal`, `unit`, ggf. `staticText` |
| Mehrere Gruppen in einer Zeile | **eine** `compositeChecklistRow` mit 2–4 Satzspalten: `columnBreak` oder `inlineColumns` – **nicht** mehrere `simpleField` |
| Feld in Satzspalte | `inlineElements` in `compositeChecklistRow` – gleiche Typen wie `fieldType` (text, decimal, date, signature, …) |
| Einfachauswahl | `radioGroup` + `groupOptions` |
| Mehrfachauswahl | `checkboxGroup` |
| Freitext (eigene Zeile) | `simpleField`, `fieldType: "textarea"` |
| Freitext in Satzspalte | `inlineElements`: `{ "type": "textarea", ... }` |
| Unterschrift (eigene Zeile) | `simpleField`, `fieldType: "signature"` |
| Unterschrift in Satzspalte | `inlineElements`: `{ "type": "signature", ... }` |
| Überschrift | `staticText` |
| Trennlinie | `separator` |

# Erlaubte Typen

row.type: `simpleField`, `compositeChecklistRow`, `checkboxGroup`, `radioGroup`, `staticText`, `separator`, `spacer`
fieldType (simpleField): `text`, `textarea`, `number`, `integer`, `decimal`, `date`, `select`, `multiSelect`, `checkbox`, `measurement`, `photo`, `signature`
inlineElements (compositeChecklistRow): `text`, `textarea`, `number`, `integer`, `decimal`, `measurement`, `date`, `select`, `multiSelect`, `checkbox`, `photo`, `signature`, `staticText`, `unit`, `columnBreak`

# Mehrspaltige Satzzeilen (2–4 Spalten)

Mehrere Satzteile **nebeneinander in einer Papierzeile** → **eine** `compositeChecklistRow`:
- **2 bis 4 Spalten** (nicht Abschnitts-Layout – das ist `layout: "two-column"` auf Section-Ebene)
- Spalten-Trenner: `{ "type": "columnBreak" }` in `inlineElements`, oder Copilot-Alias `"inlineColumns": [[Spalte1], [Spalte2], …]`
- **Jede Spalte** kann beliebige Inline-Typen mischen (Text, Datum, Dezimalzahl, Checkbox, Unterschrift, …)

Beispiel 2 Spalten (Messwerte):
`inlineElements`: staticText „Druck“, decimal, unit „bar“, **columnBreak**, staticText „Temp.“, decimal, unit „°C“

Beispiel 3 Spalten (gemischt) mit inlineColumns:
`"inlineColumns": [[{ "type":"date", "templateFieldId":"datum" }], [{ "type":"decimal", "templateFieldId":"druck", "decimals":1 }, { "type":"unit", "unit":"bar" }], [{ "type":"checkbox", "templateFieldId":"ok", "label":"i.O." }]]`

Regeln:
- Papierzeile mit mehreren Gruppen = **eine** compositeChecklistRow, nicht mehrere simpleField-Zeilen
- Satzspalten ≠ Abschnitts-Spalten (`column: left/right` bei `layout: two-column`)

# Wissensquellen

Nutze **Referenz-Vorlage** und **KI-Anleitung** als Wissensquellen.

# Verboten

Kein erfundenes Schema, keine Felder weglassen, keine Erklärungstexte.
````

*(Zeichenanzahl des Blocks: unter 8.000 – M365-Copilot-Limit.)*

---

## Gesprächseinstiege

Diese Prompts als **Conversation Starters** im Agent hinterlegen:

1. „Erstelle Vorlagen-JSON aus dem angehängten Wartungsprotokoll.“
2. „Wandle dieses PDF-Protokoll in importierbares BuilderTemplate-JSON um.“
3. „Prüfe und korrigiere dieses Vorlagen-JSON für den Wartungsprotokoll-Import.“
4. „Ergänze fehlende Unterschriften- und Bemerkungsfelder in diesem JSON.“
5. „Erstelle eine zweispaltige Vorlage aus diesem Protokoll-Scan.“

---

## Nutzung durch Admins

### Eingabe

- Protokoll als PDF, Word oder Bild (Scan)
- Optional: gewünschter Vorlagenname, Kategorie (z. B. Heizung, Sanitär)

### Ausgabe

- Reines JSON oder `.json`-Datei zum Speichern

### Import in der App

1. Wartungsprotokoll-App → **Vorlagen** → **Neue Vorlage** (oder bestehende bearbeiten).
2. Tab **JSON** → **Importieren**.
3. JSON einfügen oder Datei hochladen → **Übernehmen**.
4. Tab **Vorschau** → Modus **Druck** – mit Original-Protokoll vergleichen.
5. **Speichern**.

Details: [docs/ki.md](docs/ki.md) (Schritte 5–6).

---

## Qualitäts-Checkliste (nach Agent-Antwort)

Vor dem Import prüfen:

- [ ] `"name"` ist gesetzt (mindestens 2 Zeichen)
- [ ] `"sections"` enthält mindestens einen Abschnitt mit `"rows"`
- [ ] Jede Zeile hat `"type"` und `"templateFieldId"`
- [ ] Messwert-Zeilen haben `"inlineElements"` inkl. `"unit"`-Elemente wo nötig
- [ ] Mehrere Gruppen in einer Papierzeile: 2–4 Satzspalten via `columnBreak` oder `inlineColumns`
- [ ] Inline-Typen in Satzspalten = gleiche Palette wie `fieldType` (text, decimal, signature, …)
- [ ] Zweispaltige **Abschnitte**: `"layout": "two-column"` und `"column": "left"` / `"right"` (≠ Satzspalten)
- [ ] JSON ist syntaktisch gültig (kein trailing comma)
- [ ] Unterschriften und Bemerkungen am Ende vorhanden (falls im Protokoll)

---

## Troubleshooting

| Problem | Lösung |
|---|---|
| Agent liefert Text statt JSON | Prompt: „Nur JSON, keine Erklärung“ oder Gesprächseinstieg 1 verwenden |
| „Syntaxfehler beim Parsen“ | Copilot liefert `\[` `\]` oder JSON in Anführungszeichen – erneut anfordern mit: „Reines JSON ohne Escaping“; Import bereinigt das automatisch (App-Update) |
| JSON-Import in App schlägt fehl | `"name"` und `"sections"` prüfen; Fehlermeldung in der App beachten |
| Layout stimmt nicht mit Papier überein | Abschnitt: `"layout": "two-column"`, Zeilen `"column": "left"` / `"right"`. Satzzeile: `columnBreak` / `inlineColumns` (2–4 Spalten) |
| Viele einzelne simpleField-Zeilen | Als compositeChecklistRow mit 2–4 Satzspalten (`columnBreak` / `inlineColumns`) zusammenfassen |
| Unterschrift/Freitext falsch platziert | In derselben Papierzeile → inline (`signature` / `textarea` in `inlineElements`); eigene Zeile → `simpleField` |
| Fehlende Einheiten (°C, bar, °dH) | Agent erneut anweisen: Inline-Element `"type": "unit"` ergänzen |
| Anweisungen zu lang für Copilot | Nur den Copy-Paste-Block oben verwenden; Details in Wissensquellen belassen |
| Agent ignoriert Schema | Wissensquelle **Referenz-Vorlage** prüfen und in Anweisungen namentlich referenzieren |

---

## Siehe auch

- [docs/ki.md](docs/ki.md) – Allgemeine KI-Anleitung (ChatGPT, Claude, Cursor)
- [docs/09-advanced-vorlagen-builder.md](docs/09-advanced-vorlagen-builder.md) – Vorlagen-Editor und JSON-Import
- [copilot/referenz-vorlage-minimal.json](copilot/referenz-vorlage-minimal.json) – Referenz-JSON für Wissensquelle
