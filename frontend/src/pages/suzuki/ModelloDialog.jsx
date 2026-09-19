import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { X, Save } from "lucide-react";
import { Field } from "./common";

export default function ModelloDialog({ value, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !form.id;

  const save = async () => {
    if (!form.modello?.trim()) { toast.error("Nome modello obbligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        potenza_hp: Number(form.potenza_hp) || 0,
        cilindrata_cc: Number(form.cilindrata_cc) || 0,
        peso_kg: Number(form.peso_kg) || 0,
        alternatore_A: Number(form.alternatore_A) || 0,
        prezzo_listino: Number(form.prezzo_listino) || 0,
        prezzo_pubblico: Number(form.prezzo_pubblico) || 0,
        prezzo_offerta: Number(form.prezzo_offerta) || 0,
        sconto_perc_1: Number(form.sconto_perc_1) || 0,
        sconto_perc_2: Number(form.sconto_perc_2) || 0,
      };
      if (isNew) await api.post("/suzuki/modelli", payload);
      else await api.put(`/suzuki/modelli/${form.id}`, payload);
      toast.success("Modello salvato");
      onSaved(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nuovo modello Suzuki" : "Modifica modello"}</DialogTitle>
          <DialogDescription>Dati tecnici, prezzo listino e sconti composti applicati.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <Field label="Codice articolo"><Input value={form.codice || ""} onChange={(e) => set("codice", e.target.value)} data-testid="m-codice" /></Field>
          <Field label="Modello *"><Input value={form.modello || ""} onChange={(e) => set("modello", e.target.value)} placeholder="DF150ATL" data-testid="m-modello" /></Field>
          <Field label="Potenza (HP)"><Input type="number" step="0.5" value={form.potenza_hp || ""} onChange={(e) => set("potenza_hp", e.target.value)} data-testid="m-hp" /></Field>
          <Field label="Categoria"><Input value={form.categoria || ""} onChange={(e) => set("categoria", e.target.value)} placeholder="Portable/Mid/V6" data-testid="m-cat" /></Field>
          <Field label="Cilindrata (cc)"><Input type="number" value={form.cilindrata_cc || ""} onChange={(e) => set("cilindrata_cc", e.target.value)} /></Field>
          <Field label="Cilindri"><Input value={form.cilindri || ""} onChange={(e) => set("cilindri", e.target.value)} placeholder="4 in linea" /></Field>
          <Field label="Alimentazione"><Input value={form.alimentazione || ""} onChange={(e) => set("alimentazione", e.target.value)} placeholder="EFI" /></Field>
          <Field label="Peso (kg)"><Input type="number" step="0.1" value={form.peso_kg || ""} onChange={(e) => set("peso_kg", e.target.value)} /></Field>
          <Field label="Avviamento"><Input value={form.avviamento || ""} onChange={(e) => set("avviamento", e.target.value)} placeholder="elettrico" /></Field>
          <Field label="Gambo"><Input value={form.gambo || ""} onChange={(e) => set("gambo", e.target.value)} placeholder="S/L/UL/XL" /></Field>
          <Field label="Trim"><Input value={form.trim || ""} onChange={(e) => set("trim", e.target.value)} placeholder="PT&T" /></Field>
          <Field label="Comandi"><Input value={form.comandi || ""} onChange={(e) => set("comandi", e.target.value)} placeholder="a distanza" /></Field>
          <Field label="Alternatore (A)"><Input type="number" value={form.alternatore_A || ""} onChange={(e) => set("alternatore_A", e.target.value)} /></Field>
          <Field label="Prezzo listino € (IVA escl.) *"><Input type="number" step="0.01" value={form.prezzo_listino || ""} onChange={(e) => set("prezzo_listino", e.target.value)} data-testid="m-listino" /></Field>
          <Field label="Pubblico € (IVA incl.)"><Input type="number" step="0.01" value={form.prezzo_pubblico || ""} onChange={(e) => set("prezzo_pubblico", e.target.value)} data-testid="m-pubblico" /></Field>
          <Field label="Prezzo in offerta € (IVA incl.)"><Input type="number" step="0.01" value={form.prezzo_offerta || ""} onChange={(e) => set("prezzo_offerta", e.target.value)} placeholder="solo se in promo" data-testid="m-offerta" /></Field>
          <Field label="Sconto 1 (%)"><Input type="number" step="0.5" value={form.sconto_perc_1 || ""} onChange={(e) => set("sconto_perc_1", e.target.value)} data-testid="m-sc1" /></Field>
          <Field label="Sconto 2 (%)"><Input type="number" step="0.5" value={form.sconto_perc_2 || ""} onChange={(e) => set("sconto_perc_2", e.target.value)} data-testid="m-sc2" /></Field>
          <div className="col-span-2 md:col-span-4">
            <Field label="Note"><Textarea value={form.note || ""} onChange={(e) => set("note", e.target.value)} rows={2} /></Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="w-4 h-4 mr-2" /> Annulla</Button>
          <Button onClick={save} disabled={saving} className="bg-primary" data-testid="btn-save-modello">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
