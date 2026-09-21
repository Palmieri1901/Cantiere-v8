import React, { useRef, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { api, API } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Trash2, Image as ImageIcon } from "lucide-react";

export default function LogoPdfButton() {
  const [open, setOpen] = useState(false);
  const [bust, setBust] = useState(Date.now());
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const src = `${API}/suzuki/logo?t=${bust}`;

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      await api.post("/suzuki/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Logo aggiornato. I nuovi PDF useranno questo logo.");
      setBust(Date.now());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore upload logo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const reset = async () => {
    if (!await confirmDialog("Rimuovere il logo? I PDF verranno stampati senza intestazione grafica.")) return;
    try {
      await api.delete("/suzuki/logo");
      toast.success("Logo rimosso");
      setBust(Date.now());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Errore");
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} data-testid="btn-logo-pdf">
        <ImageIcon className="w-4 h-4 mr-2" /> Logo PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Logo intestazione PDF Suzuki</DialogTitle>
            <DialogDescription>
              Il logo comparirà in cima a Preventivo, Listino e Caratteristiche. Formati supportati: PNG, JPG, WebP · max 5 MB.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border rounded-lg bg-muted/30 p-4 flex items-center justify-center min-h-[140px]">
              <img
                src={src}
                alt="Logo attuale"
                className="max-h-32 object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.parentElement.innerHTML = '<div class="text-sm text-muted-foreground">Nessun logo impostato</div>'; }}
                data-testid="img-logo-preview"
              />
            </div>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="hidden" data-testid="input-logo-file" />
            <div className="flex gap-2">
              <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="flex-1" data-testid="btn-upload-logo">
                <Upload className="w-4 h-4 mr-2" /> {uploading ? "Caricamento…" : "Carica nuovo logo"}
              </Button>
              <Button variant="outline" onClick={reset} data-testid="btn-reset-logo">
                <Trash2 className="w-4 h-4 mr-2" /> Rimuovi
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
