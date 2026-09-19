import { useEffect, useState } from "react";
import { api, fmtEuro } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { TIPI_SPESA, labelTipo, FormField } from "./common";

export default function SpeseTab() {
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
