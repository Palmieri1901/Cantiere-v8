import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";
import { openBlob } from "@/pages/ddt/common";
import { toast } from "sonner";
import { FileBadge, Landmark, ShieldCheck } from "lucide-react";
import DatiBancariTab from "@/pages/servizio/DatiBancariTab";
import PrivacyTab from "@/pages/servizio/PrivacyTab";

export default function DocumentiServizio() {
  const [dati, setDati] = useState(null);
  const [preview, setPreview] = useState({ open: false, name: "documento.pdf" });
  const [previewUrl, setPreviewUrl] = useState(null);

  const load = () => api.get("/servizio/dati").then((r) => setDati(r.data));
  useEffect(() => { load(); }, []);

  const anteprima = async (url, name) => {
    try {
      setPreview((p) => ({ ...p, name }));
      await openBlob(api, "get", url, null, setPreviewUrl, (o) => setPreview((p) => ({ ...p, open: o })));
    } catch (e) { toast.error(e.response?.data?.detail || "Errore PDF"); }
  };

  if (!dati) return <div className="p-8 text-muted-foreground">Caricamento…</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl" data-testid="servizio-page">
      <div className="label-mini flex items-center gap-1.5 mb-2"><FileBadge className="w-3.5 h-3.5" /> Documenti di servizio</div>
      <h1 className="font-display text-4xl sm:text-5xl font-semibold mb-2">Coordinate bancarie e privacy</h1>
      <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-2xl">Moduli su carta intestata pronti da stampare o inviare: dati per il bonifico e consenso al trattamento dei dati.</p>
      <Tabs defaultValue="banca">
        <TabsList className="mb-6">
          <TabsTrigger value="banca" data-testid="tab-banca" className="gap-2"><Landmark className="w-4 h-4" /> Dati bancari</TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy" className="gap-2"><ShieldCheck className="w-4 h-4" /> Consenso privacy</TabsTrigger>
        </TabsList>
        <TabsContent value="banca"><DatiBancariTab dati={dati} onSaved={setDati} anteprima={anteprima} /></TabsContent>
        <TabsContent value="privacy"><PrivacyTab dati={dati} onSaved={setDati} anteprima={anteprima} /></TabsContent>
      </Tabs>
      <PdfPreviewOverlay open={preview.open} onClose={() => setPreview((p) => ({ ...p, open: false }))} url={previewUrl} filename={preview.name} />
    </div>
  );
}
