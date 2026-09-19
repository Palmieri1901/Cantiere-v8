import { useEffect, useMemo, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, FileText, Sparkles, Search, Download } from "lucide-react";
import { EMPTY_MODEL, fmt } from "./common";
import ModelloDialog from "./ModelloDialog";
import ImportAIDialog from "./ImportAIDialog";
import LogoPdfButton from "./LogoPdfButton";

export default function ModelliTab() {
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
