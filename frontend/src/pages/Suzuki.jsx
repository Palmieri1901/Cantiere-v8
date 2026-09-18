import { useEffect, useMemo, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ship, Plus, Pencil, Trash2, FileText, Upload, Sparkles, Search, Save, X, Download } from "lucide-react";

const fmt = (v) => `${Number(v || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const EMPTY_MODEL = {
  codice: "", modello: "", potenza_hp: 0, cilindrata_cc: 0, cilindri: "", alimentazione: "",
  peso_kg: 0, avviamento: "", gambo: "", trim: "", comandi: "", alternatore_A: 0,
  categoria: "", prezzo_listino: 0, sconto_perc_1: 0, sconto_perc_2: 0, note: "",
};

const EMPTY_PREV = {
  cliente_nome: "", cliente_telefono: "", cliente_email: "",
  modello_id: "", codice: "", modello: "", potenza_hp: 0, specifiche: "",
  prezzo_listino: 0, sconto_perc_1: 0, sconto_perc_2: 0, montaggio: 0,
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
        </TabsList>

        <TabsContent value="modelli">
          <ModelliTab />
        </TabsContent>
        <TabsContent value="preventivi">
          <PreventiviTab />
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
          <FileText className="w-4 h-4 mr-2" /> PDF Listino
        </Button>
        <Button variant="outline" onClick={() => window.open(`${API}/suzuki/caratteristiche.pdf`, "_blank")} data-testid="btn-pdf-caratt">
          <FileText className="w-4 h-4 mr-2" /> PDF Caratteristiche
        </Button>
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

  const load = async () => {
    setLoading(true);
    try {
      const [rp, rm] = await Promise.all([api.get("/suzuki/preventivi"), api.get("/suzuki/modelli")]);
      setItems(rp.data); setModelli(rm.data);
    } catch { toast.error("Errore caricamento"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await api.delete(`/suzuki/preventivi/${id}`);
    toast.success("Preventivo eliminato"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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
                        <a href={`${API}/suzuki/preventivi/${p.id}/pdf`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Scarica PDF"><FileText className="w-3.5 h-3.5" /></Button>
                        </a>
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
    </div>
  );
}

function PreventivoDialog({ value, modelli, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickModello = (mid) => {
    const m = modelli.find((x) => x.id === mid);
    if (!m) { set("modello_id", ""); return; }
    const specifiche = [m.cilindri, m.cilindrata_cc ? `${m.cilindrata_cc} cc` : "", m.alimentazione, m.peso_kg ? `${m.peso_kg} kg` : "", m.gambo ? `gambo ${m.gambo}` : "", m.trim, m.avviamento].filter(Boolean).join(" · ");
    setForm((f) => ({
      ...f,
      modello_id: mid, codice: m.codice || "", modello: m.modello,
      potenza_hp: m.potenza_hp || 0, specifiche,
      prezzo_listino: m.prezzo_listino || 0,
      sconto_perc_1: m.sconto_perc_1 || 0, sconto_perc_2: m.sconto_perc_2 || 0,
    }));
  };

  const calc = useMemo(() => {
    const listino = Number(form.prezzo_listino || 0);
    const s1 = Number(form.sconto_perc_1 || 0);
    const s2 = Number(form.sconto_perc_2 || 0);
    const dopo1 = listino * (1 - s1 / 100);
    const dopo2 = dopo1 * (1 - s2 / 100);
    const montaggio = Number(form.montaggio || 0);
    return { listino, s1_amt: listino - dopo1, s2_amt: dopo1 - dopo2, netto: dopo2, montaggio, totale: dopo2 + montaggio };
  }, [form.prezzo_listino, form.sconto_perc_1, form.sconto_perc_2, form.montaggio]);

  const genAnteprima = async () => {
    if (!form.cliente_nome?.trim() || !form.modello?.trim()) {
      toast.error("Cliente e modello obbligatori"); return;
    }
    setPreviewLoading(true);
    try {
      const payload = { ...form, prezzo_listino: Number(form.prezzo_listino) || 0, potenza_hp: Number(form.potenza_hp) || 0, sconto_perc_1: Number(form.sconto_perc_1) || 0, sconto_perc_2: Number(form.sconto_perc_2) || 0, montaggio: Number(form.montaggio) || 0 };
      const res = await api.post("/suzuki/preventivi/preview-pdf", payload, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore anteprima");
    } finally { setPreviewLoading(false); }
  };

  const save = async () => {
    if (!form.cliente_nome?.trim() || !form.modello?.trim()) { toast.error("Cliente e modello obbligatori"); return; }
    setSaving(true);
    try {
      const payload = { ...form, prezzo_listino: Number(form.prezzo_listino) || 0, potenza_hp: Number(form.potenza_hp) || 0, sconto_perc_1: Number(form.sconto_perc_1) || 0, sconto_perc_2: Number(form.sconto_perc_2) || 0, montaggio: Number(form.montaggio) || 0 };
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
              <Field label="Specifiche tecniche (compilate automaticamente)" className="mt-3">
                <Textarea value={form.specifiche || ""} onChange={(e) => set("specifiche", e.target.value)} rows={2} data-testid="p-spec" />
              </Field>
            </Card>

            {/* Prezzi */}
            <Card className="p-4">
              <div className="label-mini mb-2">Prezzi & sconti</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Prezzo listino € (IVA escl.) *"><Input type="number" step="0.01" value={form.prezzo_listino || ""} onChange={(e) => set("prezzo_listino", e.target.value)} data-testid="p-listino" /></Field>
                <Field label="Sconto 1 (%)"><Input type="number" step="0.5" value={form.sconto_perc_1 || ""} onChange={(e) => set("sconto_perc_1", e.target.value)} data-testid="p-sc1" /></Field>
                <Field label="Sconto 2 (%)"><Input type="number" step="0.5" value={form.sconto_perc_2 || ""} onChange={(e) => set("sconto_perc_2", e.target.value)} data-testid="p-sc2" /></Field>
                <Field label="Montaggio € (IVA escl.)"><Input type="number" step="0.01" value={form.montaggio || ""} onChange={(e) => set("montaggio", e.target.value)} data-testid="p-montaggio" /></Field>
              </div>
              <div className="mt-3 text-sm space-y-1 bg-muted/40 rounded-md p-3">
                <div className="flex justify-between"><span>Listino</span><span className="font-mono-num">{fmt(calc.listino)}</span></div>
                {calc.s1_amt > 0 && <div className="flex justify-between text-muted-foreground"><span>Sconto 1 ({form.sconto_perc_1}%)</span><span className="font-mono-num">− {fmt(calc.s1_amt)}</span></div>}
                {calc.s2_amt > 0 && <div className="flex justify-between text-muted-foreground"><span>Sconto 2 ({form.sconto_perc_2}%)</span><span className="font-mono-num">− {fmt(calc.s2_amt)}</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1"><span>Netto motore</span><span className="font-mono-num">{fmt(calc.netto)}</span></div>
                {calc.montaggio > 0 && <div className="flex justify-between"><span>Montaggio</span><span className="font-mono-num">+ {fmt(calc.montaggio)}</span></div>}
                <div className="flex justify-between font-bold text-primary text-base border-t pt-1"><span>Totale + IVA</span><span className="font-mono-num" data-testid="p-totale">{fmt(calc.totale)}</span></div>
              </div>
            </Card>

            <Field label="Note"><Textarea value={form.note || ""} onChange={(e) => set("note", e.target.value)} rows={2} /></Field>
          </div>

          {/* Preview */}
          {previewUrl && (
            <div className="hidden xl:block w-[420px]" data-testid="preview-area">
              <div className="border rounded-lg overflow-hidden bg-muted/30 h-[70vh]">
                <iframe src={previewUrl} title="anteprima" className="w-full h-full border-0" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={genAnteprima} disabled={previewLoading} data-testid="btn-preview-suzuki">
            <FileText className="w-4 h-4 mr-2" /> {previewLoading ? "Generazione…" : (previewUrl ? "Rigenera anteprima" : "Genera anteprima PDF")}
          </Button>
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
// COMMON
// -------------------------------------------------------------------------
function Field({ label, children, className }) {
  return (
    <div className={className}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
