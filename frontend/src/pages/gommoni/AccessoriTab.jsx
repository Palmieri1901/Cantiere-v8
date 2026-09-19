import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { EMPTY_ACCESSORIO, Field, fmt } from "./common";

function AccessorioDialog({ value, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.nome?.trim()) { toast.error("Nome obbligatorio"); return; }
    setSaving(true);
    try {
      const payload = { ...form, prezzo: Number(form.prezzo) || 0 };
      if (form.id) await api.put(`/gommoni/accessori/${form.id}`, payload);
      else await api.post("/gommoni/accessori", payload);
      toast.success("Accessorio salvato"); onSaved(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Errore salvataggio"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-accessorio">
        <DialogHeader><DialogTitle>{form.id ? "Modifica accessorio" : "Nuovo accessorio optional"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Nome *"><Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} data-testid="a-nome" /></Field></div>
          <Field label="Categoria"><Input value={form.categoria || ""} onChange={(e) => set("categoria", e.target.value)} placeholder="Consolle / Sedute / Tende" /></Field>
          <Field label="Prezzo € (IVA incl.)"><Input type="number" step="0.01" value={form.prezzo || ""} onChange={(e) => set("prezzo", e.target.value)} data-testid="a-prezzo" /></Field>
          <div className="col-span-2"><Field label="Descrizione"><Input value={form.descrizione || ""} onChange={(e) => set("descrizione", e.target.value)} /></Field></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={save} disabled={saving} className="bg-primary" data-testid="btn-save-accessorio"><Save className="w-4 h-4 mr-2" /> Salva</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AccessoriTab() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = async () => {
    try { setItems((await api.get("/gommoni/accessori")).data); }
    catch { toast.error("Errore caricamento accessori"); }
  };
  useEffect(() => { load(); }, []);
  const remove = async (id) => {
    if (!window.confirm("Eliminare questo accessorio?")) return;
    await api.delete(`/gommoni/accessori/${id}`); toast.success("Accessorio eliminato"); load();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ ...EMPTY_ACCESSORIO })} className="bg-primary" data-testid="btn-new-accessorio"><Plus className="w-4 h-4 mr-2" /> Nuovo accessorio</Button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm" data-testid="table-accessori">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="text-left px-4 py-3">Accessorio</th><th className="text-left px-4 py-3">Categoria</th><th className="text-left px-4 py-3">Descrizione</th><th className="text-right px-4 py-3">Prezzo</th><th className="w-24"></th></tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nessun accessorio optional.</td></tr>
            ) : items.map((a) => (
              <tr key={a.id} className="border-t border-border/60 hover:bg-muted/30" data-testid={`row-accessorio-${a.id}`}>
                <td className="px-4 py-2.5 font-semibold">{a.nome}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.categoria || "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.descrizione || "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono-num font-semibold text-primary">{fmt(a.prezzo)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...a })} data-testid={`btn-edit-accessorio-${a.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(a.id)} data-testid={`btn-del-accessorio-${a.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && <AccessorioDialog value={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
