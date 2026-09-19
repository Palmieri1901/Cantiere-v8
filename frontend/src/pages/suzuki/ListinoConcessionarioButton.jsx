import { useState } from "react";
import { API } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { Field } from "./common";

export default function ListinoConcessionarioButton() {
  const [open, setOpen] = useState(false);
  const [sc1, setSc1] = useState(10);
  const [sc2, setSc2] = useState(5);

  const openPdf = () => {
    const params = new URLSearchParams({ sc1: String(Number(sc1) || 0), sc2: String(Number(sc2) || 0) });
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
              Il listino concessionario mostra automaticamente lo sconto medio Suzuki e il guadagno stimato applicando due sconti composti sul prezzo pubblico. Digita gli sconti da usare per la colonna "Guadagno".
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sconto 1 (%)">
              <Input type="number" step="0.5" min="0" max="100" value={sc1} onChange={(e) => setSc1(e.target.value)} data-testid="in-conc-sc1" />
            </Field>
            <Field label="Sconto 2 (%)">
              <Input type="number" step="0.5" min="0" max="100" value={sc2} onChange={(e) => setSc2(e.target.value)} data-testid="in-conc-sc2" />
            </Field>
          </div>
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md p-2">
            Sconti composti applicati sul <b>Prezzo pubblico IVA inclusa</b>, poi convertiti in IVA esclusa per calcolare il margine sul <b>Netto concessionario</b>.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
            <Button onClick={openPdf} className="bg-primary" data-testid="btn-open-listino-conc">
              <FileText className="w-4 h-4 mr-2" /> Apri PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
