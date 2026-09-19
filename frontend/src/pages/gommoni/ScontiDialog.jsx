import { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Percent, Save, FileText } from "lucide-react";
import { CATEGORIE, Field } from "./common";

export default function ScontiDialog({ open, onClose }) {
  const [sconti, setSconti] = useState({ privati: 0, lavoro: 10, concessionari: 20 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.get("/gommoni/sconti").then((r) => setSconti(r.data)).catch(() => toast.error("Errore caricamento sconti"));
  }, [open]);

  const payload = () => Object.fromEntries(CATEGORIE.map((c) => [c.key, Number(sconti[c.key]) || 0]));

  const save = async () => {
    setSaving(true);
    try { await api.put("/gommoni/sconti", payload()); toast.success("Sconti salvati"); }
    catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  const openPdf = async (cat) => {
    setSaving(true);
    try {
      await api.put("/gommoni/sconti", payload());
      window.open(`${API}/gommoni/listino-cantiere.pdf?categoria=${cat}&_t=${Date.now()}`, "_blank");
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-sconti-gommoni">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700"><Percent className="w-5 h-5" /> Listino cantiere — sconti per tipologia</DialogTitle>
          <DialogDescription className="text-xs">Percentuale di sconto sul prezzo pubblico applicata a ogni tipologia di cliente. Ogni listino si esporta in PDF separato.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {CATEGORIE.map((c) => (
            <div key={c.key} className="flex items-end gap-3">
              <div className="flex-1">
                <Field label={`${c.label} — sconto %`}>
                  <Input type="number" step="0.5" min="0" max="100" value={sconti[c.key] ?? ""} onChange={(e) => setSconti((s) => ({ ...s, [c.key]: e.target.value }))} data-testid={`in-sconto-${c.key}`} />
                </Field>
              </div>
              <Button variant="outline" onClick={() => openPdf(c.key)} disabled={saving} className="border-red-500 text-red-600 hover:bg-red-50" data-testid={`btn-pdf-cantiere-${c.key}`}>
                <FileText className="w-4 h-4 mr-1.5" /> PDF {c.label}
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          <Button onClick={save} disabled={saving} className="bg-primary" data-testid="btn-save-sconti"><Save className="w-4 h-4 mr-1.5" /> Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
