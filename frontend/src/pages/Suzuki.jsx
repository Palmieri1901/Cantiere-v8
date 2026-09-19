import React, { useEffect, useMemo, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ship, Plus, Pencil, Trash2, FileText, Upload, Sparkles, Search, Save, X, Download, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";

const fmt = (v) => `${Number(v || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const EMPTY_MODEL = {
  codice: "", modello: "", potenza_hp: 0, cilindrata_cc: 0, cilindri: "", alimentazione: "",
  peso_kg: 0, avviamento: "", gambo: "", trim: "", comandi: "", alternatore_A: 0,
  categoria: "", prezzo_listino: 0, prezzo_pubblico: 0, prezzo_offerta: 0,
  sconto_perc_1: 0, sconto_perc_2: 0, note: "",
};

const EMPTY_PREV = {
  cliente_nome: "", cliente_telefono: "", cliente_email: "",
  modello_id: "", codice: "", modello: "", potenza_hp: 0, specifiche: "",
  cilindri: "", cilindrata_cc: 0, alimentazione: "", peso_kg: 0, avviamento: "",
  gambo: "", trim: "", comandi: "", alternatore_A: 0, carburante: "",
  prezzo_listino: 0, prezzo_acquisto_concessionario: 0,
  sconto_perc_1: 0, sconto_perc_2: 0, montaggio: 0, cavetteria: 0,
  note: "", stato: "bozza",
  data: new Date().toISOString().slice(0, 10),
};

// -------------------------------------------------------------------------
// PAGE
// -------------------------------------------------------------------------
export default function Suzuki() {
  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto" data-testid="page-suzuki">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <Ship className="w-6 h-6" strokeWidth={1.8} />
        </div>
        <div>
          <div className="label-mini mb-0.5">Fuoribordo</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Suzuki</h1>
        </div>
      </div>

      <Tabs defaultValue="modelli" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="modelli" data-testid="tab-modelli">Modelli & Listino</TabsTrigger>
          <TabsTrigger value="preventivi" data-testid="tab-preventivi">Preventivi</TabsTrigger>
          <TabsTrigger value="legenda" data-testid="tab-legenda">Legenda sigle</TabsTrigger>
        </TabsList>

        <TabsContent value="modelli">
          <ModelliTab />
        </TabsContent>
        <TabsContent value="preventivi">
          <PreventiviTab />
        </TabsContent>
        <TabsContent value="legenda">
          <LegendaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// -------------------------------------------------------------------------
// MODELLI TAB
// -------------------------------------------------------------------------
function ModelliTab() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/suzuki/modelli", { params: q ? { q } : {} });
      setItems(r.data);
    } catch {
      toast.error("Errore caricamento modelli");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = useMemo(() => {
    if (!q) return items;
    const rx = q.toLowerCase();
    return items.filter((m) =>
      (m.modello || "").toLowerCase().includes(rx) ||
      (m.codice || "").toLowerCase().includes(rx) ||
      (m.categoria || "").toLowerCase().includes(rx)
    );
  }, [items, q]);

  const remove = async (id) => {
    if (!window.confirm("Eliminare questo modello?")) return;
    await api.delete(`/suzuki/modelli/${id}`);
    toast.success("Modello eliminato");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Cerca per modello, codice, categoria…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="input-search-modelli" />
        </div>
        <Button variant="outline" onClick={async () => {
          try {
            const r = await api.post("/suzuki/seed-listino-2025-2026");
            toast.success(`Listino 2025-2026 popolato · ${r.data.created} nuovi, ${r.data.updated} aggiornati`);
            load();
          } catch (e) { toast.error(e.response?.data?.detail || "Errore seed listino"); }
        }} data-testid="btn-seed-listino">
          <Download className="w-4 h-4 mr-2" /> Popola listino 2025-2026
        </Button>
        <Button variant="outline" onClick={() => window.open(`${API}/suzuki/listino.pdf`, "_blank")} data-testid="btn-pdf-listino">
          <FileText className="w-4 h-4 mr-2" /> Listino pubblico
        </Button>
        <Button variant="outline" onClick={() => window.open(`${API}/suzuki/listino-concessionario.pdf`, "_blank")} className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700" data-testid="btn-pdf-listino-conc">
          <FileText className="w-4 h-4 mr-2" /> Listino concessionario
        </Button>
        <Button variant="outline" onClick={() => window.open(`${API}/suzuki/caratteristiche.pdf`, "_blank")} data-testid="btn-pdf-caratt">
          <FileText className="w-4 h-4 mr-2" /> PDF Caratteristiche
        </Button>
        <LogoPdfButton />
        <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="btn-import-ai">
          <Sparkles className="w-4 h-4 mr-2" /> Importa listino con AI
        </Button>
        <Button onClick={() => setEditing({ ...EMPTY_MODEL })} className="bg-primary" data-testid="btn-new-modello">
          <Plus className="w-4 h-4 mr-2" /> Nuovo modello
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-modelli">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Codice</th>
                <th className="text-left px-4 py-3">Modello</th>
                <th className="text-right px-4 py-3">HP</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-right px-4 py-3">Listino</th>
                <th className="text-right px-4 py-3">Sconto</th>
                <th className="text-right px-4 py-3">Netto</th>
                <th className="text-right px-4 py-3 w-24">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">
                  Nessun modello. Aggiungi manualmente oppure importa il listino Suzuki con l'AI.
                </td></tr>
              ) : filtered.map((m) => {
                const netto = m.prezzo_listino * (1 - (m.sconto_perc_1 || 0) / 100) * (1 - (m.sconto_perc_2 || 0) / 100);
                return (
                  <tr key={m.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{m.codice || "—"}</td>
                    <td className="px-4 py-2.5 font-semibold">{m.modello}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{m.potenza_hp || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.categoria || "—"}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{fmt(m.prezzo_listino)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {m.sconto_perc_1 ? `${m.sconto_perc_1}%` : "—"}
                      {m.sconto_perc_2 ? ` + ${m.sconto_perc_2}%` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-primary">{fmt(netto)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...m })} data-testid={`btn-edit-${m.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(m.id)} data-testid={`btn-del-${m.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <ModelloDialog value={editing} onClose={() => setEditing(null)} onSaved={load} />}
      <ImportAIDialog open={importOpen} onClose={() => setImportOpen(false)} onSaved={load} />
    </div>
  );
}

function ModelloDialog({ value, onClose, onSaved }) {
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

// -------------------------------------------------------------------------
// IMPORT AI DIALOG
// -------------------------------------------------------------------------
function ImportAIDialog({ open, onClose, onSaved }) {
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

// -------------------------------------------------------------------------
// PREVENTIVI TAB
// -------------------------------------------------------------------------
function PreventiviTab() {
  const [items, setItems] = useState([]);
  const [modelli, setModelli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewName, setPreviewName] = useState("preventivo.pdf");
  const [pdfLoadingId, setPdfLoadingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [rp, rm] = await Promise.all([api.get("/suzuki/preventivi"), api.get("/suzuki/modelli")]);
      setItems(rp.data); setModelli(rm.data);
    } catch { toast.error("Errore caricamento"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openPdf = async (p) => {
    setPdfLoadingId(p.id);
    try {
      const res = await api.get(`/suzuki/preventivi/${p.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setPreviewName(`preventivo_suzuki_${(p.cliente_nome || "cliente").replace(/[^a-zA-Z0-9]+/g, "_")}_${p.numero || p.id.slice(0, 6)}.pdf`);
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore caricamento PDF");
    } finally { setPdfLoadingId(null); }
  };

  const remove = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await api.delete(`/suzuki/preventivi/${id}`);
    toast.success("Preventivo eliminato"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <CondizioniPreventivoButton />
        <Button onClick={() => setEditing({ ...EMPTY_PREV })} disabled={!modelli.length} className="bg-primary" data-testid="btn-new-preventivo">
          <Plus className="w-4 h-4 mr-2" /> Nuovo preventivo
        </Button>
      </div>
      {!modelli.length && (
        <Card className="p-6 text-sm text-muted-foreground text-center" data-testid="empty-modelli-warn">
          Devi prima aggiungere almeno un modello nella scheda "Modelli & Listino".
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-preventivi">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">N°</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Modello</th>
                <th className="text-right px-4 py-3">Listino</th>
                <th className="text-right px-4 py-3">Sconto</th>
                <th className="text-right px-4 py-3">Totale</th>
                <th className="text-right px-4 py-3 w-32">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Caricamento…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nessun preventivo.</td></tr>
              ) : items.map((p) => {
                const netto = p.prezzo_listino * (1 - (p.sconto_perc_1 || 0) / 100) * (1 - (p.sconto_perc_2 || 0) / 100);
                const totale = netto + (p.montaggio || 0);
                return (
                  <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono">{p.numero || "—"}</td>
                    <td className="px-4 py-2.5">{p.data}</td>
                    <td className="px-4 py-2.5 font-semibold">{p.cliente_nome}</td>
                    <td className="px-4 py-2.5">{p.modello}</td>
                    <td className="px-4 py-2.5 text-right font-mono-num">{fmt(p.prezzo_listino)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                      {p.sconto_perc_1 ? `${p.sconto_perc_1}%` : "—"}{p.sconto_perc_2 ? ` + ${p.sconto_perc_2}%` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-primary">{fmt(totale)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Anteprima PDF" onClick={() => openPdf(p)} disabled={pdfLoadingId === p.id} data-testid={`btn-preview-pdf-${p.id}`}>
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...p })}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <PreventivoDialog value={editing} modelli={modelli} onClose={() => setEditing(null)} onSaved={load} />}

      <PdfPreviewOverlay
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        url={previewUrl}
        filename={previewName}
      />
    </div>
  );
}

function PreventivoDialog({ value, modelli, onClose, onSaved }) {
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

  const calc = useMemo(() => {
    const IVA = 1.22;
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
    return { listino, s1_amt: listino - dopo1, s2_amt: dopo1 - dopo2, netto: dopo2, montaggio, cavetteria, totale: dopo2 + montaggio + cavetteria, acquistoEscl, acquistoIncl, sottoCosto, margine };
  }, [form.prezzo_listino, form.sconto_perc_1, form.sconto_perc_2, form.montaggio, form.cavetteria, form.prezzo_acquisto_concessionario]);

  const genAnteprima = async () => {
    if (!form.cliente_nome?.trim() || !form.modello?.trim()) {
      toast.error("Cliente e modello obbligatori"); return;
    }
    setPreviewLoading(true);
    try {
      const payload = { ...form, prezzo_listino: Number(form.prezzo_listino) || 0, prezzo_acquisto_concessionario: Number(form.prezzo_acquisto_concessionario) || 0, potenza_hp: Number(form.potenza_hp) || 0, sconto_perc_1: Number(form.sconto_perc_1) || 0, sconto_perc_2: Number(form.sconto_perc_2) || 0, montaggio: Number(form.montaggio) || 0, cavetteria: Number(form.cavetteria) || 0 };
      const res = await api.post("/suzuki/preventivi/preview-pdf", payload, { responseType: "blob" });
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
      const payload = { ...form, prezzo_listino: Number(form.prezzo_listino) || 0, prezzo_acquisto_concessionario: Number(form.prezzo_acquisto_concessionario) || 0, potenza_hp: Number(form.potenza_hp) || 0, sconto_perc_1: Number(form.sconto_perc_1) || 0, sconto_perc_2: Number(form.sconto_perc_2) || 0, montaggio: Number(form.montaggio) || 0, cavetteria: Number(form.cavetteria) || 0 };
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
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Costo acquisto conc. (IVA incl. 22%)</span><span className="font-mono-num">{fmt(calc.acquistoIncl)}</span></div>
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

          {/* preview inline rimossa: ora usa modale a schermo intero */}
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

// -------------------------------------------------------------------------
// CONDIZIONI PREVENTIVO (footer editabile)
// -------------------------------------------------------------------------
function CondizioniPreventivoButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/suzuki/condizioni-preventivo");
      setText((r.data.righe || []).join("\n"));
    } catch { toast.error("Errore caricamento condizioni"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const righe = text.split("\n").map((s) => s.trim()).filter(Boolean);
      await api.put("/suzuki/condizioni-preventivo", { righe });
      toast.success("Condizioni salvate. Verranno usate nei prossimi PDF.");
      setOpen(false);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm("Ripristinare le condizioni originali?")) return;
    try {
      const r = await api.post("/suzuki/condizioni-preventivo/reset");
      setText((r.data.righe || []).join("\n"));
      toast.success("Condizioni ripristinate");
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="btn-condizioni">
        <FileText className="w-4 h-4 mr-2" /> Condizioni preventivo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Condizioni preventivo</DialogTitle>
            <DialogDescription>
              Testo stampato in fondo a ogni PDF preventivo Suzuki. Una condizione per riga (le righe vuote vengono ignorate).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder={loading ? "Caricamento…" : "Preventivo valido 30 giorni salvo esaurimento scorte.\nConsegna e montaggio da concordare…"}
            disabled={loading}
            data-testid="txt-condizioni"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={reset} data-testid="btn-condizioni-reset">Ripristina originali</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving || loading} data-testid="btn-condizioni-save">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -------------------------------------------------------------------------
// LEGENDA TAB
// -------------------------------------------------------------------------
function LegendaTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/suzuki/legenda");
      setItems(r.data);
    } catch {
      toast.error("Errore caricamento legenda");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Eliminare questa voce?")) return;
    await api.delete(`/suzuki/legenda/${id}`);
    toast.success("Voce eliminata");
    load();
  };

  const resetDefaults = async () => {
    if (!window.confirm("Ripristinare la legenda originale? Tutte le modifiche verranno perse.")) return;
    try {
      const r = await api.post("/suzuki/legenda/reset-defaults");
      toast.success(`Legenda ripristinata (${r.data.count} voci).`);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore ripristino"); }
  };

  const gruppi = useMemo(() => {
    const map = new Map();
    for (const v of items) {
      const g = v.gruppo || "Altro";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(v);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <p className="text-sm text-muted-foreground flex-1 min-w-[240px]">
          La legenda viene stampata su Preventivo, Listino e Caratteristiche.
        </p>
        <Button variant="outline" onClick={resetDefaults} data-testid="btn-reset-legenda">
          <Download className="w-4 h-4 mr-2" /> Ripristina originale
        </Button>
        <Button onClick={() => setEditing({ sigla: "", significato: "", gruppo: "Lunghezza piede e avviamento", ordine: (items.at(-1)?.ordine || 0) + 10 })} className="bg-primary" data-testid="btn-new-legenda">
          <Plus className="w-4 h-4 mr-2" /> Nuova voce
        </Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Caricamento…</Card>
      ) : gruppi.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Nessuna voce. Ripristina l'elenco originale o aggiungi una nuova voce.</Card>
      ) : gruppi.map(([gruppo, voci]) => (
        <Card key={gruppo} className="overflow-hidden">
          <div className="bg-primary text-primary-foreground px-4 py-2.5 font-semibold text-sm uppercase tracking-wider">
            {gruppo}
          </div>
          <table className="w-full text-sm" data-testid={`table-legenda-${gruppo}`}>
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 w-24">Sigla</th>
                <th className="text-left px-4 py-2">Significato</th>
                <th className="text-right px-4 py-2 w-20">Ordine</th>
                <th className="text-right px-4 py-2 w-24">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {voci.map((v) => (
                <tr key={v.id} className="border-t border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono font-bold">{v.sigla}</td>
                  <td className="px-4 py-2">{v.significato}</td>
                  <td className="px-4 py-2 text-right font-mono-num text-xs text-muted-foreground">{v.ordine}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...v })} data-testid={`btn-edit-legenda-${v.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(v.id)} data-testid={`btn-del-legenda-${v.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      {editing && <LegendaDialog value={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function LegendaDialog({ value, onClose, onSaved }) {
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

// -------------------------------------------------------------------------
// COMMON
// -------------------------------------------------------------------------
function LogoPdfButton() {
  const [open, setOpen] = useState(false);
  const [bust, setBust] = useState(Date.now());
  const [uploading, setUploading] = useState(false);
  const inputRef = React.useRef(null);
  const src = `${API}/suzuki/logo?t=${bust}`;

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post("/suzuki/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Logo aggiornato. I nuovi PDF useranno questo logo.");
      setBust(Date.now());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore upload logo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = async () => {
    if (!window.confirm("Rimuovere il logo? I PDF verranno stampati senza intestazione grafica.")) return;
    try {
      await api.delete("/suzuki/logo");
      toast.success("Logo rimosso");
      setBust(Date.now());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore");
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="btn-logo-pdf">
        <ImageIcon className="w-4 h-4 mr-2" /> Logo PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Logo intestazione PDF Suzuki</DialogTitle>
            <DialogDescription>
              Il logo comparirà in cima a Preventivo, Listino e Caratteristiche. Formati supportati: PNG, JPG, WebP · max 5 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border rounded-lg bg-muted/30 p-4 flex items-center justify-center min-h-[140px]">
              <img
                src={src}
                alt="Logo attuale"
                className="max-h-32 object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.innerHTML = '<div class="text-sm text-muted-foreground">Nessun logo impostato</div>'; }}
                data-testid="img-logo-preview"
              />
            </div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" data-testid="input-logo-file" />
            <div className="flex gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex-1" data-testid="btn-upload-logo">
                <Upload className="w-4 h-4 mr-2" /> {uploading ? "Caricamento…" : "Carica nuovo logo"}
              </Button>
              <Button variant="outline" onClick={reset} data-testid="btn-reset-logo">
                <Trash2 className="w-4 h-4 mr-2" /> Rimuovi
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
