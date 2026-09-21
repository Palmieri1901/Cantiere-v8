import { useRef, useState } from "react";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileCheck2, Upload, Trash2, BookOpen } from "lucide-react";

const TIPI = {
  omologazione: { label: "Omologazione", icon: FileCheck2, cls: "border-emerald-500 text-emerald-700 hover:bg-emerald-50" },
  presentazione: { label: "Presentazione", icon: BookOpen, cls: "border-sky-500 text-sky-700 hover:bg-sky-50" },
};

export default function DocumentoButton({ modello, tipo, onChanged }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const cfg = TIPI[tipo];
  const Icon = cfg.icon;
  const has = !!modello[`${tipo}_file_id`];

  const upload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) { toast.error("Carica un file PDF"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post(`/gommoni/modelli/${modello.id}/doc/${tipo}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${cfg.label} caricata`);
      onChanged?.();
    } catch (err) { toast.error(err.response?.data?.detail || "Errore upload"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Rimuovere il PDF di ${cfg.label.toLowerCase()}?`)) return;
    await api.delete(`/gommoni/modelli/${modello.id}/doc/${tipo}`);
    toast.success(`${cfg.label} rimossa`); onChanged?.();
  };

  return (
    <div className="flex items-center gap-1">
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={upload} data-testid={`in-${tipo}-${modello.id}`} />
      {has ? (
        <>
          <Button variant="outline" size="sm" className={`h-7 px-2 text-xs ${cfg.cls}`} title={modello[`${tipo}_nome`]}
            onClick={() => window.open(`${API}/gommoni/modelli/${modello.id}/doc/${tipo}.pdf?_t=${Date.now()}`, "_blank")} data-testid={`btn-${tipo}-view-${modello.id}`}>
            <Icon className="w-3.5 h-3.5 mr-1" /> {cfg.label}
          </Button>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-muted-foreground hover:text-foreground" title="Sostituisci PDF" data-testid={`btn-${tipo}-replace-${modello.id}`}><Upload className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={remove} className="text-muted-foreground hover:text-destructive" title="Rimuovi" data-testid={`btn-${tipo}-del-${modello.id}`}><Trash2 className="w-3.5 h-3.5" /></button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => inputRef.current?.click()} disabled={busy} data-testid={`btn-${tipo}-upload-${modello.id}`}>
          <Upload className="w-3.5 h-3.5 mr-1" /> {busy ? "Caricamento…" : cfg.label}
        </Button>
      )}
    </div>
  );
}
