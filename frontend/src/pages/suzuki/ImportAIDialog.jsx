import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Save, Trash2 } from "lucide-react";

export default function ImportAIDialog({ open, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setFile(null); setRows([]); };

  const handleFile = (e) => {
    setRows([]);
    setFile(e.target.files?.[0] || null);
  };

  const scan = async () => {
    if (!file) { toast.error("Seleziona un file (PDF o immagine)"); return; }
    setScanning(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""));
      const r = await api.post("/suzuki/import-ai", { file_base64: b64, file_name: file.name });
      setRows(r.data.modelli || []);
      if (!r.data.modelli?.length) toast.warning("Nessun modello trovato nel file");
      else toast.success(`${r.data.modelli.length} modelli trovati — controlla e conferma`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore scansione AI");
    } finally {
      setScanning(false);
    }
  };

  const saveAll = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      await api.post("/suzuki/modelli/bulk", { modelli: rows });
      toast.success(`${rows.length} modelli importati`);
      onSaved(); reset(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (i, k, v) => {
    setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  };
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Import listino Suzuki con AI</DialogTitle>
          <DialogDescription>
            Carica il listino ufficiale Suzuki (PDF o immagine). L'AI Gemini estrarrà tutti i modelli con prezzi e specifiche.
            Puoi rivedere e correggere prima di salvare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File listino</Label>
              <Input type="file" accept=".pdf,image/*" onChange={handleFile} className="mt-1.5" data-testid="input-import-file" />
              {file && <div className="text-xs text-muted-foreground mt-1">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>}
            </div>
            <Button onClick={scan} disabled={!file || scanning} className="bg-primary" data-testid="btn-scan-ai">
              <Sparkles className="w-4 h-4 mr-2" /> {scanning ? "Analisi in corso…" : "Analizza con AI"}
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center justify-between">
                <span>{rows.length} modelli trovati — controlla e conferma</span>
              </div>
              <div className="max-h-[45vh] overflow-y-auto">
                <table className="w-full text-xs" data-testid="table-import-preview">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Codice</th>
                      <th className="text-left p-2">Modello</th>
                      <th className="text-right p-2 w-16">HP</th>
                      <th className="text-right p-2 w-24">Prezzo €</th>
                      <th className="text-right p-2 w-14">Sc.1</th>
                      <th className="text-right p-2 w-14">Sc.2</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="p-1"><Input className="h-7 text-xs" value={r.codice || ""} onChange={(e) => updateRow(i, "codice", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7 text-xs" value={r.modello || ""} onChange={(e) => updateRow(i, "modello", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7 text-xs text-right font-mono" type="number" step="0.5" value={r.potenza_hp || 0} onChange={(e) => updateRow(i, "potenza_hp", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7 text-xs text-right font-mono" type="number" step="0.01" value={r.prezzo_listino || 0} onChange={(e) => updateRow(i, "prezzo_listino", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7 text-xs text-right" type="number" value={r.sconto_perc_1 || 0} onChange={(e) => updateRow(i, "sconto_perc_1", e.target.value)} /></td>
                        <td className="p-1"><Input className="h-7 text-xs text-right" type="number" value={r.sconto_perc_2 || 0} onChange={(e) => updateRow(i, "sconto_perc_2", e.target.value)} /></td>
                        <td className="p-1 text-center"><button onClick={() => removeRow(i)} className="text-destructive hover:opacity-70"><Trash2 className="w-3.5 h-3.5" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Annulla</Button>
          {rows.length > 0 && (
            <Button onClick={saveAll} disabled={saving} className="bg-primary" data-testid="btn-import-save">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : `Salva ${rows.length} modelli`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
