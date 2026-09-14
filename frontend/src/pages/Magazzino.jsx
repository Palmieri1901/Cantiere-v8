import { useEffect, useMemo, useState } from "react";
import { api, API, fmtEuro } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Package, Plus, Search, Trash2, Pencil, FileDown, FileSpreadsheet,
  Sparkles, Camera, ScanLine, AlertTriangle, Building2, ArrowUpCircle,
  ArrowDownCircle, RefreshCw, Filter, Image as ImageIcon, X, ShoppingCart,
  Percent, Save,
} from "lucide-react";

const EMPTY_ART = {
  codice: "", nome: "", descrizione: "", categoria: "",
  fornitore_id: null, prezzo_acquisto: 0, prezzo_listino: 0,
  quantita: 0, scorta_minima: 0, unita_misura: "pz",
  immagine_base64: "", note: "",
};

export default function Magazzino() {
  const [tab, setTab] = useState("articoli");
  return (
    <div className="p-6 md:p-10 max-w-7xl" data-testid="magazzino-page">
      <div className="mb-6">
        <div className="flex items-center gap-2 label-mini mb-2">
          <Package className="w-3.5 h-3.5" /> Magazzino
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Accessori & inventario</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Gestisci gli accessori nautici, i fornitori e i movimenti di magazzino.
          Inserisci articoli manualmente, tramite foto (AI) o importando un DDT.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-4 max-w-2xl">
          <TabsTrigger value="articoli" data-testid="tab-articoli">
            <Package className="w-3.5 h-3.5 mr-1.5" /> Articoli
          </TabsTrigger>
          <TabsTrigger value="fornitori" data-testid="tab-fornitori">
            <Building2 className="w-3.5 h-3.5 mr-1.5" /> Fornitori
          </TabsTrigger>
          <TabsTrigger value="spese" data-testid="tab-spese">
            <Percent className="w-3.5 h-3.5 mr-1.5" /> Spese
          </TabsTrigger>
          <TabsTrigger value="movimenti" data-testid="tab-movimenti">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Movimenti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articoli" className="mt-6">
          <ArticoliTab />
        </TabsContent>
        <TabsContent value="fornitori" className="mt-6">
          <FornitoriTab />
        </TabsContent>
        <TabsContent value="spese" className="mt-6">
          <SpeseTab />
        </TabsContent>
        <TabsContent value="movimenti" className="mt-6">
          <MovimentiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// TAB ARTICOLI
// ============================================================================

function ArticoliTab() {
  const [articoli, setArticoli] = useState([]);
  const [fornitori, setFornitori] = useState([]);
  const [categorie, setCategorie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [fFornitore, setFFornitore] = useState("all");
  const [fCategoria, setFCategoria] = useState("all");
  const [soloSottoScorta, setSoloSottoScorta] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [ddtOpen, setDdtOpen] = useState(false);
  const [exportForn, setExportForn] = useState("all");
  const [exportCat, setExportCat] = useState("all");
  const [exportOpen, setExportOpen] = useState(false);
  const [ricarichiOpen, setRicarichiOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [aRes, fRes, cRes] = await Promise.all([
        api.get("/magazzino/articoli"),
        api.get("/magazzino/fornitori"),
        api.get("/magazzino/articoli/categorie"),
      ]);
      setArticoli(aRes.data);
      setFornitori(fRes.data);
      setCategorie(cRes.data);
    } catch {
      toast.error("Errore caricamento magazzino");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return articoli.filter((a) => {
      if (fFornitore !== "all" && a.fornitore_id !== fFornitore) return false;
      if (fCategoria !== "all" && a.categoria !== fCategoria) return false;
      if (soloSottoScorta && a.quantita > a.scorta_minima) return false;
      if (q) {
        const s = q.toLowerCase();
        if (![a.codice, a.nome, a.descrizione, a.categoria].filter(Boolean).some((v) => v.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  }, [articoli, q, fFornitore, fCategoria, soloSottoScorta]);

  const fornMap = useMemo(() => Object.fromEntries(fornitori.map((f) => [f.id, f.nome])), [fornitori]);
  const nSottoScorta = articoli.filter((a) => a.quantita <= a.scorta_minima).length;
  const valoreTot = articoli.reduce((s, a) => s + (Number(a.quantita) * Number(a.prezzo_acquisto || 0)), 0);
  const ricariciValidi = articoli
    .map((a) => {
      const pa = Number(a.prezzo_acquisto || 0);
      const pv = Number(a.prezzo_listino || 0);
      return pa > 0 && pv > 0 ? ((pv - pa) / pa) * 100 : null;
    })
    .filter((v) => v !== null);
  const ricaricoMedio = ricariciValidi.length
    ? ricariciValidi.reduce((s, v) => s + v, 0) / ricariciValidi.length
    : 0;
  const fornitoriAttivi = new Set(articoli.map((a) => a.fornitore_id).filter(Boolean)).size;

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/magazzino/articoli/${confirmDelete.id}`);
      toast.success("Articolo eliminato");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Errore eliminazione");
    }
  };

  const buildListinoUrl = () => {
    const p = new URLSearchParams();
    if (exportForn !== "all") p.set("fornitore_id", exportForn);
    if (exportCat !== "all") p.set("categoria", exportCat);
    const qs = p.toString();
    return `${API}/magazzino/listino.pdf${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      {/* KPI + Azioni */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="label-mini">Articoli in listino</div>
          <div className="font-mono-num text-2xl font-semibold mt-1" data-testid="kpi-articoli-tot">{articoli.length}</div>
        </Card>
        <Card className="p-4">
          <div className="label-mini">Categorie</div>
          <div className="font-mono-num text-2xl font-semibold mt-1">{categorie.length}</div>
        </Card>
        <Card className="p-4">
          <div className="label-mini">Fornitori attivi</div>
          <div className="font-mono-num text-2xl font-semibold mt-1" data-testid="kpi-fornitori">{fornitoriAttivi}</div>
        </Card>
        <Card className="p-4">
          <div className="label-mini">Ricarico medio</div>
          <div className="font-mono-num text-2xl font-semibold mt-1" data-testid="kpi-ricarico">
            {ricariciValidi.length > 0 ? `${ricaricoMedio.toFixed(0)}%` : "—"}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca per codice, nome, descrizione…"
              className="pl-9"
              data-testid="input-search-articoli"
            />
          </div>
          <Select value={fFornitore} onValueChange={setFFornitore}>
            <SelectTrigger className="w-[180px]" data-testid="filter-fornitore">
              <SelectValue placeholder="Fornitore" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i fornitori</SelectItem>
              {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCategoria} onValueChange={setFCategoria}>
            <SelectTrigger className="w-[160px]" data-testid="filter-categoria">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              {categorie.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 border-t border-border/60 pt-4">
          <Button onClick={() => { setEditing({ ...EMPTY_ART }); setFormOpen(true); }} className="bg-primary hover:bg-primary/90" data-testid="btn-nuovo-articolo">
            <Plus className="w-4 h-4 mr-1.5" /> Nuovo articolo
          </Button>
          <Button variant="outline" onClick={() => setScanOpen(true)} data-testid="btn-scan-articolo">
            <Camera className="w-4 h-4 mr-1.5" /> Scan articolo (AI)
          </Button>
          <Button variant="outline" onClick={() => setDdtOpen(true)} data-testid="btn-scan-ddt">
            <ScanLine className="w-4 h-4 mr-1.5" /> Scan DDT (AI)
          </Button>
          <Button variant="outline" onClick={() => setRicarichiOpen(true)} data-testid="btn-ricarichi-categoria">
            <Percent className="w-4 h-4 mr-1.5" /> Ricarichi categoria
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setExportOpen(true)} data-testid="btn-listino-pdf">
              <FileDown className="w-4 h-4 mr-1.5" /> Listino PDF
            </Button>
            <Button asChild variant="outline" data-testid="btn-ordine-pdf">
              <a href={`${API}/magazzino/ordine-fornitore.pdf`} download>
                <ShoppingCart className="w-4 h-4 mr-1.5" /> Ordine PDF
              </a>
            </Button>
            <Button asChild variant="outline" data-testid="btn-inventario-xlsx">
              <a href={`${API}/magazzino/inventario.xlsx`} download>
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Inventario Excel
              </a>
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Codice</TableHead>
                <TableHead>Articolo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead className="text-right">Prezzo acquisto</TableHead>
                <TableHead className="text-right">Prezzo vendita</TableHead>
                <TableHead className="text-right" title="Prezzo di vendita + IVA 22%">Vendita IVA inc.</TableHead>
                <TableHead className="text-right">Ricarico</TableHead>
                <TableHead className="text-right w-[100px]">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Caricamento…</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8" data-testid="empty-articoli">Nessun articolo</TableCell></TableRow>
              )}
              {filtered.map((a) => {
                const pa = Number(a.prezzo_acquisto || 0);
                const pv = Number(a.prezzo_listino || 0);
                const rk = pa > 0 && pv > 0 ? ((pv - pa) / pa) * 100 : null;
                return (
                  <TableRow key={a.id} data-testid={`row-articolo-${a.id}`}>
                    <TableCell className="font-mono text-xs">{a.codice || "—"}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {a.immagine_base64 && <img src={a.immagine_base64} alt="" className="w-8 h-8 rounded object-cover" />}
                        <div>
                          <div>{a.nome}</div>
                          {a.descrizione && <div className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">{a.descrizione}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{a.categoria && <Badge variant="secondary">{a.categoria}</Badge>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fornMap[a.fornitore_id] || "—"}</TableCell>
                    <TableCell className="text-right font-mono-num text-muted-foreground">{fmtEuro(pa)}</TableCell>
                    <TableCell className="text-right font-mono-num font-semibold">{fmtEuro(pv)}</TableCell>
                    <TableCell className="text-right font-mono-num text-primary" data-testid={`cell-pv-iva-${a.id}`}>{fmtEuro(pv * 1.22)}</TableCell>
                    <TableCell className="text-right font-mono-num text-xs">
                      {rk !== null ? (
                        <span className={rk < 0 ? "text-destructive" : rk >= 20 ? "text-primary" : "text-muted-foreground"}>
                          {rk >= 0 ? "+" : ""}{rk.toFixed(0)}%
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setFormOpen(true); }} data-testid={`btn-edit-${a.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(a)} data-testid={`btn-delete-${a.id}`}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ArticoloForm
        open={formOpen}
        onOpenChange={setFormOpen}
        value={editing}
        fornitori={fornitori}
        onSaved={() => { setFormOpen(false); load(); }}
      />

      <ScanArticoloDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        fornitori={fornitori}
        onDone={() => { setScanOpen(false); load(); }}
      />

      <ScanDDTDialog
        open={ddtOpen}
        onOpenChange={setDdtOpen}
        fornitori={fornitori}
        onDone={() => { setDdtOpen(false); load(); }}
      />

      <RicarichiCategoriaDialog
        open={ricarichiOpen}
        onOpenChange={setRicarichiOpen}
        categorie={categorie}
      />

      {/* Export listino filtrato */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-listino">
          <DialogHeader>
            <DialogTitle>Listino PDF</DialogTitle>
            <DialogDescription>Filtra il listino da esportare oppure lascia "Tutti" per l'intero magazzino.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fornitore</Label>
              <Select value={exportForn} onValueChange={setExportForn}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti</SelectItem>
                  {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Categoria</Label>
              <Select value={exportCat} onValueChange={setExportCat}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  {categorie.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Annulla</Button>
            <Button asChild className="bg-primary hover:bg-primary/90" onClick={() => setExportOpen(false)} data-testid="btn-download-listino">
              <a href={buildListinoUrl()} download><FileDown className="w-4 h-4 mr-1.5" /> Scarica PDF</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Elimina articolo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi davvero eliminare <b>{confirmDelete?.nome}</b>? Verranno rimossi anche i movimenti collegati. L'operazione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-delete-cancel">Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="btn-delete-confirm">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================================
// FORM ARTICOLO (create + edit)
// ============================================================================

function ArticoloForm({ open, onOpenChange, value, fornitori, onSaved }) {
  const [form, setForm] = useState(EMPTY_ART);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(value ? { ...EMPTY_ART, ...value, fornitore_id: value.fornitore_id || null } : { ...EMPTY_ART });
  }, [open, value]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Immagine max 2MB"); return; }
    const r = new FileReader();
    r.onload = () => set("immagine_base64", r.result);
    r.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Il nome è obbligatorio"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        fornitore_id: form.fornitore_id || null,
        prezzo_acquisto: Number(form.prezzo_acquisto || 0),
        prezzo_listino: Number(form.prezzo_listino || 0),
        quantita: Number(form.quantita || 0),
        scorta_minima: Number(form.scorta_minima || 0),
      };
      if (form.id) {
        await api.put(`/magazzino/articoli/${form.id}`, payload);
        toast.success("Articolo aggiornato");
      } else {
        await api.post("/magazzino/articoli", payload);
        toast.success("Articolo creato");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-articolo">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifica articolo" : "Nuovo articolo"}</DialogTitle>
          <DialogDescription>Compila i dettagli dell'accessorio.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <FormField label="Codice">
            <Input value={form.codice} onChange={(e) => set("codice", e.target.value)} data-testid="input-codice" />
          </FormField>
          <FormField label="Fornitore">
            <Select value={form.fornitore_id || "none"} onValueChange={(v) => set("fornitore_id", v === "none" ? null : v)}>
              <SelectTrigger data-testid="input-fornitore"><SelectValue placeholder="Nessuno" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nessuno —</SelectItem>
                {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Nome articolo *" full>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} data-testid="input-nome" />
          </FormField>
          <FormField label="Descrizione" full>
            <Textarea rows={2} value={form.descrizione} onChange={(e) => set("descrizione", e.target.value)} data-testid="input-descrizione" />
          </FormField>
          <FormField label="Categoria">
            <Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="es. Ferramenta" data-testid="input-categoria" />
          </FormField>
          <FormField label="Unità di misura">
            <Input value={form.unita_misura} onChange={(e) => set("unita_misura", e.target.value)} placeholder="pz, m, kg…" data-testid="input-um" />
          </FormField>
          <FormField label="Prezzo acquisto €">
            <Input type="number" step="0.01" value={form.prezzo_acquisto} onChange={(e) => set("prezzo_acquisto", e.target.value)} data-testid="input-prezzo-acquisto" />
          </FormField>
          <FormField label="Prezzo vendita €">
            <Input type="number" step="0.01" value={form.prezzo_listino} onChange={(e) => set("prezzo_listino", e.target.value)} data-testid="input-prezzo-listino" />
          </FormField>
          <FormField label="Prezzo vendita IVA inc. (22%) €" full>
            <Input
              type="text"
              readOnly
              tabIndex={-1}
              value={(Number(form.prezzo_listino || 0) * 1.22).toFixed(2)}
              className="bg-muted/40 font-mono-num text-primary font-semibold cursor-not-allowed"
              data-testid="input-prezzo-listino-iva"
            />
          </FormField>
          <FormField label="Ricarico % (modificabile)" full>
            {(() => {
              const pa = Number(form.prezzo_acquisto || 0);
              const pv = Number(form.prezzo_listino || 0);
              const calcolato = pa > 0 && pv > 0 ? ((pv - pa) / pa) * 100 : null;
              const displayed = calcolato !== null ? calcolato.toFixed(1) : "";
              const onRicaricoChange = (val) => {
                const num = parseFloat(val);
                if (Number.isNaN(num)) return;
                if (pa > 0) {
                  // Aggiorna prezzo vendita in base al ricarico
                  const nuovoPv = +(pa * (1 + num / 100)).toFixed(2);
                  set("prezzo_listino", nuovoPv);
                } else {
                  // Nessun prezzo di acquisto: memorizzo il ricarico "desiderato"
                  set("_ricarico_atteso", num);
                  toast.info("Imposta prima il prezzo di acquisto per calcolare la vendita");
                }
              };
              return (
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder={pa > 0 ? "es. 30" : "Inserisci prezzo acquisto per calcolare"}
                    value={displayed || form._ricarico_atteso || ""}
                    onChange={(e) => onRicaricoChange(e.target.value)}
                    className="pr-8 font-mono-num"
                    data-testid="input-ricarico"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              );
            })()}
          </FormField>
          {(() => {
            const pa = Number(form.prezzo_acquisto || 0);
            const pv = Number(form.prezzo_listino || 0);
            if (pa <= 0 || pv <= 0) return null;
            const rk = ((pv - pa) / pa) * 100;
            const marg = pv - pa;
            return (
              <div className="md:col-span-2 flex items-center justify-between rounded-md bg-primary/5 border border-primary/20 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Ricarico calcolato</span>
                <span className="font-mono-num font-semibold text-primary">
                  {rk >= 0 ? "+" : ""}{rk.toFixed(1)}% · margine {fmtEuro(marg)}
                </span>
              </div>
            );
          })()}
          <FormField label="Foto articolo" full>
            <div className="flex items-center gap-3">
              {form.immagine_base64 ? (
                <div className="relative">
                  <img src={form.immagine_base64} alt="" className="w-20 h-20 rounded object-cover border" />
                  <button type="button" onClick={() => set("immagine_base64", "")} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5" data-testid="btn-remove-img">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded border border-dashed border-border grid place-items-center text-muted-foreground">
                  <ImageIcon className="w-6 h-6 opacity-40" />
                </div>
              )}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" hidden onChange={onImage} data-testid="input-image" />
                <span className="inline-flex items-center gap-1.5 px-3 py-2 border border-input rounded-md text-sm hover:bg-muted">
                  <Camera className="w-3.5 h-3.5" /> Carica foto
                </span>
              </label>
            </div>
          </FormField>
          <FormField label="Note" full>
            <Textarea rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} data-testid="input-note" />
          </FormField>

          {/* Sezione opzionale: Inventario (giacenza) */}
          <div className="md:col-span-2 border-t border-border/60 pt-3 mt-1">
            <button
              type="button"
              onClick={() => set("_showInv", !form._showInv)}
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
              data-testid="btn-toggle-inv"
            >
              <Package className="w-3.5 h-3.5" />
              Inventario (opzionale) {form._showInv ? "▾" : "▸"}
              {(Number(form.quantita) > 0 || Number(form.scorta_minima) > 0) && (
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {Number(form.quantita) || 0} {form.unita_misura || "pz"}
                </Badge>
              )}
            </button>
            {form._showInv && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <FormField label="Quantità in giacenza">
                  <Input type="number" step="0.01" value={form.quantita} onChange={(e) => set("quantita", e.target.value)} data-testid="input-quantita" />
                </FormField>
                <FormField label="Scorta minima (alert)">
                  <Input type="number" step="0.01" value={form.scorta_minima} onChange={(e) => set("scorta_minima", e.target.value)} data-testid="input-scorta" />
                </FormField>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="btn-save-articolo">
            {saving ? "Salvataggio…" : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, children, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ============================================================================
// SCAN ARTICOLO (AI)
// ============================================================================

function ScanArticoloDialog({ open, onOpenChange, fornitori, onDone }) {
  const [image, setImage] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_ART);

  useEffect(() => {
    if (open) { setImage(""); setResult(null); setForm(EMPTY_ART); }
  }, [open]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Foto max 4MB"); return; }
    const r = new FileReader();
    r.onload = () => setImage(r.result);
    r.readAsDataURL(file);
  };

  const scan = async () => {
    if (!image) return;
    setScanning(true);
    try {
      const { data } = await api.post("/magazzino/scan-articolo", { image_base64: image });
      setResult(data);
      setForm({ ...EMPTY_ART, ...data, immagine_base64: image, quantita: 1 });
      toast.success("Dati estratti dalla foto");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Impossibile analizzare la foto");
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Nome obbligatorio"); return; }
    setSaving(true);
    try {
      await api.post("/magazzino/articoli", {
        ...form,
        prezzo_acquisto: Number(form.prezzo_acquisto || 0),
        prezzo_listino: Number(form.prezzo_listino || 0),
        quantita: Number(form.quantita || 0),
        scorta_minima: Number(form.scorta_minima || 0),
      });
      toast.success("Articolo salvato");
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="dialog-scan-articolo">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Scan articolo con AI
          </DialogTitle>
          <DialogDescription>
            Carica una foto dell'articolo o della sua etichetta: l'AI estrae codice, nome, descrizione e prezzo. Poi rivedi e salva.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Foto articolo</Label>
            <div className="mt-2">
              {image ? (
                <div className="relative">
                  <img src={image} alt="" className="w-full rounded-md border max-h-64 object-contain bg-muted/20" />
                  <button type="button" onClick={() => { setImage(""); setResult(null); }} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1" data-testid="btn-scan-remove-img">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="block cursor-pointer border-2 border-dashed border-border rounded-md p-8 text-center hover:bg-muted/30 transition">
                  <Camera className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <div className="text-sm font-semibold">Carica foto</div>
                  <div className="text-xs text-muted-foreground mt-1">JPG/PNG · max 4MB</div>
                  <input type="file" accept="image/*" hidden onChange={onFile} data-testid="input-scan-file" />
                </label>
              )}
            </div>
            <Button
              onClick={scan}
              disabled={!image || scanning}
              className="w-full mt-3 bg-primary hover:bg-primary/90"
              data-testid="btn-scan-run"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {scanning ? "Analisi in corso…" : "Analizza con AI"}
            </Button>
          </div>

          <div className={result ? "" : "opacity-50 pointer-events-none"}>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dati estratti (modificabili)</Label>
            <div className="space-y-2 mt-2">
              <Input value={form.codice} onChange={(e) => set("codice", e.target.value)} placeholder="Codice" data-testid="scan-input-codice" />
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome *" data-testid="scan-input-nome" />
              <Textarea rows={2} value={form.descrizione} onChange={(e) => set("descrizione", e.target.value)} placeholder="Descrizione" data-testid="scan-input-desc" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Categoria" />
                <Select value={form.fornitore_id || "none"} onValueChange={(v) => set("fornitore_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Fornitore" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuno —</SelectItem>
                    {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input type="number" step="0.01" value={form.prezzo_listino} onChange={(e) => set("prezzo_listino", e.target.value)} placeholder="Prezzo €" />
                <Input type="number" step="0.01" value={form.quantita} onChange={(e) => set("quantita", e.target.value)} placeholder="Q.tà" />
                <Input type="number" step="0.01" value={form.scorta_minima} onChange={(e) => set("scorta_minima", e.target.value)} placeholder="Scorta" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button
            onClick={save}
            disabled={!result || saving || !form.nome.trim()}
            className="bg-primary hover:bg-primary/90"
            data-testid="btn-scan-save"
          >
            {saving ? "Salvataggio…" : "Salva articolo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SCAN DDT (AI - bulk import)
// ============================================================================

function ScanDDTDialog({ open, onOpenChange, fornitori, onDone }) {
  const [image, setImage] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileB64, setFileB64] = useState("");
  const [fileMime, setFileMime] = useState("");
  const [isPdf, setIsPdf] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState([]);
  const [spese, setSpese] = useState([]);
  const [fornitoreId, setFornitoreId] = useState("none");
  const [saving, setSaving] = useState(false);
  const [aggiornaPrezzi, setAggiornaPrezzi] = useState(true);
  const [mantieniRicarico, setMantieniRicarico] = useState(true);

  useEffect(() => {
    if (open) {
      setImage(""); setFileName(""); setFileB64(""); setFileMime(""); setIsPdf(false);
      setResult(null); setRows([]); setSpese([]); setFornitoreId("none");
      setAggiornaPrezzi(true); setMantieniRicarico(true);
    }
  }, [open]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("File max 8MB"); return; }
    const isPdfFile = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const r = new FileReader();
    r.onload = () => {
      const b64 = String(r.result);
      setFileB64(b64);
      setFileMime(file.type || (isPdfFile ? "application/pdf" : "image/jpeg"));
      setFileName(file.name);
      setIsPdf(isPdfFile);
      if (!isPdfFile) setImage(b64);
      else setImage(""); // niente preview PDF, mostriamo card
    };
    r.readAsDataURL(file);
  };

  const scan = async () => {
    if (!fileB64) return;
    setScanning(true);
    try {
      const payload = isPdf
        ? { file_base64: fileB64, mime_type: fileMime }
        : { image_base64: fileB64 };
      const { data } = await api.post("/magazzino/scan-ddt", payload);
      setResult(data);
      setRows((data.articoli || []).map((a, i) => ({
        ...a,
        // Backfill mancanti in fase iniziale
        prezzo_listino_ivato: a.prezzo_listino_ivato ?? 0,
        sconto_percent: a.sconto_percent ?? 0,
        importo_netto: a.importo_netto ?? a.prezzo_unitario ?? 0,
        _sel: true,
        _i: i,
      })));
      setSpese((data.spese_accessorie || []).map((s, i) => ({
        ...s, _sel: true, _i: i,
      })));
      const tot = (data.articoli?.length || 0) + (data.spese_accessorie?.length || 0);
      toast.success(`Trovati ${data.articoli?.length || 0} articoli e ${data.spese_accessorie?.length || 0} spese`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Impossibile analizzare il DDT");
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (i, k, v) => setRows((rr) => rr.map((r) => r._i === i ? { ...r, [k]: v } : r));

  const IVA = 1.22; // IVA 22%
  const updateRowDDT = (i, k, v) => setRows((rr) => rr.map((r) => {
    if (r._i !== i) return r;
    const nr = { ...r, [k]: v };
    const listino = Number(nr.prezzo_listino_ivato) || 0;
    const sconto = Number(nr.sconto_percent) || 0;
    const netto = Number(nr.importo_netto) || 0;
    if (k === "prezzo_listino_ivato" || k === "sconto_percent") {
      // Ricalcolo netto = listino/1.22 * (1 - sconto/100)
      const listinoNoIva = listino / IVA;
      nr.importo_netto = +(listinoNoIva * (1 - sconto / 100)).toFixed(4);
      nr.prezzo_unitario = nr.importo_netto;
    } else if (k === "importo_netto") {
      // Ricalcolo sconto dato listino e netto: sconto = (1 - netto / listinoNoIva) * 100
      const listinoNoIva = listino / IVA;
      if (listinoNoIva > 0) {
        const calc = (1 - netto / listinoNoIva) * 100;
        if (Number.isFinite(calc) && calc >= -0.5 && calc <= 99.5) {
          nr.sconto_percent = +calc.toFixed(2);
        }
      }
      nr.prezzo_unitario = netto;
    }
    return nr;
  }));

  const importa = async () => {
    const sel = rows.filter((r) => r._sel && (r.nome || r.codice));
    const speseSel = spese.filter((s) => s._sel && Number(s.importo) > 0);
    if (sel.length === 0 && speseSel.length === 0) { toast.error("Nessuna riga selezionata"); return; }
    setSaving(true);
    try {
      const r = await api.post("/magazzino/importa-articoli", {
        fornitore_id: fornitoreId === "none" ? null : fornitoreId,
        articoli: sel.map((a) => ({
          ...a,
          prezzo_unitario: Number(a.importo_netto ?? a.prezzo_unitario ?? 0),
        })),
        spese_accessorie: speseSel.map((s) => ({
          tipo: s.tipo, descrizione: s.descrizione, importo: Number(s.importo),
        })),
        documento_ref: result?.numero_ddt || "",
        data_documento: result?.data || null,
        aggiorna_prezzi: aggiornaPrezzi,
        mantieni_ricarico: mantieniRicarico,
      });
      const pa = r.data.prezzi_aggiornati || 0;
      const sp = r.data.spese_salvate || 0;
      toast.success(
        `Import: ${r.data.created} nuovi, ${r.data.updated} ricaricati${pa > 0 ? `, ${pa} prezzi aggiornati` : ""}${sp > 0 ? `, ${sp} spese` : ""}`
      );
      onDone();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore importazione");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" data-testid="dialog-scan-ddt">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-primary" /> Scan DDT con AI
          </DialogTitle>
          <DialogDescription>
            Carica una foto <b>oppure un file PDF</b> del DDT del fornitore: l'AI estrae tutte le righe articolo. Rivedi, deseleziona le righe da scartare e importa.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">DDT (foto o PDF)</Label>
              <div className="mt-2">
                {image ? (
                  <div className="relative">
                    <img src={image} alt="" className="w-full rounded-md border max-h-48 object-contain bg-muted/20" />
                    <button type="button" onClick={() => { setImage(""); setFileB64(""); setFileName(""); setResult(null); setRows([]); }} className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : fileB64 && isPdf ? (
                  <div className="relative border rounded-md p-4 bg-muted/20 flex items-center gap-3">
                    <div className="w-12 h-14 bg-destructive/10 text-destructive rounded flex items-center justify-center border border-destructive/30 shrink-0">
                      <FileDown className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{fileName}</div>
                      <div className="text-xs text-muted-foreground">PDF · verrà convertita la prima pagina prima dell'analisi</div>
                    </div>
                    <button type="button" onClick={() => { setFileB64(""); setFileName(""); setIsPdf(false); setResult(null); setRows([]); }} className="bg-destructive text-white rounded-full p-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="block cursor-pointer border-2 border-dashed border-border rounded-md p-6 text-center hover:bg-muted/30">
                    <ScanLine className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <div className="text-sm font-semibold">Carica foto o PDF del DDT</div>
                    <div className="text-xs text-muted-foreground mt-1">JPG / PNG / PDF · max 8MB · l'AI gestisce anche foto storte</div>
                    <input type="file" accept="image/*,application/pdf" hidden onChange={onFile} data-testid="input-ddt-file" />
                  </label>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fornitore da associare</Label>
              <Select value={fornitoreId} onValueChange={setFornitoreId}>
                <SelectTrigger className="mt-2" data-testid="ddt-select-fornitore"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nessuno —</SelectItem>
                  {fornitori.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {result?.fornitore && (
                <p className="text-xs text-muted-foreground mt-2">AI ha letto: <b>{result.fornitore}</b></p>
              )}
              <Button
                onClick={scan}
                disabled={!fileB64 || scanning}
                className="w-full mt-3 bg-primary hover:bg-primary/90"
                data-testid="btn-ddt-scan"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {scanning ? "Analisi…" : "Analizza DDT"}
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2" data-testid="ddt-price-options">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Gestione prezzi articoli esistenti
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={aggiornaPrezzi}
                  onChange={(e) => setAggiornaPrezzi(e.target.checked)}
                  data-testid="ddt-check-aggiorna"
                />
                <span>
                  <b>Aggiorna prezzo di acquisto</b>
                  <span className="block text-xs text-muted-foreground">Se l'articolo è già a listino, sostituisci il prezzo con quello nuovo del DDT.</span>
                </span>
              </label>
              <label className={`flex items-start gap-2 text-sm cursor-pointer ${!aggiornaPrezzi ? "opacity-40" : ""}`}>
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={!aggiornaPrezzi}
                  checked={mantieniRicarico}
                  onChange={(e) => setMantieniRicarico(e.target.checked)}
                  data-testid="ddt-check-mantieni-ricarico"
                />
                <span>
                  <b>Mantieni il ricarico corrente</b>
                  <span className="block text-xs text-muted-foreground">Ricalcola automaticamente il prezzo di vendita conservando la percentuale di ricarico attuale (se non presente usa il default della categoria).</span>
                </span>
              </label>
            </div>
          )}
          {rows.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="min-w-[80px]">Codice</TableHead>
                    <TableHead className="min-w-[180px]">Nome</TableHead>
                    <TableHead className="text-right w-20">Q.tà</TableHead>
                    <TableHead className="text-right w-28" title="Prezzo unitario IVA compresa">Listino IVA €</TableHead>
                    <TableHead className="text-right w-20" title="Sconto in percentuale">Sconto %</TableHead>
                    <TableHead className="text-right w-32" title="Prezzo di acquisto: netto scontato IVA esclusa">Netto acquisto €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r._i} data-testid={`ddt-row-${r._i}`}>
                      <TableCell>
                        <input type="checkbox" checked={r._sel} onChange={(e) => updateRow(r._i, "_sel", e.target.checked)} data-testid={`ddt-check-${r._i}`} />
                      </TableCell>
                      <TableCell><Input value={r.codice} onChange={(e) => updateRow(r._i, "codice", e.target.value)} className="h-8" /></TableCell>
                      <TableCell><Input value={r.nome} onChange={(e) => updateRow(r._i, "nome", e.target.value)} className="h-8" /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={r.quantita} onChange={(e) => updateRow(r._i, "quantita", Number(e.target.value))} className="h-8 text-right" /></TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.01"
                          value={r.prezzo_listino_ivato ?? 0}
                          onChange={(e) => updateRowDDT(r._i, "prezzo_listino_ivato", Number(e.target.value))}
                          className="h-8 text-right font-mono-num"
                          data-testid={`ddt-listino-${r._i}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.1"
                          value={r.sconto_percent ?? 0}
                          onChange={(e) => updateRowDDT(r._i, "sconto_percent", Number(e.target.value))}
                          className="h-8 text-right font-mono-num"
                          data-testid={`ddt-sconto-${r._i}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" step="0.01"
                          value={r.importo_netto ?? r.prezzo_unitario ?? 0}
                          onChange={(e) => updateRowDDT(r._i, "importo_netto", Number(e.target.value))}
                          className="h-8 text-right font-mono-num bg-primary/5 border-primary/30 font-semibold"
                          data-testid={`ddt-netto-${r._i}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-2 text-[11px] text-muted-foreground bg-muted/20 border-t border-border">
                Modifica <b>Listino IVA</b> o <b>Sconto</b> per ricalcolare il <b>Netto</b>. Modifica direttamente il <b>Netto</b> per ricalcolare lo sconto. IVA assunta al 22%.
              </div>
            </div>
          )}

          {spese.length > 0 && (
            <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 overflow-hidden" data-testid="ddt-spese-preview">
              <div className="px-3 py-2 border-b border-primary/20 flex items-center gap-2">
                <Percent className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Spese accessorie rilevate</span>
                <span className="text-[11px] text-muted-foreground ml-auto">Verranno salvate nel report Spese, non nel magazzino</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-32">Tipo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right w-32">Importo €</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spese.map((s) => (
                    <TableRow key={s._i} data-testid={`ddt-spesa-${s._i}`}>
                      <TableCell>
                        <input type="checkbox" checked={s._sel} onChange={(e) => setSpese((sp) => sp.map((x) => x._i === s._i ? { ...x, _sel: e.target.checked } : x))} />
                      </TableCell>
                      <TableCell>
                        <Select value={s.tipo} onValueChange={(v) => setSpese((sp) => sp.map((x) => x._i === s._i ? { ...x, tipo: v } : x))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TIPI_SPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input value={s.descrizione} onChange={(e) => setSpese((sp) => sp.map((x) => x._i === s._i ? { ...x, descrizione: e.target.value } : x))} className="h-8" /></TableCell>
                      <TableCell><Input type="number" step="0.01" value={s.importo} onChange={(e) => setSpese((sp) => sp.map((x) => x._i === s._i ? { ...x, importo: Number(e.target.value) } : x))} className="h-8 text-right font-mono-num" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button
            onClick={importa}
            disabled={saving || rows.length === 0}
            className="bg-primary hover:bg-primary/90"
            data-testid="btn-ddt-import"
          >
            {saving ? "Importazione…" : `Importa ${rows.filter((r) => r._sel).length} articoli`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TAB FORNITORI
// ============================================================================

function FornitoriTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [applyMarkup, setApplyMarkup] = useState(null); // { fornitore, reason }
  const [applying, setApplying] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/magazzino/fornitori");
      setItems(r.data);
    } catch { toast.error("Errore caricamento fornitori"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/magazzino/fornitori/${confirmDelete.id}`);
      toast.success("Fornitore eliminato");
      setConfirmDelete(null);
      load();
    } catch { toast.error("Errore"); }
  };

  const applicaRicarico = async () => {
    if (!applyMarkup?.fornitore?.id) return;
    setApplying(true);
    try {
      const r = await api.post(`/magazzino/fornitori/${applyMarkup.fornitore.id}/applica-ricarico`);
      const d = r.data || {};
      toast.success(`Aggiornati ${d.articoli_aggiornati} articoli (${d.ricarico_percent}%)` + (d.articoli_saltati ? ` — ${d.articoli_saltati} saltati (senza prezzo acquisto)` : ""));
      setApplyMarkup(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore aggiornamento prezzi");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => { setEditing({ nome: "", referente: "", telefono: "", email: "", piva: "", indirizzo: "", note: "" }); setFormOpen(true); }} className="bg-primary hover:bg-primary/90" data-testid="btn-nuovo-fornitore">
          <Plus className="w-4 h-4 mr-1.5" /> Nuovo fornitore
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nome</TableHead>
              <TableHead>Referente</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>P.IVA</TableHead>
              <TableHead className="text-right" title="Ricarico % predefinito applicato agli articoli di questo fornitore">Ricarico %</TableHead>
              <TableHead className="text-right w-[120px]">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento…</TableCell></TableRow>}
            {!loading && items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="empty-fornitori">Nessun fornitore</TableCell></TableRow>}
            {items.map((f) => (
              <TableRow key={f.id} data-testid={`row-fornitore-${f.id}`}>
                <TableCell className="font-medium">{f.nome}</TableCell>
                <TableCell>{f.referente || "—"}</TableCell>
                <TableCell>{f.telefono || "—"}</TableCell>
                <TableCell className="text-sm">{f.email || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{f.piva || "—"}</TableCell>
                <TableCell className="text-right font-mono-num text-sm">
                  {f.ricarico_default_percent != null
                    ? <span className="text-primary font-semibold">+{Number(f.ricarico_default_percent).toFixed(1)}%</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setApplyMarkup({ fornitore: f, reason: "manual" })} disabled={f.ricarico_default_percent == null} title={f.ricarico_default_percent == null ? "Imposta prima un ricarico %" : `Applica +${Number(f.ricarico_default_percent).toFixed(1)}% a tutti gli articoli`} data-testid={`btn-applica-ricarico-${f.id}`}>
                    <Percent className="w-3.5 h-3.5 text-primary" />
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="Ordine PDF sotto scorta" data-testid={`btn-ordine-forn-${f.id}`}>
                    <a href={`${API}/magazzino/ordine-fornitore.pdf?fornitore_id=${f.id}`} download>
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(f); setFormOpen(true); }} data-testid={`btn-edit-forn-${f.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(f)} data-testid={`btn-del-forn-${f.id}`}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FornitoreForm open={formOpen} onOpenChange={setFormOpen} value={editing} onSaved={(saved, ricaricoChanged) => {
        setFormOpen(false);
        load();
        if (ricaricoChanged && saved?.ricarico_default_percent != null) {
          setApplyMarkup({ fornitore: saved, reason: "changed" });
        }
      }} />

      <AlertDialog open={!!applyMarkup} onOpenChange={(o) => !o && !applying && setApplyMarkup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aggiornare i prezzi degli articoli?</AlertDialogTitle>
            <AlertDialogDescription>
              {applyMarkup?.reason === "changed"
                ? <>Hai modificato il ricarico di <b>{applyMarkup?.fornitore?.nome}</b> a <b>+{Number(applyMarkup?.fornitore?.ricarico_default_percent ?? 0).toFixed(1)}%</b>. Vuoi ricalcolare il <b>prezzo di listino</b> di TUTTI gli articoli di questo fornitore usando il nuovo ricarico?</>
                : <>Ricalcolare il <b>prezzo di listino</b> di TUTTI gli articoli di <b>{applyMarkup?.fornitore?.nome}</b> applicando il ricarico corrente <b>+{Number(applyMarkup?.fornitore?.ricarico_default_percent ?? 0).toFixed(1)}%</b> al prezzo di acquisto?</>}
              <br/><br/>
              <span className="text-xs text-muted-foreground">Formula: prezzo_listino = prezzo_acquisto × (1 + ricarico%). Gli articoli senza prezzo di acquisto verranno saltati.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying} data-testid="btn-annulla-applica-ricarico">Non ora</AlertDialogCancel>
            <AlertDialogAction onClick={applicaRicarico} disabled={applying} className="bg-primary hover:bg-primary/90" data-testid="btn-conferma-applica-ricarico">
              {applying ? "Aggiornamento…" : "Sì, aggiorna prezzi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina fornitore</AlertDialogTitle>
            <AlertDialogDescription>Vuoi eliminare <b>{confirmDelete?.nome}</b>? Gli articoli collegati verranno mantenuti senza fornitore.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function FornitoreForm({ open, onOpenChange, value, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [initialRicarico, setInitialRicarico] = useState(null);

  useEffect(() => {
    if (open) {
      const init = { nome: "", referente: "", telefono: "", email: "", piva: "", indirizzo: "", note: "", ...value };
      setForm(init);
      setInitialRicarico(init.ricarico_default_percent ?? null);
    }
  }, [open, value]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.nome?.trim()) { toast.error("Nome obbligatorio"); return; }
    setSaving(true);
    try {
      let saved;
      if (form.id) {
        const r = await api.put(`/magazzino/fornitori/${form.id}`, form);
        saved = r.data;
      } else {
        const r = await api.post("/magazzino/fornitori", form);
        saved = r.data;
      }
      toast.success("Fornitore salvato");
      const newRic = saved?.ricarico_default_percent ?? null;
      const ricaricoChanged = !!form.id && Number(newRic) !== Number(initialRicarico) && newRic != null;
      onSaved(saved, ricaricoChanged);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-fornitore">
        <DialogHeader><DialogTitle>{form.id ? "Modifica fornitore" : "Nuovo fornitore"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nome *" full><Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} data-testid="forn-input-nome" /></FormField>
          <FormField label="Referente"><Input value={form.referente || ""} onChange={(e) => set("referente", e.target.value)} /></FormField>
          <FormField label="Telefono"><Input value={form.telefono || ""} onChange={(e) => set("telefono", e.target.value)} /></FormField>
          <FormField label="Email" full><Input value={form.email || ""} onChange={(e) => set("email", e.target.value)} /></FormField>
          <FormField label="P.IVA"><Input value={form.piva || ""} onChange={(e) => set("piva", e.target.value)} /></FormField>
          <FormField label="Indirizzo"><Input value={form.indirizzo || ""} onChange={(e) => set("indirizzo", e.target.value)} /></FormField>
          <FormField label="Ricarico % predefinito" full>
            <div className="relative">
              <Input
                type="number" step="0.1"
                placeholder="Lascia vuoto per usare quello di categoria"
                value={form.ricarico_default_percent ?? ""}
                onChange={(e) => set("ricarico_default_percent", e.target.value === "" ? null : Number(e.target.value))}
                className="pr-8 font-mono-num"
                data-testid="forn-input-ricarico"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Applicato ai nuovi articoli di questo fornitore importati da DDT. Ha priorità sul ricarico di categoria.
            </div>
          </FormField>
          <FormField label="Note" full><Textarea rows={2} value={form.note || ""} onChange={(e) => set("note", e.target.value)} /></FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="btn-save-fornitore">{saving ? "Salvataggio…" : "Salva"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// TAB MOVIMENTI
// ============================================================================

function MovimentiTab() {
  const [movs, setMovs] = useState([]);
  const [articoli, setArticoli] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [tipo, setTipo] = useState("carico");
  const [articoloId, setArticoloId] = useState("");
  const [quantita, setQuantita] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, a] = await Promise.all([
        api.get("/magazzino/movimenti"),
        api.get("/magazzino/articoli"),
      ]);
      setMovs(m.data);
      setArticoli(a.data);
    } catch { toast.error("Errore caricamento"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const artMap = useMemo(() => Object.fromEntries(articoli.map((a) => [a.id, a])), [articoli]);

  const openForm = (t) => {
    setTipo(t); setArticoloId(""); setQuantita(0); setMotivo(""); setNote("");
    setFormOpen(true);
  };

  const save = async () => {
    if (!articoloId) { toast.error("Seleziona un articolo"); return; }
    if (Number(quantita) <= 0 && tipo !== "rettifica") { toast.error("Quantità deve essere > 0"); return; }
    setSaving(true);
    try {
      await api.post("/magazzino/movimenti", {
        articolo_id: articoloId, tipo, quantita: Number(quantita),
        motivo, note, data: new Date().toISOString().slice(0, 10),
      });
      toast.success("Movimento registrato");
      setFormOpen(false);
      load();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
    finally { setSaving(false); }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button onClick={() => openForm("carico")} className="bg-primary hover:bg-primary/90" data-testid="btn-nuovo-carico">
          <ArrowUpCircle className="w-4 h-4 mr-1.5" /> Nuovo carico
        </Button>
        <Button onClick={() => openForm("scarico")} variant="outline" data-testid="btn-nuovo-scarico">
          <ArrowDownCircle className="w-4 h-4 mr-1.5" /> Nuovo scarico
        </Button>
        <Button onClick={() => openForm("rettifica")} variant="outline" data-testid="btn-rettifica">
          <RefreshCw className="w-4 h-4 mr-1.5" /> Rettifica inventario
        </Button>
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Articolo</TableHead>
              <TableHead className="text-right">Q.tà</TableHead>
              <TableHead className="text-right">Giacenza dopo</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Caricamento…</TableCell></TableRow>}
            {!loading && movs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground" data-testid="empty-movimenti">Nessun movimento</TableCell></TableRow>}
            {movs.map((m) => {
              const art = artMap[m.articolo_id];
              const badgeVariant = m.tipo === "carico" ? "default" : m.tipo === "scarico" ? "destructive" : "secondary";
              return (
                <TableRow key={m.id} data-testid={`row-movimento-${m.id}`}>
                  <TableCell className="font-mono text-xs">{m.data}</TableCell>
                  <TableCell><Badge variant={badgeVariant}>{m.tipo}</Badge></TableCell>
                  <TableCell>{art?.nome || <span className="text-muted-foreground italic">Eliminato</span>}</TableCell>
                  <TableCell className="text-right font-mono-num">{m.tipo === "scarico" ? "-" : "+"}{Math.abs(m.quantita)}</TableCell>
                  <TableCell className="text-right font-mono-num">{m.quantita_dopo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.motivo || "—"}
                    {m.cliente_nome && <span className="block text-[10px] text-primary/80 mt-0.5">Cliente: {m.cliente_nome}</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent data-testid="dialog-movimento">
          <DialogHeader>
            <DialogTitle>
              {tipo === "carico" && "Carico magazzino"}
              {tipo === "scarico" && "Scarico magazzino"}
              {tipo === "rettifica" && "Rettifica inventario"}
            </DialogTitle>
            <DialogDescription>
              {tipo === "rettifica"
                ? "Imposta la quantità reale rilevata dall'inventario fisico."
                : "Aggiungi la quantità movimentata."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Articolo *" full>
              <Select value={articoloId} onValueChange={setArticoloId}>
                <SelectTrigger data-testid="mov-select-articolo"><SelectValue placeholder="Seleziona articolo" /></SelectTrigger>
                <SelectContent>
                  {articoli.map((a) => <SelectItem key={a.id} value={a.id}>{a.codice ? `[${a.codice}] ` : ""}{a.nome} (giac. {a.quantita})</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={tipo === "rettifica" ? "Quantità reale" : "Quantità"} full>
              <Input type="number" step="0.01" value={quantita} onChange={(e) => setQuantita(e.target.value)} data-testid="mov-input-quantita" />
            </FormField>
            <FormField label="Motivo" full>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="es. Consumo per lavoro cliente X" data-testid="mov-input-motivo" />
            </FormField>
            <FormField label="Note" full>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-testid="mov-input-note" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="btn-save-movimento">
              {saving ? "Salvataggio…" : "Registra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


// ============================================================================
// DIALOG: Ricarichi Categoria (default markup per categoria)
// ============================================================================

function RicarichiCategoriaDialog({ open, onOpenChange, categorie }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nuovaCat, setNuovaCat] = useState("");
  const [nuovoPercent, setNuovoPercent] = useState(30);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/magazzino/ricarichi-categoria");
      setItems(r.data);
    } catch {
      toast.error("Errore caricamento ricarichi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const saveOne = async (categoria, ricarico_percent) => {
    try {
      await api.post("/magazzino/ricarichi-categoria", {
        categoria, ricarico_percent: Number(ricarico_percent),
      });
      toast.success(`Ricarico salvato: ${categoria} → +${ricarico_percent}%`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore salvataggio");
    }
  };

  const remove = async (item) => {
    try {
      await api.delete(`/magazzino/ricarichi-categoria/${item.id}`);
      toast.success(`Rimosso ricarico ${item.categoria}`);
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Errore");
    }
  };

  const aggiungi = async () => {
    const cat = nuovaCat.trim();
    if (!cat) { toast.error("Inserisci la categoria"); return; }
    const p = Number(nuovoPercent);
    if (!Number.isFinite(p)) { toast.error("Ricarico non valido"); return; }
    setSaving(true);
    await saveOne(cat, p);
    setNuovaCat(""); setNuovoPercent(30);
    setSaving(false);
  };

  const categorieNonMappate = categorie.filter((c) => !items.some((i) => i.categoria === c));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-ricarichi">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-primary" /> Ricarichi predefiniti per categoria
          </DialogTitle>
          <DialogDescription>
            Imposta un ricarico % standard per ogni categoria. Sarà applicato automaticamente:
            <span className="block mt-1">• ai <b>nuovi articoli</b> importati dal DDT (calcolando il prezzo di vendita)</span>
            <span className="block">• agli articoli aggiornati dal DDT senza ricarico corrente</span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-3">
          {/* Nuovo ricarico */}
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Aggiungi ricarico</div>
            <div className="flex flex-wrap gap-2">
              {categorieNonMappate.length > 0 ? (
                <Select value={nuovaCat} onValueChange={setNuovaCat}>
                  <SelectTrigger className="w-[220px]" data-testid="ricarichi-select-cat"><SelectValue placeholder="Categoria esistente" /></SelectTrigger>
                  <SelectContent>
                    {categorieNonMappate.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (

                <Input
                  value={nuovaCat}
                  onChange={(e) => setNuovaCat(e.target.value)}
                  placeholder="Nome categoria (es. Ferramenta)"
                  className="w-[220px]"
                />
              )}
              <Input
                value={nuovaCat}
                onChange={(e) => setNuovaCat(e.target.value)}
                placeholder="oppure digitala"
                className="w-[220px]"
                data-testid="ricarichi-input-cat"
              />
              <div className="relative w-[110px]">
                <Input
                  type="number" step="0.1"
                  value={nuovoPercent}
                  onChange={(e) => setNuovoPercent(e.target.value)}
                  className="pr-8 font-mono-num"
                  data-testid="ricarichi-input-perc"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <Button onClick={aggiungi} disabled={saving || !nuovaCat.trim()} className="bg-primary hover:bg-primary/90" data-testid="btn-ricarichi-add">
                <Plus className="w-4 h-4 mr-1" /> Aggiungi
              </Button>
            </div>
          </div>

          {/* Lista ricarichi */}
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right w-[160px]">Ricarico %</TableHead>
                  <TableHead className="text-right w-[80px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Caricamento…</TableCell></TableRow>}
                {!loading && items.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground" data-testid="empty-ricarichi">Nessun ricarico impostato</TableCell></TableRow>
                )}
                {items.map((it) => (
                  <RicaricoRow key={it.id} item={it} onSave={saveOne} onDelete={() => setConfirmDelete(it)} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>

        <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Rimuovi ricarico
              </AlertDialogTitle>
              <AlertDialogDescription>
                Vuoi rimuovere il ricarico predefinito per <b>{confirmDelete?.categoria}</b> (+{confirmDelete?.ricarico_percent}%)? I nuovi articoli di questa categoria non useranno più un ricarico automatico.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="ricarichi-del-cancel">Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove(confirmDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="ricarichi-del-confirm">
                Rimuovi
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function RicaricoRow({ item, onSave, onDelete }) {
  const [val, setVal] = useState(item.ricarico_percent);
  const dirty = Number(val) !== Number(item.ricarico_percent);
  return (
    <TableRow data-testid={`row-ricarico-${item.id}`}>
      <TableCell className="font-medium">{item.categoria}</TableCell>
      <TableCell className="text-right">
        <div className="relative w-[110px] inline-block">
          <Input
            type="number" step="0.1"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="pr-8 h-8 text-right font-mono-num"
            data-testid={`input-ricarico-${item.id}`}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        {dirty && (
          <Button size="icon" variant="ghost" onClick={() => onSave(item.categoria, val)} data-testid={`btn-save-ricarico-${item.id}`}>
            <Save className="w-3.5 h-3.5 text-primary" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`btn-del-ricarico-${item.id}`}>
          <Trash2 className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}


// ============================================================================
// TAB SPESE (spese accessorie da DDT/fattura + inserimento manuale)
// ============================================================================

const TIPI_SPESA = [
  { value: "bancarie", label: "Bancarie" },
  { value: "trasporto", label: "Trasporto" },
  { value: "spedizione", label: "Spedizione" },
  { value: "imballo", label: "Imballo" },
  { value: "assicurazione", label: "Assicurazione" },
  { value: "carburante", label: "Carburante" },
  { value: "altro", label: "Altro" },
];

function labelTipo(t) {
  const found = TIPI_SPESA.find((x) => x.value === t);
  return found ? found.label : (t || "Altro");
}

function SpeseTab() {
  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "trasporto", descrizione: "", importo: "", data: new Date().toISOString().slice(0, 10), documento_ref: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [l, r] = await Promise.all([
        api.get("/magazzino/spese"),
        api.get("/magazzino/spese-report"),
      ]);
      setItems(l.data);
      setReport(r.data);
    } catch {
      toast.error("Errore caricamento spese");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = tipoFilter === "all" ? items : items.filter((s) => s.tipo === tipoFilter);

  const save = async () => {
    if (!form.tipo) { toast.error("Tipo obbligatorio"); return; }
    const imp = Number(form.importo);
    if (!Number.isFinite(imp) || imp <= 0) { toast.error("Importo non valido"); return; }
    setSaving(true);
    try {
      await api.post("/magazzino/spese", { ...form, importo: imp });
      toast.success("Spesa registrata");
      setAddOpen(false);
      setForm({ tipo: "trasporto", descrizione: "", importo: "", data: new Date().toISOString().slice(0, 10), documento_ref: "" });
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore");
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/magazzino/spese/${confirmDelete.id}`);
      toast.success("Spesa eliminata");
      setConfirmDelete(null);
      load();
    } catch { toast.error("Errore"); }
  };

  return (
    <>
      {/* KPI per tipo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card className="p-4">
          <div className="label-mini">Totale spese</div>
          <div className="font-mono-num text-2xl font-semibold mt-1" data-testid="kpi-spese-tot">{fmtEuro(report?.totale_generale || 0)}</div>
        </Card>
        {(report?.per_tipo || []).slice(0, 3).map((r) => (
          <Card key={r.tipo} className="p-4">
            <div className="label-mini">{labelTipo(r.tipo)}</div>
            <div className="font-mono-num text-lg font-semibold mt-1">{fmtEuro(r.totale)}</div>
            <div className="text-[10px] text-muted-foreground">{r.count} voci</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[200px]" data-testid="filter-tipo-spesa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {TIPI_SPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button className="ml-auto bg-primary hover:bg-primary/90" onClick={() => setAddOpen(true)} data-testid="btn-nuova-spesa">
            <Plus className="w-4 h-4 mr-1.5" /> Nuova spesa
          </Button>
        </div>

        {/* Riepilogo per tipo (barre) */}
        {report?.per_tipo?.length > 0 && (
          <div className="mb-4 space-y-1.5" data-testid="report-spese">
            {report.per_tipo.map((r) => {
              const pct = report.totale_generale > 0 ? (r.totale / report.totale_generale) * 100 : 0;
              return (
                <div key={r.tipo} className="flex items-center gap-3 text-xs">
                  <div className="w-28 shrink-0 font-medium">{labelTipo(r.tipo)}</div>
                  <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-24 text-right font-mono-num">{fmtEuro(r.totale)}</div>
                  <div className="w-10 text-right text-muted-foreground">{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Doc.</TableHead>
                <TableHead className="text-right">Importo</TableHead>
                <TableHead className="text-right w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento…</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground" data-testid="empty-spese">Nessuna spesa registrata</TableCell></TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id} data-testid={`row-spesa-${s.id}`}>
                  <TableCell className="font-mono text-xs">{s.data}</TableCell>
                  <TableCell><Badge variant="secondary">{labelTipo(s.tipo)}</Badge></TableCell>
                  <TableCell className="text-sm">{s.descrizione || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.fornitore_nome || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.documento_ref || "—"}</TableCell>
                  <TableCell className="text-right font-mono-num font-semibold">{fmtEuro(s.importo)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(s)} data-testid={`btn-del-spesa-${s.id}`}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Nuova spesa */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-testid="dialog-spesa">
          <DialogHeader>
            <DialogTitle>Nuova spesa accessoria</DialogTitle>
            <DialogDescription>Registra manualmente una spesa non merceologica (bancaria, trasporto, ecc.)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <FormField label="Tipo *" full>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger data-testid="spesa-input-tipo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPI_SPESA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Descrizione" full>
              <Input value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} placeholder="es. Trasporto merce" data-testid="spesa-input-desc" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Importo € *">
                <Input type="number" step="0.01" value={form.importo} onChange={(e) => setForm({ ...form, importo: e.target.value })} data-testid="spesa-input-importo" />
              </FormField>
              <FormField label="Data">
                <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} data-testid="spesa-input-data" />
              </FormField>
            </div>
            <FormField label="Riferimento documento" full>
              <Input value={form.documento_ref} onChange={(e) => setForm({ ...form, documento_ref: e.target.value })} placeholder="es. DDT 4521/2026" />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="btn-save-spesa">
              {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Elimina spesa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi eliminare la spesa <b>{labelTipo(confirmDelete?.tipo)}</b> del {confirmDelete?.data} da {fmtEuro(confirmDelete?.importo || 0)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="btn-del-spesa-confirm">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
