import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";
import { EMPTY_PREV_GOMMONE, CATEGORIE, fmt } from "./common";
import PreventivoGommoneDialog from "./PreventivoGommoneDialog";

const totale = (p) => {
  const netto = (p.prezzo_gommone || 0) * (1 - (p.sconto_perc || 0) / 100);
  const acc = (p.accessori || []).reduce((s, a) => s + (a.prezzo || 0) * (a.quantita || 1), 0);
  const mot = (p.motore_prezzo || 0) * (1 - (p.motore_sconto_perc || 0) / 100);
  return netto + acc + mot + (p.montaggio || 0);
};

export default function PreventiviGommoniTab() {
  const [items, setItems] = useState([]);
  const [gommoni, setGommoni] = useState([]);
  const [accessori, setAccessori] = useState([]);
  const [motori, setMotori] = useState([]);
  const [sconti, setSconti] = useState({});
  const [editing, setEditing] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewName, setPreviewName] = useState("preventivo.pdf");

  const load = async () => {
    try {
      const [rp, rg, ra, rm, rs] = await Promise.all([
        api.get("/gommoni/preventivi"), api.get("/gommoni/modelli"), api.get("/gommoni/accessori"),
        api.get("/suzuki/modelli"), api.get("/gommoni/sconti"),
      ]);
      setItems(rp.data); setGommoni(rg.data); setAccessori(ra.data); setMotori(rm.data); setSconti(rs.data);
    } catch { toast.error("Errore caricamento"); }
  };
  useEffect(() => { load(); }, []);

  const openPdf = async (p) => {
    try {
      const res = await api.get(`/gommoni/preventivi/${p.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setPreviewName(`preventivo_gommone_${p.numero || p.id.slice(0, 6)}.pdf`);
      setPreviewOpen(true);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore PDF"); }
  };
  const remove = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await api.delete(`/gommoni/preventivi/${id}`); toast.success("Preventivo eliminato"); load();
  };
  const newPrev = () => setEditing({ ...EMPTY_PREV_GOMMONE, sconto_perc: Number(sconti.privati) || 0 });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={newPrev} disabled={!gommoni.length} className="bg-primary" data-testid="btn-new-prev-gommone"><Plus className="w-4 h-4 mr-2" /> Nuovo preventivo</Button>
      </div>
      {!gommoni.length && <Card className="p-6 text-sm text-muted-foreground text-center">Devi prima aggiungere almeno un gommone nel Catalogo.</Card>}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-prev-gommoni">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-3">N°</th><th className="text-left px-4 py-3">Data</th><th className="text-left px-4 py-3">Cliente</th><th className="text-left px-4 py-3">Tipo</th><th className="text-left px-4 py-3">Gommone</th><th className="text-left px-4 py-3">Motore</th><th className="text-right px-4 py-3">Totale</th><th className="w-32"></th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nessun preventivo.</td></tr>
              ) : items.map((p) => (
                <tr key={p.id} className="border-t border-border/60 hover:bg-muted/30" data-testid={`row-prev-gommone-${p.id}`}>
                  <td className="px-4 py-2.5 font-mono">{p.numero || "—"}</td>
                  <td className="px-4 py-2.5">{p.data}</td>
                  <td className="px-4 py-2.5 font-semibold">{p.cliente_nome}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{CATEGORIE.find((c) => c.key === p.tipo_cliente)?.label || "—"}</td>
                  <td className="px-4 py-2.5">{p.modello}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.motore_modello || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-primary">{fmt(totale(p))}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPdf(p)} data-testid={`btn-pdf-prev-gommone-${p.id}`}><FileText className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...p })} data-testid={`btn-edit-prev-gommone-${p.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(p.id)} data-testid={`btn-del-prev-gommone-${p.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {editing && <PreventivoGommoneDialog value={editing} gommoni={gommoni} accessori={accessori} motori={motori} sconti={sconti} onClose={() => setEditing(null)} onSaved={load} />}
      <PdfPreviewOverlay open={previewOpen} onClose={() => setPreviewOpen(false)} url={previewUrl} filename={previewName} />
    </div>
  );
}
