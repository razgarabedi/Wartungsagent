# KI-Anleitung: Papierformular → Vorlagen-JSON → Import

**Zielgruppe:** Administratoren  
**Stand:** Juni 2026

Mit dieser Anleitung können Sie ein **bestehendes Papierformular oder PDF** mithilfe einer externen KI (ChatGPT, Claude, Cursor o. Ä.) oder **Microsoft 365 Copilot** in eine **importierbare Vorlagen-JSON** umwandeln – ohne jedes Feld manuell im Vorlagen-Editor zu klicken.

**Microsoft 365 Copilot:** Siehe [Agent.md](../Agent.md) im Projektroot – Einrichtung eines deklarativen Copilot-Agenten.

---

## Was Sie brauchen

| Voraussetzung | Details |
|---|---|
| Admin-Zugang | Rolle `ADMIN` in der Wartungsprotokoll-App |
| Vorlagen-Editor | Route `/templates/new` oder `/templates/:id/edit` |
| KI-Tool | Mit Bild-/PDF-Unterstützung (z. B. Claude, ChatGPT, Cursor) |
| Referenz-Vorlage | Eine ähnliche Vorlage aus der App als JSON-Beispiel |

Weitere technische Details zum Builder: [09 – Advanced Vorlagen-Builder](./09-advanced-vorlagen-builder.md)

---

## Ablauf in 6 Schritten

```
PDF / Papierformular
       ↓
  KI (Vision + Prompt)
       ↓
  Vorlagen-JSON
       ↓
  Import im Builder (Tab JSON)
       ↓
  Vorschau prüfen → Speichern
```

---

## Schritt 1: PDF vorbereiten

1. Öffnen Sie das Papierformular als PDF.
2. Exportieren Sie **jede Seite als Bild** (PNG oder JPG, mind. 150 dpi) – Vision-KI arbeitet mit Bildern zuverlässiger als mit reinem PDF-Text.
3. Alternativ: Text aus dem PDF kopieren (wenn das Layout einfach ist).

**Tipp:** Gute Beleuchtung, gerade Ausrichtung und lesbare Schrift verbessern die KI-Erkennung deutlich.

---

## Schritt 2: Referenz-JSON besorgen

1. In der App: **Vorlagen** → eine ähnliche Vorlage öffnen (z. B. Kleinenthärtungsanlage oder Heizungswartung).
2. Im Vorlagen-Editor den Tab **JSON** wählen.
3. Auf **Herunterladen** klicken – diese Datei dient der KI als Struktur-Vorlage.

Als Code-Referenz (für Entwickler oder detaillierte KI-Prompts):

- `packages/shared/src/template-examples.ts` – einzelne Zeilen (z. B. Messwert mit Einheit)
- `packages/shared/src/templates/kleinenthaertung-papierformular.ts` – vollständiges Papierformular

---

## Schritt 3: KI-Prompt verwenden

Kopieren Sie den folgenden Prompt in Ihr KI-Tool. Hängen Sie **Seitenbilder des Formulars** und die **Referenz-JSON** an.

````markdown
Du bist ein Formular-Übersetzer für Wartungsprotokolle (SHK/TGA).

Aufgabe: Wandle das angehängte Papierformular in ein BuilderTemplate-JSON um.

Ausgabe: NUR valides JSON, keine Erklärung davor oder danach.

Schema-Regeln (BuilderTemplate):
- Pflichtfelder auf Root-Ebene: "name" (min. 2 Zeichen), "sections" (Array)
- Optional: "description", "category", "printSettings"
- printSettings für Papierformulare: { "fontSize": "xs", "spacing": "compact", "showBorders": false }

Abschnitt (section):
- "id", "title", "layout" ("single" | "two-column" | "three-column" | "compact")
- "rows": Array von Zeilen

Zeilentypen (row.type):
- "simpleField" – einzelnes Feld (Text, Zahl, Datum, Foto, Unterschrift …)
- "compositeChecklistRow" – Checkbox + Label + Inline-Messwerte in einer Zeile (bis 4 Satzspalten mit columnBreak)
- "checkboxGroup" / "radioGroup" – Mehrfach- oder Einfachauswahl
- "staticText" – Überschrift oder Fließtext ohne Eingabe
- "separator" – Trennlinie
- "spacer" – vertikaler Abstand

Jede Zeile braucht:
- "id" (kurze eindeutige ID)
- "type"
- "templateFieldId" (eindeutiger Feld-Schlüssel, z. B. "brenner_gereinigt")
- "column": "left" | "right" | "full" (bei zweispaltigen Abschnitten)

compositeChecklistRow – Beispiel für Messwertzeile:
[ ] Rohwasserhärte gemessen  [___] °dH  / eingestellt  [___] °dH

