import { useRef, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileCheck2, Upload, Trash2 } from "lucide-react";

export default function OmologazioneButton({ modello, onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const has = !!modello.omologazione_file_id;

  const upload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) { toast.error("Carica un file PDF"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post(`/gommoni/modelli/${modello.id}/omologazione`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Omologazione caricata");
      onChanged?.();
    } catch (err) { toast.error(err.response?.data?.detail || "Errore upload"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("Rimuovere il PDF di omologazione?")) return;
    await api.delete(`/gommoni/modelli/${modello.id}/omologazione`);
    toast.success("Omologazione rimossa"); onChanged?.();
  };

  return (
    <div className="flex items-center gap-1">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={upload} data-testid={`in-omologazione-${modello.id}`} />
      {has ? (
        <>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50" title={modello.omologazione_nome}
            onClick={() => window.open(`${API}/gommoni/modelli/${modello.id}/omologazione.pdf?_t=${Date.now()}`, "_blank")} data-testid={`btn-omologazione-view-${modello.id}`}>
            <FileCheck2 className="w-3.5 h-3.5 mr-1" /> Omologazione
          </Button>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-muted-foreground hover:text-foreground" title="Sostituisci PDF" data-testid={`btn-omologazione-replace-${modello.id}`}><Upload className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={remove} className="text-muted-foreground hover:text-destructive" title="Rimuovi" data-testid={`btn-omologazione-del-${modello.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => inputRef.current?.click()} disabled={busy} data-testid={`btn-omologazione-upload-${modello.id}`}>
          <Upload className="w-3.5 h-3.5 mr-1" /> {busy ? "Caricamento…" : "Carica omologazione"}
        </Button>
      )}
    </div>
  );
}
