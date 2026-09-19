import { useEffect, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { Field } from "./common";

export default function ListinoConcessionarioButton() {
  const [open, setOpen] = useState(false);
  const [sc1, setSc1] = useState(10);
  const [sc2, setSc2] = useState(5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    api.get("/suzuki/listino-conc-sconti")
      .then((r) => { if (alive) { setSc1(r.data.sc1 ?? 10); setSc2(r.data.sc2 ?? 5); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open]);

  const openPdf = async () => {
    const s1 = Number(sc1) || 0;
    const s2 = Number(sc2) || 0;
    try {
      await api.put("/suzuki/listino-conc-sconti", { sc1: s1, sc2: s2 });
    } catch {
      toast.error("Impossibile salvare gli sconti, ma il PDF sarà generato lo stesso");
    }
    const params = new URLSearchParams({ sc1: String(s1), sc2: String(s2), _t: String(Date.now()) });
    window.open(`${API}/suzuki/listino-concessionario.pdf?${params.toString()}`, "_blank");
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
        data-testid="btn-pdf-listino-conc"
      >
        <FileText className="w-4 h-4 mr-2" /> Listino concessionario
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-listino-conc-sconti">
          <DialogHeader>
            <DialogTitle>Sconti per calcolo guadagno</DialogTitle>
            <DialogDescription>
              Gli sconti composti (Sc.1 + Sc.2) vengono applicati sul <b>Prezzo pubblico IVA inclusa</b>, poi convertiti in IVA esclusa per calcolare il margine sul <b>Netto concessionario</b>. I valori vengono ricordati per la prossima volta.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sconto 1 (%)">
              <Input type="number" step="0.5" min="0" max="100" value={sc1} onChange={(e) => setSc1(e.target.value)} disabled={loading} data-testid="in-conc-sc1" />
            </Field>
            <Field label="Sconto 2 (%)">
              <Input type="number" step="0.5" min="0" max="100" value={sc2} onChange={(e) => setSc2(e.target.value)} disabled={loading} data-testid="in-conc-sc2" />
            </Field>
          </div>
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2">
            {loading ? "Caricamento ultimi valori usati…" : "I guadagni negativi vengono evidenziati in rosso nel PDF."}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={openPdf} className="bg-primary" data-testid="btn-open-listino-conc" disabled={loading}>
              <FileText className="w-4 h-4 mr-2" /> Salva e apri PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
