import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Package, Plus, X } from "lucide-react";
import { fmtEuro } from "@/lib/api";

export default function MagazzinoPickerDialog({ open, onOpenChange, articoli, onConfirm }) {
  const [id, setId] = useState("");
  const [qty, setQty] = useState(1);
  const [query, setQuery] = useState("");

  // Reset alla chiusura
  const setOpen = (v) => {
    if (!v) { setId(""); setQty(1); setQuery(""); }
    onOpenChange(v);
  };

  const selected = articoli.find((x) => x.id === id);
  const q = query.trim().toLowerCase();
  const filtered = q === ""
    ? articoli.slice(0, 30)
    : articoli.filter((a) =>
        [a.codice, a.nome, a.descrizione, a.categoria]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      ).slice(0, 50);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md" data-testid="dialog-mag-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Aggiungi articolo dal magazzino
          </DialogTitle>
          <DialogDescription>
            Verrà aggiunto come voce di lavorazione extra (descrizione + prezzo totale). Lo stock non viene decrementato in fase di preventivo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Articolo</Label>
            {selected ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-2.5" data-testid="mag-picker-selected">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {selected.codice && <span className="font-mono text-xs text-muted-foreground mr-1.5">[{selected.codice}]</span>}
                    {selected.nome}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtEuro(selected.prezzo_listino)}/{selected.unita_misura || "pz"}
                    {" · giacenza "}{selected.quantita} {selected.unita_misura || "pz"}
                    {selected.categoria && <span className="ml-2">· {selected.categoria}</span>}
                  </div>
                </div>
                <Button type="button" size="icon" variant="ghost" onClick={() => { setId(""); setQuery(""); }} data-testid="mag-picker-clear">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="mt-1.5 space-y-2">
                <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca per codice, nome, descrizione…" data-testid="mag-picker-search" />
                <div className="max-h-56 overflow-y-auto rounded-md border border-border divide-y divide-border/60" data-testid="mag-picker-list">
                  {articoli.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nessun articolo in magazzino</div>
                  )}
                  {articoli.length > 0 && filtered.length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">Nessun risultato per "{query}"</div>
                  )}
                  {filtered.map((a) => (
                    <button type="button" key={a.id} onClick={() => setId(a.id)} className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-start gap-2 group" data-testid={`mag-picker-opt-${a.id}`}>
                      <Package className="w-3.5 h-3.5 mt-0.5 text-muted-foreground group-hover:text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">
                          {a.codice && <span className="font-mono text-xs text-muted-foreground mr-1.5">[{a.codice}]</span>}
                          <span className="font-medium">{a.nome}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground/80">
                          {fmtEuro(a.prezzo_listino)}/{a.unita_misura || "pz"} · giac. {a.quantita}
                          {a.categoria && <> · {a.categoria}</>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {articoli.length > 30 && !q && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    Digita per cercare tra {articoli.length} articoli…
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quantità {selected && <span className="text-[10px] text-muted-foreground normal-case font-normal">(giacenza: {selected.quantita} {selected.unita_misura || "pz"})</span>}
            </Label>
            <Input type="number" step="0.01" min="0.01" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1.5 font-mono-num" autoFocus={!!id} data-testid="mag-picker-qty" />
          </div>

          {selected && (() => {
            const q = Number(qty) || 0;
            const totale = q * (Number(selected.prezzo_listino) || 0);
            return (
              <div className="rounded-md bg-muted/40 border border-border p-3 text-sm space-y-0.5">
                <div className="text-xs text-muted-foreground">Anteprima riga preventivo</div>
                <div className="font-medium">
                  {selected.codice ? `[${selected.codice}] ` : ""}{selected.nome} × {q || 0} {selected.unita_misura || "pz"}
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground font-mono-num">{q || 0} × {fmtEuro(selected.prezzo_listino)}</span>
                  <span className="font-mono-num font-semibold text-primary" data-testid="mag-picker-totale">{fmtEuro(totale)}</span>
                </div>
              </div>
            );
          })()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
          <Button
            disabled={!id || !(Number(qty) > 0)}
            onClick={() => { onConfirm(id, qty); setOpen(false); }}
            className="bg-primary hover:bg-primary/90"
            data-testid="mag-picker-confirm"
          >
            <Plus className="w-4 h-4 mr-1" /> Aggiungi al preventivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
