import { useCallback, useState } from "react";
import { mobileStore, mobileApi } from "@/lib/mobileStore";
import { QrScanner } from "@/components/QrScanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sailboat, QrCode, KeyRound } from "lucide-react";

export default function LoginKey({ onLogged }) {
  const [key, setKey] = useState("");
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);

  const entra = async (k, url) => {
    setBusy(true);
    try {
      mobileStore.login(k.trim().toUpperCase(), "", url);
      const r = await mobileApi().get("/me");
      mobileStore.login(k.trim().toUpperCase(), r.data.nome, url);
      toast.success(`Benvenuto ${r.data.nome}`);
      onLogged();
    } catch (e) {
      mobileStore.logout();
      toast.error(e.response?.status === 401 ? "Chiave non valida" : "Connessione non riuscita: serve internet per il primo accesso");
    } finally { setBusy(false); }
  };

  const onQr = useCallback((raw) => {
    try {
      const d = JSON.parse(raw);
      if (d.t === "pm-key" && d.k) { setScan(false); entra(d.k, d.u); }
    } catch { /* non è il nostro QR */ }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 max-w-md mx-auto" data-testid="mobile-login">
      <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground grid place-items-center mb-4"><Sailboat className="w-7 h-7" /></div>
      <h1 className="font-display text-3xl font-semibold text-center">App dipendenti</h1>
      <p className="text-sm text-muted-foreground text-center mt-2 mb-8">Inserisci la chiave personale ricevuta dal cantiere oppure scansiona il QR.</p>

      {scan ? (
        <div className="w-full space-y-3">
          <QrScanner onResult={onQr} />
          <Button variant="outline" className="w-full" onClick={() => setScan(false)}>Annulla</Button>
        </div>
      ) : (
        <div className="w-full space-y-3">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="PM-XXXX-XXXX-XXXX" className="text-center font-mono text-lg h-12 uppercase" data-testid="input-mobile-key" />
          <Button className="w-full h-12 bg-primary hover:bg-primary/90" disabled={!key || busy} onClick={() => entra(key)} data-testid="btn-mobile-entra"><KeyRound className="w-4 h-4 mr-2" /> Entra</Button>
          <Button variant="outline" className="w-full h-12" onClick={() => setScan(true)} data-testid="btn-mobile-scan-qr"><QrCode className="w-4 h-4 mr-2" /> Scansiona QR</Button>
        </div>
      )}
    </div>
  );
}
