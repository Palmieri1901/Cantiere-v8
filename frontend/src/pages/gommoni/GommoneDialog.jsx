import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { X, Save } from "lucide-react";
import { Field, gommonePayload } from "./common";

export default function GommoneDialog({ value, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !form.id;

  const save = async () => {
    if (!form.modello?.trim()) { toast.error("Nome modello obbligatorio"); return; }
    setSaving(true);
    try {
      const payload = gommonePayload(form);
      if (isNew) await api.post("/gommoni/modelli", payload);
      else await api.put(`/gommoni/modelli/${form.id}`, payload);
      toast.success("Gommone salvato");
      onSaved(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally { setSaving(false); }
  };

  const num = (k, label, step = "0.01", testid) => (
    <Field label={label}><Input type="number" step={step} value={form[k] || ""} onChange={(e) => set(k, e.target.value)} data-testid={testid} /></Field>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" data-testid="dialog-gommone">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo gommone GEB" : "Modifica gommone"}</DialogTitle>
          <DialogDescription>Caratteristiche tecniche e prezzo pubblico (IVA inclusa).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="col-span-2"><Field label="Modello *"><Input value={form.modello || ""} onChange={(e) => set("modello", e.target.value)} placeholder="GEB 620 Open" data-testid="g-modello" /></Field></div>
          {num("prezzo_pubblico", "Prezzo pubblico € (IVA incl.)", "0.01", "g-prezzo")}
          {num("ordine", "Ordine listino", "1")}
          {num("lunghezza_m", "Lunghezza (m)", "0.01", "g-lunghezza")}
          {num("larghezza_m", "Larghezza (m)", "0.01")}
          {num("diametro_tubolare_cm", "Ø tubolare (cm)", "1")}
          {num("compartimenti", "Compartimenti", "1")}
          {num("portata_persone", "Portata persone", "1")}
          {num("potenza_max_hp", "Potenza max (HP)", "1")}
          {num("peso_kg", "Peso (kg)", "1")}
          <Field label="Carena"><Input value={form.carena || ""} onChange={(e) => set("carena", e.target.value)} placeholder="V profonda" /></Field>
          <div className="col-span-2 md:col-span-4"><Field label="Tessuto tubolare"><Input value={form.tessuto || ""} onChange={(e) => set("tessuto", e.target.value)} placeholder="Hypalon / PVC 1100 dtex" /></Field></div>
          <div className="col-span-2 md:col-span-4"><Field label="Dotazioni di serie"><Textarea value={form.dotazioni || ""} onChange={(e) => set("dotazioni", e.target.value)} rows={3} data-testid="g-dotazioni" /></Field></div>
          <div className="col-span-2 md:col-span-4"><Field label="Note"><Textarea value={form.note || ""} onChange={(e) => set("note", e.target.value)} rows={2} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" /> Annulla</Button>
          <Button onClick={save} disabled={saving} className="bg-primary" data-testid="btn-save-gommone">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