{
  "type": "compositeChecklistRow",
  "templateFieldId": "rohwasserhaerte_checked",
  "hasCheckbox": true,
  "label": "Rohwasserhärte gemessen",
  "inlineElements": [
    { "type": "decimal", "templateFieldId": "rohwasserhaerte_gemessen", "decimals": 1, "width": "sm" },
    { "type": "unit", "templateFieldId": "unit_dh1", "unit": "°dH" },
    { "type": "staticText", "templateFieldId": "static_eingestellt", "staticText": "/ eingestellt" },
    { "type": "decimal", "templateFieldId": "rohwasserhaerte_eingestellt", "decimals": 1, "width": "sm" },
    { "type": "unit", "templateFieldId": "unit_dh2", "unit": "°dH" }
  ]
}

Mehrspaltige Satzzeile (max. 4 Spalten) – mehrere Messwertgruppen in **einer** Papierzeile:

Variante A – columnBreak in inlineElements:
{
  "type": "compositeChecklistRow",
  "templateFieldId": "messwerte",
  "hasCheckbox": false,
  "label": "Betriebswerte",
  "inlineElements": [
    { "type": "staticText", "templateFieldId": "lbl_druck", "staticText": "Druck" },
    { "type": "decimal", "templateFieldId": "druck_bar", "decimals": 1, "width": "sm" },
    { "type": "unit", "templateFieldId": "unit_bar", "unit": "bar" },
    { "type": "columnBreak", "templateFieldId": "col1" },
    { "type": "staticText", "templateFieldId": "lbl_temp", "staticText": "Temperatur" },
    { "type": "decimal", "templateFieldId": "temp_c", "decimals": 1, "width": "sm" },
    { "type": "unit", "templateFieldId": "unit_c", "unit": "°C" }
  ]
}

Variante B – inlineColumns (Copilot-freundlich, 3 Spalten mit gemischten Typen):
"inlineColumns": [
  [{ "type": "date", "templateFieldId": "pruefdatum" }],
  [
    { "type": "staticText", "staticText": "Druck" },
    { "type": "decimal", "templateFieldId": "druck_bar", "decimals": 1 },
    { "type": "unit", "unit": "bar" }
  ],
  [{ "type": "checkbox", "templateFieldId": "io_ok", "label": "i.O." }]
]

Erlaubte inlineElements-Typen (pro Spalte, wie fieldType bei simpleField):
text, textarea, number, integer, decimal, measurement, date, select, multiSelect, checkbox, photo, signature, staticText, unit, columnBreak

Mapping Papierformular → Zeilentyp:
| Papier | JSON |
|--------|------|
| [ ] Prüfpunkt | compositeChecklistRow mit hasCheckbox |
| [___] Messwert + Einheit | compositeChecklistRow mit inlineElements |
| Mehrere Gruppen in einer Zeile | compositeChecklistRow, 2–4 Satzspalten: columnBreak oder inlineColumns |
| Feld in Satzspalte | inlineElements (text, decimal, date, signature, …) |
| GSX ☐ VGX ☐ | radioGroup oder checkboxGroup |
| Freitext (eigene Zeile) | simpleField, fieldType "textarea" |
| Freitext in Satzspalte | inlineElements: type "textarea" |
| Unterschrift (eigene Zeile) | simpleField, fieldType "signature" |
| Unterschrift in Satzspalte | inlineElements: type "signature" |
| Überschrift ohne Eingabe | staticText |

Referenz-JSON (Struktur und Stil übernehmen):
[HIER REFERENZ-JSON EINFÜGEN]

Erstelle das JSON für das angehängte Formular.
````

---

## Schritt 4: JSON prüfen

Bevor Sie importieren, prüfen Sie:

- [ ] `"name"` ist gesetzt (mindestens 2 Zeichen)
- [ ] `"sections"` ist ein Array mit mindestens einem Eintrag
- [ ] Jede Zeile hat `"type"` und `"templateFieldId"`
- [ ] Messwert-Zeilen haben `"inlineElements"` mit `"unit"`-Elementen
- [ ] Mehrere Gruppen pro Papierzeile: 2–4 Satzspalten via `columnBreak` oder `inlineColumns`
- [ ] Inline-Typen in Satzspalten = gleiche Palette wie `fieldType`
- [ ] Zweispaltige **Abschnitte**: Abschnitt `"layout": "two-column"`, Zeilen mit `"column": "left"` / `"right"` (≠ Satzspalten)
- [ ] JSON ist syntaktisch gültig (kein Komma am Ende, Anführungszeichen korrekt)

Online-Prüfung: JSON in einen Validator einfügen (z. B. jsonlint.com) oder in einem Editor mit JSON-Syntaxprüfung öffnen.

---

## Schritt 5: Import in der App

1. **Vorlagen** → **Neue Vorlage** (oder bestehende Vorlage bearbeiten).
2. Tab **JSON** öffnen.
3. Button **Importieren** klicken.
4. JSON einfügen **oder** `.json`-Datei hochladen.
5. **Übernehmen** klicken.
6. Tab **Editor** – Struktur kurz prüfen.
7. Tab **Vorschau** → Modus **Druck** – mit Original-PDF vergleichen.
8. **Speichern** klicken.

