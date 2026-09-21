import { useEffect, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";
import { EMPTY_PREV, fmt } from "./common";
import PreventivoDialog from "./PreventivoDialog";
import CondizioniPreventivoButton from "./CondizioniPreventivoButton";

export default function PreventiviTab() {
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
    if (!await confirmDialog("Eliminare questo preventivo?")) return;
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
