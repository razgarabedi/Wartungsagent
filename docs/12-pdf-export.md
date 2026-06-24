# 12 – PDF-Export

**Service:** `apps/api/src/lib/pdf-export.service.ts`  
**Generator:** `apps/api/src/lib/pdf.ts` (@react-pdf/renderer)  
**Speicher:** S3/MinIO + `PdfExport`-Tabelle

---

## Überblick

Abgeschlossene Wartungsprotokolle können als PDF exportiert werden. Jeder Export ist **reproduzierbar** aus den gespeicherten Daten, **versioniert** und mit **SHA-256-Hash** gesichert. Bestehende Exporte werden nicht überschrieben.

---

## PDF-Inhalt

| Bereich | Quelle |
|---|---|
| Kopfbereich | `Tenant` (Gebr. Becker GmbH & Co. KG) |
| Kunde | `Customer` via `Asset → Site` |
| Einsatzort | `Site` |
| Anlage | `Asset` + `AssetType` |
| Auftragsnummer | `MaintenanceJob.erpRef` / `id` |
| Datum | `MaintenanceReport.completedAt` |
| Monteur | `User` (Techniker) |
| Checklistenabschnitte | `TemplateVersion.definition` |
| Antworten | `MaintenanceAnswer` (typisierte Spalten) |
| Messwerte mit Einheiten | Antworten + Template-Felddefinition |
| Mängelübersicht | `DefectRecord` (wenn vorhanden) |
| Verwendetes Material | `MaterialRecord` (wenn vorhanden) |
| Fotos | `PhotoAttachment` |
| Bemerkungen | `MaintenanceReport.notes` |
| Monteur-Signatur | `Signature` type=TECHNICIAN |
| Kunden-Signatur | `Signature` type=CUSTOMER |
| Zeitstempel | Export-Zeitpunkt |
| PDF-Hash / Dokument-ID | `PdfExport.hash`, `metadata.documentId` |
| Hinweis | „Digital erstellt" |

---

## API-Endpunkte

### `reports.exportPdf` · mutation · protectedProcedure

Erzeugt eine **neue offizielle PDF-Version**.

**Input:** `{ reportId: string }`

**Output:**
```typescript
{
  pdfExportId: string;
  pdfUrl: string;
  storageKey: string;
  version: number;          // inkrementell pro Report
  hash: string;             // SHA-256 des PDF-Bytes
  dataDigest: string;       // SHA-256 der Quelldaten
  documentId: string;       // z. B. "clxxx-V3"
  generatedAt: Date;
  fileSize: number;
}
```

**Voraussetzungen:**
- Report muss `isLocked = true` sein
- Techniker dürfen nur eigene Protokolle exportieren

### `reports.regeneratePdf` · mutation · managerProcedure

Regeneriert PDF (z. B. nach Korrektur). Setzt `isOfficial = false` für den neuen Export.

### Automatischer Export

Bei Kunden-Unterschrift (`reports.sign`) wird PDF asynchron generiert.

---

## Versionierung & Unveränderlichkeit

| Regel | Implementierung |
|---|---|
| Kein Überschreiben | Jeder Export = neuer `PdfExport`-Datensatz mit `version++` |
| Offizieller Export | `isOfficial = true`; vorherige offizielle Versionen → `isOfficial = false` |
| Hash | SHA-256 über PDF-Byte-Buffer |
| Speicherpfad | `reports/{reportId}/v{version}.pdf` in S3/MinIO |
| AuditLog | `AuditAction.EXPORT_PDF` mit `documentId`, `dataDigest` |

---

## Frontend: PDF-Vorschau

**Seite:** `ReportDetailPage` (`/reports/:id`)

- Button „PDF exportieren" → `reports.exportPdf`
- **PDF-Vorschau** via `<iframe src={pdfUrl}>`
- **Export-Historie** mit Version, Zeitstempel, Hash-Kurzform
- Download-Link für jede Version

---

## Reproduzierbarkeit

```
loadReportForPdf() → buildPdfReportData() → generatePdfBuffer() → uploadPdf()
```

`computeReportDataDigest()` bildet einen Hash über alle Quelldaten (Antworten, Signaturen, Metadaten). Gleiche Daten → gleicher `dataDigest`. Der PDF-Hash kann sich bei Layout-Änderungen unterscheiden, der Daten-Digest bleibt stabil.

---

## Datenbank: `PdfExport`

| Feld | Beschreibung |
|---|---|
| `version` | Inkrement pro Report (`@@unique([reportId, version])`) |
| `hash` | SHA-256 des PDF-Files |
| `storageKey` | S3-Pfad |
| `url` | Presigned oder permanente URL |
| `isOfficial` | Markiert den aktuellen offiziellen Export |
| `metadata` | `{ documentId, dataDigest, generatedAt }` |
| `fileSize` | Bytes |
