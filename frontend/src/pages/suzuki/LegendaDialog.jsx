import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Save } from "lucide-react";
import { Field } from "./common";

export default function LegendaDialog({ value, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.sigla?.trim() || !form.significato?.trim()) { toast.error("Sigla e significato obbligatori"); return; }
    setSaving(true);
    try {
      const payload = { ...form, ordine: Number(form.ordine) || 0 };
      if (form.id) await api.put(`/suzuki/legenda/${form.id}`, payload);
      else await api.post("/suzuki/legenda", payload);
      toast.success("Voce salvata");
      onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifica voce" : "Nuova voce legenda"}</DialogTitle>
          <DialogDescription>Le modifiche compaiono automaticamente in tutti i PDF Suzuki.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Sigla *"><Input value={form.sigla || ""} onChange={(e) => set("sigla", e.target.value)} data-testid="in-legenda-sigla" /></Field>
          <Field label="Significato *"><Input value={form.significato || ""} onChange={(e) => set("significato", e.target.value)} data-testid="in-legenda-sig" /></Field>
          <Field label="Gruppo">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.gruppo || ""} onChange={(e) => set("gruppo", e.target.value)} data-testid="in-legenda-gruppo">
              <option value="Lunghezza piede e avviamento">Lunghezza piede e avviamento</option>
              <option value="Comando, tilt e linea">Comando, tilt e linea</option>
              <option value="Altro">Altro</option>
            </select>
          </Field>
          <Field label="Ordine di stampa"><Input type="number" step="1" value={form.ordine ?? 0} onChange={(e) => set("ordine", e.target.value)} /></Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving} data-testid="btn-save-legenda">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
