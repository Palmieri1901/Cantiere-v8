import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrScanner } from "@/components/QrScanner";
import { toast } from "sonner";

export default function QrImportDialog({ open, onOpenChange, onImported }) {
  const [chunks, setChunks] = useState({}); // {n, d, parts: {p: items}}
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = useCallback((raw) => {
    let d;
    try { d = JSON.parse(raw); } catch { return; }
    if (d?.t !== "pm-lavori") return;
    setChunks((s) => {
      if (s.parts?.[d.p]) return s;
      const parts = { ...(s.parts || {}), [d.p]: d.items };
      return { n: d.n, d: d.d, parts };
    });
  }, []);

  const received = Object.keys(chunks.parts || {}).length;
  const complete = chunks.n && received === chunks.n;

  const importa = async () => {
    const lavori = Object.keys(chunks.parts).sort((a, b) => a - b).flatMap((k) => chunks.parts[k]);
    setBusy(true);
    try {
      const r = await api.post("/lavori-pending/import-qr", { dipendente_nome: chunks.d, lavori });
      toast.success(`Importati ${r.data.nuovi} lavori${r.data.duplicati ? ` (${r.data.duplicati} già presenti)` : ""}`);
      setChunks({}); onImported(); onOpenChange(false);
    } catch (e) { toast.error(e.response?.data?.detail || "Errore importazione"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setChunks({}); }}>
      <DialogContent className="max-w-lg" data-testid="qr-import-dialog">
        <DialogHeader>
          <DialogTitle>Importa lavori da QR</DialogTitle>
          <DialogDescription>Nell'app del dipendente premi "Mostra QR" e inquadra il codice con la webcam. Se i lavori sono molti, il QR è diviso in più pagine: scansionale tutte.</DialogDescription>
        </DialogHeader>
        {open && <QrScanner onResult={handle} active={!complete} />}
        <div className="text-sm font-medium" data-testid="qr-progress">
          {chunks.n ? `Pagine lette: ${received} / ${chunks.n} · dipendente ${chunks.d || "—"}` : "In attesa di un QR…"}
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Incolla manualmente il contenuto del QR</summary>
          <Textarea rows={3} value={manual} onChange={(e) => setManual(e.target.value)} className="mt-2 font-mono text-[11px]" data-testid="qr-manual-input" />
          <Button size="sm" variant="outline" className="mt-2" onClick={() => { handle(manual); setManual(""); }} data-testid="btn-qr-manual">Aggiungi</Button>
        </details>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
          <Button disabled={!complete || busy} onClick={importa} className="bg-primary hover:bg-primary/90" data-testid="btn-qr-importa">Importa {complete ? Object.values(chunks.parts).flat().length : ""} lavori</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