**Hinweis:** Bei ungespeicherten Änderungen erscheint eine Sicherheitsabfrage vor dem Import.

### Unterstützte Formate

| Format | Erkennung |
|---|---|
| **BuilderTemplate** | `"templateFieldId"`, `"hasCheckbox"` – direkt aus dem Builder-Export |
| **MaintenanceTemplate** | `"fieldId"`, `"decimalInput"`, `"title"` – aus Entwickler-Dokumentation |
| **Legacy** | `"sections[].items[]"` – einfache ältere Vorlagen |

---

## Schritt 6: Nachbearbeitung

Typische KI-Fehler und Korrekturen im Editor:

| Problem | Lösung |
|---|---|
| Viele simpleField-Zeilen für Messwerte | Als compositeChecklistRow mit Satzspalten (2–4) zusammenfassen |
| Fehlende Einheit (°C, bar, °dH) | Inline-Element **Einheit** (`type: "unit"`) in der Satzspalte |
| Freitext/Unterschrift nur als simpleField | In Satzspalten auch `textarea` / `signature` als inlineElements erlaubt |
| Falsche Spalte | Zeile auswählen → Spalte **Links/Rechts/Volle Breite** setzen |
| Checkbox fehlt | compositeChecklistRow → Checkbox aktivieren |
| Abschnitt zu grob | Abschnitt aufteilen, Layout **Zweispaltig** wählen |
| Unterschriften fehlen | Am Ende Abschnitt „Abschluss“ mit Feldtyp **Unterschrift** |
| Zu große Abstände im PDF | Links **PDF/Druck** → Abstände **Kompakt**, Schrift **Klein** |

---

## Mini-Beispiel-JSON

Kleinstes importierbares Beispiel (1 Abschnitt, 1 Messwertzeile):

```json
{
  "name": "Test Protokoll",
  "description": "Aus KI generiert",
  "category": "Heizung",
  "printSettings": {
    "fontSize": "xs",
    "spacing": "compact",
    "showBorders": false
  },
  "sections": [
    {
      "id": "sec001",
      "title": "Sichtprüfung",
      "layout": "single",
      "rows": [
        {
          "id": "row001",
          "type": "compositeChecklistRow",
          "templateFieldId": "brenner_gereinigt",
          "hasCheckbox": true,
          "label": "Brenner gereinigt",
          "column": "full",
          "inlineElements": []
        },
        {
          "id": "row002",
          "type": "compositeChecklistRow",
          "templateFieldId": "druck_checked",
          "hasCheckbox": true,
          "label": "Anlagendruck gemessen",
          "column": "full",
          "inlineElements": [
            {
              "id": "inl001",
              "type": "decimal",
              "templateFieldId": "anlagendruck_bar",
              "decimals": 1,
              "width": "sm"
            },
            {
              "id": "inl002",
              "type": "unit",
              "templateFieldId": "unit_bar",
              "unit": "bar"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## Troubleshooting

| Fehlermeldung | Ursache | Lösung |
|---|---|---|
| „Ungültiges JSON – Syntaxfehler“ | Copilot liefert oft `\[` `\]` statt `[` `]` oder JSON in Anführungszeichen – erneut mit „nur reines JSON“ anfordern; App-Import bereinigt das automatisch |
| „Name erforderlich“ | `"name"` fehlt oder zu kurz | `"name": "Ihre Vorlage"` setzen |
| „sections muss ein Array sein“ | Falsche Struktur | Root-Objekt mit `"sections": [...]` |
| „Unbekannter Zeilentyp“ | Tippfehler bei `"type"` | Nur erlaubte Typen verwenden (siehe Schritt 3) |
| Import ok, Vorschau leer | Leere `"rows"` | KI erneut mit klarerem Layout-Prompt |
| Felder doppelt / Daten vermischt | Gleiche `templateFieldId` | Eindeutige IDs vergeben (Import dedupliziert automatisch mit `_2`) |
| PDF sieht nicht wie Papier aus | Falsche Druckeinstellungen | `printSettings`: kompakt, kleine Schrift, Rahmen aus |

---

## Empfohlener Workflow für wiederkehrende Formulare

1. **Erstes Formular:** KI + Import + manuelle Feinkorrektur (ca. 30–60 Min.).
2. **Ähnliche Formulare:** Referenz-JSON der fertigen Vorlage nutzen – KI liefert dann deutlich bessere Ergebnisse.
3. **Qualitätssicherung:** Immer Druck-Vorschau und einen Test-Auftrag mit PDF-Export durchspielen.

---

## Siehe auch

- [09 – Advanced Vorlagen-Builder](./09-advanced-vorlagen-builder.md) – Builder-Funktionen und JSON-Export/Import
- [05 – Checklisten-Vorlagen](./05-checklisten-vorlagen.md) – Starter-Vorlagen und Normen
- [12 – PDF-Export](./12-pdf-export.md) – PDF-Ausgabe nach dem Ausfüllen
