import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, Save, AlertTriangle } from "lucide-react";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";
import { Field, fmt } from "./common";

export default function PreventivoDialog({ value, modelli, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickModello = (mid) => {
    const m = modelli.find((x) => x.id === mid);
    if (!m) { set("modello_id", ""); return; }
    const specifiche = [m.cilindri, m.cilindrata_cc ? `${m.cilindrata_cc} cc` : "", m.alimentazione, m.peso_kg ? `${m.peso_kg} kg` : "", m.gambo ? `gambo ${m.gambo}` : "", m.trim, m.avviamento].filter(Boolean).join(" · ");
    setForm((f) => ({
      ...f,
      modello_id: mid, codice: m.codice || "", modello: m.modello,
      potenza_hp: m.potenza_hp || 0, specifiche,
      cilindri: m.cilindri || "",
      cilindrata_cc: m.cilindrata_cc || 0,
      alimentazione: m.alimentazione || "",
      peso_kg: m.peso_kg || 0,
      avviamento: m.avviamento || "",
      gambo: m.gambo || "",
      trim: m.trim || "",
      comandi: m.comandi || "",
      alternatore_A: m.alternatore_A || 0,
      carburante: m.carburante || "",
      prezzo_listino: m.prezzo_offerta || m.prezzo_pubblico || m.prezzo_listino || 0,
      prezzo_acquisto_concessionario: m.prezzo_listino || 0,
      sconto_perc_1: m.sconto_perc_1 || 0, sconto_perc_2: m.sconto_perc_2 || 0,
    }));
  };

  const [cantiere, setCantiere] = useState(null);
  useEffect(() => {
    let alive = true;
    api.get("/cantiere").then((r) => { if (alive) setCantiere(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const ivaPerc = Number(cantiere?.iva_percentuale ?? 22);

  const calc = useMemo(() => {
    const IVA = 1 + (ivaPerc / 100);
    const listino = Number(form.prezzo_listino || 0);
    const s1 = Number(form.sconto_perc_1 || 0);
    const s2 = Number(form.sconto_perc_2 || 0);
    const dopo1 = listino * (1 - s1 / 100);
    const dopo2 = dopo1 * (1 - s2 / 100);
    const montaggio = Number(form.montaggio || 0);
    const cavetteria = Number(form.cavetteria || 0);
    const acquistoEscl = Number(form.prezzo_acquisto_concessionario || 0);
    const acquistoIncl = acquistoEscl * IVA;
    const sottoCosto = acquistoIncl > 0 && dopo2 < acquistoIncl;
    const margine = acquistoIncl > 0 ? dopo2 - acquistoIncl : 0;
    return { listino, s1_amt: listino - dopo1, s2_amt: dopo1 - dopo2, netto: dopo2, montaggio, cavetteria, totale: dopo2 + montaggio + cavetteria, acquistoEscl, acquistoIncl, sottoCosto, margine, ivaPerc };
  }, [form.prezzo_listino, form.sconto_perc_1, form.sconto_perc_2, form.montaggio, form.cavetteria, form.prezzo_acquisto_concessionario, ivaPerc]);

  const buildPayload = () => ({
    ...form,
    prezzo_listino: Number(form.prezzo_listino) || 0,
    prezzo_acquisto_concessionario: Number(form.prezzo_acquisto_concessionario) || 0,
    potenza_hp: Number(form.potenza_hp) || 0,
    sconto_perc_1: Number(form.sconto_perc_1) || 0,
    sconto_perc_2: Number(form.sconto_perc_2) || 0,
    montaggio: Number(form.montaggio) || 0,
    cavetteria: Number(form.cavetteria) || 0,
  });

  const genAnteprima = async () => {
    if (!form.cliente_nome?.trim() || !form.modello?.trim()) {
      toast.error("Cliente e modello obbligatori"); return;
    }
    setPreviewLoading(true);
    try {
      const res = await api.post("/suzuki/preventivi/preview-pdf", buildPayload(), { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore anteprima");
    } finally { setPreviewLoading(false); }
  };

  const save = async () => {
    if (!form.cliente_nome?.trim() || !form.modello?.trim()) { toast.error("Cliente e modello obbligatori"); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (form.id) await api.put(`/suzuki/preventivi/${form.id}`, payload);
      else await api.post("/suzuki/preventivi", payload);
      toast.success("Preventivo salvato");
      onSaved(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{form.id ? `Preventivo ${form.numero || ""}` : "Nuovo preventivo Suzuki"}</DialogTitle>
          <DialogDescription>Compila i dati; il preventivo si salva solo alla pressione di "Salva".</DialogDescription>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_auto] gap-4">
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            {/* Cliente */}
            <Card className="p-4">
              <div className="label-mini mb-2">Cliente</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Nome e cognome *"><Input value={form.cliente_nome || ""} onChange={(e) => set("cliente_nome", e.target.value)} data-testid="p-nome" /></Field>
                <Field label="Telefono"><Input value={form.cliente_telefono || ""} onChange={(e) => set("cliente_telefono", e.target.value)} /></Field>
                <Field label="Email"><Input value={form.cliente_email || ""} onChange={(e) => set("cliente_email", e.target.value)} /></Field>
              </div>
            </Card>

            {/* Modello */}
            <Card className="p-4">
              <div className="label-mini mb-2">Modello Suzuki</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Seleziona dal catalogo">
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.modello_id || ""} onChange={(e) => pickModello(e.target.value)} data-testid="p-select-modello">
                    <option value="">— seleziona —</option>
                    {modelli.map((m) => (
                      <option key={m.id} value={m.id}>{m.modello} · {m.potenza_hp} HP</option>
                    ))}
                  </select>
                </Field>
                <Field label="Codice"><Input value={form.codice || ""} onChange={(e) => set("codice", e.target.value)} /></Field>
                <Field label="Modello"><Input value={form.modello || ""} onChange={(e) => set("modello", e.target.value)} data-testid="p-modello" /></Field>
              </div>
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Scheda tecnica</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Field label="Cilindri"><Input value={form.cilindri || ""} onChange={(e) => set("cilindri", e.target.value)} data-testid="p-cilindri" /></Field>
                  <Field label="Cilindrata (cc)"><Input type="number" step="1" value={form.cilindrata_cc || ""} onChange={(e) => set("cilindrata_cc", e.target.value)} data-testid="p-cc" /></Field>
                  <Field label="Alimentazione"><Input value={form.alimentazione || ""} onChange={(e) => set("alimentazione", e.target.value)} /></Field>
                  <Field label="Peso (kg)"><Input type="number" step="0.1" value={form.peso_kg || ""} onChange={(e) => set("peso_kg", e.target.value)} /></Field>
                  <Field label="Gambo"><Input value={form.gambo || ""} onChange={(e) => set("gambo", e.target.value)} /></Field>
                  <Field label="Trim"><Input value={form.trim || ""} onChange={(e) => set("trim", e.target.value)} /></Field>
                  <Field label="Avviamento"><Input value={form.avviamento || ""} onChange={(e) => set("avviamento", e.target.value)} /></Field>
                  <Field label="Alternatore (A)"><Input type="number" step="1" value={form.alternatore_A || ""} onChange={(e) => set("alternatore_A", e.target.value)} /></Field>
                  <Field label="Carburante"><Input value={form.carburante || ""} onChange={(e) => set("carburante", e.target.value)} /></Field>
                </div>
              </div>
            </Card>

            {/* Prezzi */}
            <Card className="p-4">
              <div className="label-mini mb-2">Prezzi & sconti</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Field label="Prezzo pubblico € (IVA incl.) *"><Input type="number" step="0.01" value={form.prezzo_listino || ""} onChange={(e) => set("prezzo_listino", e.target.value)} data-testid="p-listino" /></Field>
                <Field label="Costo acquisto conc. € (IVA escl.)"><Input type="number" step="0.01" value={form.prezzo_acquisto_concessionario || ""} onChange={(e) => set("prezzo_acquisto_concessionario", e.target.value)} data-testid="p-acquisto" /></Field>
                <Field label="Sconto 1 (%)"><Input type="number" step="0.5" value={form.sconto_perc_1 || ""} onChange={(e) => set("sconto_perc_1", e.target.value)} data-testid="p-sc1" /></Field>
                <Field label="Sconto 2 (%)"><Input type="number" step="0.5" value={form.sconto_perc_2 || ""} onChange={(e) => set("sconto_perc_2", e.target.value)} data-testid="p-sc2" /></Field>
                <Field label="Montaggio € (IVA incl.)"><Input type="number" step="0.01" value={form.montaggio || ""} onChange={(e) => set("montaggio", e.target.value)} data-testid="p-montaggio" /></Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
                <Field label="Cavetteria € (IVA incl.)"><Input type="number" step="0.01" value={form.cavetteria || ""} onChange={(e) => set("cavetteria", e.target.value)} data-testid="p-cavetteria" /></Field>
              </div>
              <div className="mt-3 text-sm space-y-1 bg-muted/40 rounded-md p-3">
                <div className="flex justify-between"><span>Prezzo pubblico</span><span className="font-mono-num">{fmt(calc.listino)}</span></div>
                {calc.s1_amt > 0 && <div className="flex justify-between text-muted-foreground"><span>Sconto 1 ({form.sconto_perc_1}%)</span><span className="font-mono-num">− {fmt(calc.s1_amt)}</span></div>}
                {calc.s2_amt > 0 && <div className="flex justify-between text-muted-foreground"><span>Sconto 2 ({form.sconto_perc_2}%)</span><span className="font-mono-num">− {fmt(calc.s2_amt)}</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1"><span>Netto motore</span><span className="font-mono-num">{fmt(calc.netto)}</span></div>
                {calc.acquistoIncl > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Costo acquisto conc. (IVA incl. {calc.ivaPerc}%)</span><span className="font-mono-num">{fmt(calc.acquistoIncl)}</span></div>
                )}
                {calc.acquistoIncl > 0 && (
                  <div className={`flex justify-between text-xs ${calc.sottoCosto ? "text-destructive font-semibold" : "text-emerald-700"}`}>
                    <span>Margine motore</span>
                    <span className="font-mono-num" data-testid="p-margine">{calc.margine >= 0 ? "+ " : "− "}{fmt(Math.abs(calc.margine))}</span>
                  </div>
                )}
                {calc.montaggio > 0 && <div className="flex justify-between"><span>Montaggio</span><span className="font-mono-num">+ {fmt(calc.montaggio)}</span></div>}
                {calc.cavetteria > 0 && <div className="flex justify-between"><span>Cavetteria</span><span className="font-mono-num">+ {fmt(calc.cavetteria)}</span></div>}
                <div className="flex justify-between font-bold text-primary text-base border-t pt-1"><span>Totale IVA inclusa</span><span className="font-mono-num" data-testid="p-totale">{fmt(calc.totale)}</span></div>
              </div>
              {calc.sottoCosto && (
                <div className="mt-3 rounded-md border-2 border-destructive/70 bg-destructive/10 p-3 flex items-start gap-2" data-testid="alert-sotto-costo">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-bold text-destructive">Attenzione: prezzo sotto costo</div>
                    <div className="text-destructive/90 mt-0.5">
                      Il netto motore ({fmt(calc.netto)}) è inferiore al costo di acquisto concessionario IVA inclusa ({fmt(calc.acquistoIncl)}). Perdita di {fmt(Math.abs(calc.margine))}.
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Field label="Note"><Textarea value={form.note || ""} onChange={(e) => set("note", e.target.value)} rows={2} /></Field>
          </div>
        </div>

        <PdfPreviewOverlay
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          url={previewUrl}
          filename={`preventivo_suzuki_${(form.cliente_nome || "cliente").replace(/[^a-zA-Z0-9]+/g, "_")}_${form.numero || "bozza"}.pdf`}
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={genAnteprima} disabled={previewLoading} data-testid="btn-preview-suzuki">
            <FileText className="w-4 h-4 mr-2" /> {previewLoading ? "Generazione…" : "Anteprima PDF"}
          </Button>
          {previewUrl && !previewOpen && (
            <Button variant="outline" onClick={() => setPreviewOpen(true)} data-testid="btn-riapri-anteprima">
              <FileText className="w-4 h-4 mr-2" /> Riapri anteprima
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving} className="bg-primary" data-testid="btn-save-suzuki">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : "Salva preventivo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
