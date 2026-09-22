import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const TIPI = ["Antivegetativa", "Manutenzione motore", "Riparazione", "Pulizia", "Elettrico", "Altro"];
const L = ({ children }) => <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</Label>;

export default function ApprovaDialog({ item, onClose, onDone }) {
  const [f, setF] = useState(null);
  const [clienti, setClienti] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tariffa, setTariffa] = useState(0);

  useEffect(() => {
    if (!item) return;
    api.get("/tariffe").then((r) => {
      const rate = Number(r.data.costo_orario_manodopera) || 0;
      setTariffa(rate);
      setF((s) => s && !item.costo ? { ...s, costo: +(Number(item.ore || 0) * rate).toFixed(2) } : s);
    }).catch(() => {});
    setF({ cliente_id: item.cliente_id || "", data: item.data, tipo: TIPI.includes(item.tipo) ? item.tipo : "Altro", descrizione: item.descrizione, ore: item.ore, costo: item.costo || 0, materiali: item.materiali || "" });
    if (!item.cliente_trovato) api.get("/clienti").then((r) => setClienti(r.data)).catch(() => {});
  }, [item]);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setOre = (v) => setF((s) => ({ ...s, ore: v, costo: tariffa > 0 ? +((Number(v) || 0) * tariffa).toFixed(2) : s.costo }));

  const approva = async () => {
    if (!f.cliente_id) return toast.error("Seleziona il cliente");
    setSaving(true);
    try {
      const body = { ...f, ore: Number(f.ore) || 0, costo: Number(f.costo) || 0 };
      await api.post(`/lavori-pending/${item.id}/approva`, body);
      toast.success("Lavoro approvato e aggiunto alla scheda cliente");
      onDone(); onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Errore approvazione");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="approva-dialog">
        <DialogHeader>
          <DialogTitle>Approva lavoro di {item?.dipendente_nome}</DialogTitle>
          <DialogDescription>Controlla i dati e imposta il costo manodopera prima di salvarlo nella scheda cliente.</DialogDescription>
        </DialogHeader>
        {f && item && (
          <div className="space-y-3">
            {!item.cliente_trovato && (
              <div className="space-y-1.5">
                <L>Cliente</L>
                <Select value={f.cliente_id} onValueChange={(v) => set("cliente_id", v)}>
                  <SelectTrigger data-testid="select-approva-cliente"><SelectValue placeholder="Seleziona cliente…" /></SelectTrigger>
                  <SelectContent>{clienti.map((c) => <SelectItem key={c.id} value={c.id}>{c.cognome} {c.nome} · {c.tipo_barca} ({c.anno})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><L>Data</L><Input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} data-testid="input-approva-data" /></div>
              <div className="space-y-1.5"><L>Tipo</L>
                <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
                  <SelectTrigger data-testid="select-approva-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPI.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><L>Descrizione</L><Input value={f.descrizione} onChange={(e) => set("descrizione", e.target.value)} data-testid="input-approva-descrizione" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><L>Ore lavoro</L><Input type="number" step="0.5" min="0" value={f.ore} onChange={(e) => setOre(e.target.value)} className="font-mono-num" data-testid="input-approva-ore" /></div>
              <div className="space-y-1.5"><L>Costo manodopera €</L><Input type="number" step="0.01" min="0" value={f.costo} onChange={(e) => set("costo", e.target.value)} className="font-mono-num" data-testid="input-approva-costo" />
                <div className="text-[11px] text-muted-foreground" data-testid="approva-tariffa-hint">{tariffa > 0 ? `Calcolato: ${f.ore || 0} h × ${tariffa} €/h (modificabile)` : "Imposta il costo orario in Tariffe per il calcolo automatico"}</div>
              </div>
            </div>
            <div className="space-y-1.5"><L>Materiali</L><Textarea rows={2} value={f.materiali} onChange={(e) => set("materiali", e.target.value)} data-testid="input-approva-materiali" /></div>
            {item.articoli_magazzino?.length > 0 && (
              <div className="text-xs text-muted-foreground">Approvando verranno scaricati dal magazzino {item.articoli_magazzino.length} articoli indicati dal dipendente.</div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="btn-approva-annulla">Annulla</Button>
          <Button onClick={approva} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="btn-approva-conferma">Approva e salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
