import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBuilderStore } from './builder-store'
import { useToast } from '@/hooks/use-toast'
import { importTemplateFromJson, TemplateImportError } from '../template-import'

interface TemplateJsonImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplateJsonImportDialog({ open, onOpenChange }: TemplateJsonImportDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isDirty = useBuilderStore((s) => s.isDirty)
  const importTemplate = useBuilderStore((s) => s.importTemplate)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setJsonText(String(reader.result ?? ''))
      setError(null)
    }
    reader.onerror = () => setError('Datei konnte nicht gelesen werden.')
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        'Ungespeicherte Änderungen gehen verloren. Trotzdem importieren?',
      )
      if (!confirmed) return
    }

    try {
      const { template, warnings } = importTemplateFromJson(jsonText.trim())
      importTemplate(template)
      onOpenChange(false)
      setJsonText('')
      setError(null)

      toast({
        title: 'Vorlage importiert',
        description: warnings.length > 0 ? warnings.join(' ') : `${template.sections.length} Abschnitt(e) geladen.`,
      })
    } catch (err) {
      const message = err instanceof TemplateImportError ? err.message : 'Import fehlgeschlagen.'
      setError(message)
      toast({ title: 'Import fehlgeschlagen', description: message, variant: 'destructive' })
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Vorlagen-JSON importieren</DialogTitle>
          <DialogDescription>
            JSON einfügen oder eine .json-Datei hochladen. Unterstützt Builder- und MaintenanceTemplate-Format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Datei wählen
            </Button>
            {isDirty && (
              <p className="text-xs text-orange-600">Ungespeicherte Änderungen werden überschrieben.</p>
            )}
          </div>

          <div className="space-y-1 flex-1 min-h-0 flex flex-col">
            <Label className="text-xs">JSON</Label>
            <Textarea
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value)
                setError(null)
              }}
              placeholder='{"name": "Meine Vorlage", "sections": [...]}'
              className="flex-1 min-h-[240px] font-mono text-xs resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleImport} disabled={!jsonText.trim()}>
            Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
