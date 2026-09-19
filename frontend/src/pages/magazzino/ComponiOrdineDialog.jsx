import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShoppingCart, Search, Plus, X, FileDown } from "lucide-react";

export default function ComponiOrdineDialog({ open, onOpenChange, articoli, fornitori }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [fFornitore, setFFornitore] = useState("all");
  const [note, setNote] = useState("");
  const [downloading, setDownloading] = useState(false);

  const artMap = useMemo(() => Object.fromEntries((articoli || []).map((a) => [a.id, a])), [articoli]);
  const fornMap = useMemo(() => Object.fromEntries((fornitori || []).map((f) => [f.id, f.nome])), [fornitori]);

  useEffect(() => {
    if (!open) return;
    const sotto = (articoli || []).filter((a) => Number(a.quantita || 0) <= Number(a.scorta_minima || 0));
    setItems(sotto.map((a) => ({
      articolo_id: a.id,
      quantita: Math.max(Math.ceil(Number(a.scorta_minima || 0) * 2 - Number(a.quantita || 0)), Math.ceil(Number(a.scorta_minima || 0)) || 1),
      nota: "",
    })));
    setNote("");
    setQ("");
    setFFornitore("all");
  }, [open, articoli]);

  const disponibili = useMemo(() => {
    const selected = new Set(items.map((i) => i.articolo_id));
    return (articoli || [])
      .filter((a) => !selected.has(a.id))
      .filter((a) => fFornitore === "all" || (a.fornitore_id || "") === fFornitore)
      .filter((a) => {
        if (!q) return true;
        const rx = q.toLowerCase();
        return (a.nome || "").toLowerCase().includes(rx)
          || (a.codice || "").toLowerCase().includes(rx)
          || (a.descrizione || "").toLowerCase().includes(rx)
          || (a.categoria || "").toLowerCase().includes(rx);
      })
      .slice(0, 50);
  }, [articoli, items, q, fFornitore]);

  const add = (a) => setItems((prev) => [...prev, { articolo_id: a.id, quantita: 1, nota: "" }]);
  const remove = (aid) => setItems((prev) => prev.filter((i) => i.articolo_id !== aid));
  const setQty = (aid, v) => setItems((prev) => prev.map((i) => i.articolo_id === aid ? { ...i, quantita: v } : i));

  const scarica = async () => {
    if (!items.length) { toast.error("Nessun articolo nell'ordine"); return; }
    setDownloading(true);
    try {
      const payload = { items: items.map((i) => ({ articolo_id: i.articolo_id, quantita: Number(i.quantita) || 0, nota: i.nota || "" })), note };
      const res = await api.post("/magazzino/ordine/componi-pdf", payload, {
        responseType: "blob",
        timeout: 120000,
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ordine_composto_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
      toast.success("PDF ordine generato");
    } catch (e) {
      let msg = "Errore generazione PDF";
      const data = e?.response?.data;
      if (data && typeof data.text === "function") {
        try { const txt = await data.text(); const j = JSON.parse(txt); msg = j.detail || msg; }
        catch { /* keep default */ }
      } else if (typeof data?.detail === "string") {
        msg = data.detail;
      } else if (e?.message) {
        msg = e.message;
      }
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const gruppi = useMemo(() => {
    const map = {};
    items.forEach((i) => {
      const a = artMap[i.articolo_id]; if (!a) return;
      const fid = a.fornitore_id || "_nofornitore";
      if (!map[fid]) map[fid] = { fornitore: fornMap[fid] || "— Fornitore non assegnato —", rows: [] };
      map[fid].rows.push({ item: i, art: a });
    });
    return Object.entries(map);
  }, [items, artMap, fornMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl" data-testid="dialog-componi-ordine">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /> Componi ordine</DialogTitle>
          <DialogDescription>
            Sono già inclusi gli articoli <b>sotto scorta minima</b>. Puoi aggiungere altri articoli, modificare le quantità o rimuovere quelli non necessari, poi scarica il PDF raggruppato per fornitore.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4 max-h-[65vh]">
          <div className="overflow-y-auto pr-1">
            <div className="label-mini mb-2">Articoli nell'ordine ({items.length})</div>
            {gruppi.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border border-dashed rounded-md">
                Nessun articolo. Aggiungine dalla colonna a destra.
              </div>
            ) : gruppi.map(([fid, g]) => (
              <div key={fid} className="mb-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">{g.fornitore}</div>
                <div className="border rounded-md divide-y">
                  {g.rows.map(({ item, art }) => (
                    <div key={item.articolo_id} className="px-2 py-1.5 flex items-center gap-2 hover:bg-muted/30" data-testid={`ordine-row-${art.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{art.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {art.codice || "—"} · Giac. {Number(art.quantita || 0)} {art.unita_misura || "pz"} · Min. {Number(art.scorta_minima || 0)}
                        </div>
                      </div>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        value={item.quantita}
                        onChange={(e) => setQty(item.articolo_id, e.target.value)}
                        className="w-20 h-8 text-right font-mono text-sm"
                        data-testid={`qty-${art.id}`}
                      />
                      <span className="text-xs text-muted-foreground w-8">{art.unita_misura || "pz"}</span>
                      <button
                        onClick={() => remove(item.articolo_id)}
                        className="text-destructive hover:opacity-70 p-1"
                        title="Rimuovi"
                        data-testid={`rm-${art.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="label-mini mb-2">Aggiungi dal magazzino</div>
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Cerca articolo…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9 text-sm" data-testid="search-add-articolo" />
              </div>
              <Select value={fFornitore} onValueChange={setFFornitore}>
                <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="Fornitore" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i fornitori</SelectItem>
                  {(fornitori || []).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-md flex-1 overflow-y-auto divide-y">
              {disponibili.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 text-center">Nessun articolo disponibile.</div>
              ) : disponibili.map((a) => (
                <button
                  key={a.id}
                  onClick={() => add(a)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
                  data-testid={`add-${a.id}`}
                >
                  <Plus className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{a.nome}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {a.codice || "—"} · Giac. {Number(a.quantita || 0)} {a.unita_misura || "pz"} · {fornMap[a.fornitore_id] || "— nessun fornitore —"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Note ordine (opzionali)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" placeholder="Es. urgente, consegnare entro venerdì…" data-testid="ordine-note" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button onClick={scarica} disabled={downloading || items.length === 0} className="bg-primary" data-testid="btn-scarica-ordine-pdf">
            <FileDown className="w-4 h-4 mr-2" /> {downloading ? "Generazione…" : `Scarica PDF (${items.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
