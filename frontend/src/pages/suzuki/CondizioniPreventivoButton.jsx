import { useEffect, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, Save } from "lucide-react";

export default function CondizioniPreventivoButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/suzuki/condizioni-preventivo");
      setText((r.data.righe || []).join("\n"));
    } catch { toast.error("Errore caricamento condizioni"); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const righe = text.split("\n").map((s) => s.trim()).filter(Boolean);
      await api.put("/suzuki/condizioni-preventivo", { righe });
      toast.success("Condizioni salvate. Verranno usate nei prossimi PDF.");
      setOpen(false);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!await confirmDialog("Ripristinare le condizioni originali?")) return;
    try {
      const r = await api.post("/suzuki/condizioni-preventivo/reset");
      setText((r.data.righe || []).join("\n"));
      toast.success("Condizioni ripristinate");
    } catch (e) { toast.error(e.response?.data?.detail || "Errore"); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="btn-condizioni">
        <FileText className="w-4 h-4 mr-2" /> Condizioni preventivo
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Condizioni preventivo</DialogTitle>
            <DialogDescription>
              Testo stampato in fondo a ogni PDF preventivo Suzuki. Una condizione per riga (le righe vuote vengono ignorate).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="font-mono text-sm"
            placeholder={loading ? "Caricamento…" : "Preventivo valido 30 giorni salvo esaurimento scorte.\nConsegna e montaggio da concordare…"}
            disabled={loading}
            data-testid="txt-condizioni"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={reset} data-testid="btn-condizioni-reset">Ripristina originali</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving || loading} data-testid="btn-condizioni-save">
              <Save className="w-4 h-4 mr-2" /> {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
