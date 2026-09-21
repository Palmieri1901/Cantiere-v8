import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import LegendaDialog from "./LegendaDialog";

export default function LegendaTab() {
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
    if (!await confirmDialog("Eliminare questa voce?")) return;
    await api.delete(`/suzuki/legenda/${id}`);
    toast.success("Voce eliminata");
    load();
  };

  const resetDefaults = async () => {
    if (!await confirmDialog("Ripristinare la legenda originale? Tutte le modifiche verranno perse.")) return;
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
