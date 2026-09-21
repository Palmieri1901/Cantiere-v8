import { useEffect, useMemo, useState } from "react";
import { confirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { EMPTY_ACCESSORIO, Field, fmt, SERIE, taglieDaModelli, prezzoAccessorio } from "./common";

function AccessorioDialog({ value, taglieBySerie, onClose, onSaved }) {
  const [form, setForm] = useState({ ...value, prezzi_per_modello: { ...(value.prezzi_per_modello || {}) }, di_serie: [...(value.di_serie || [])] });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const taglie = taglieBySerie[form.serie] || [];
  const cellValue = (t) => (form.di_serie.includes(t) ? "serie" : form.prezzi_per_modello[t] ?? "");
  const setCell = (t, raw) => setForm((f) => {
    const v = String(raw).trim().toLowerCase();
    const di_serie = f.di_serie.filter((x) => x !== t);
    const prezzi = { ...f.prezzi_per_modello }; delete prezzi[t];
    if (v === "s" || v.startsWith("ser") || v.startsWith("inc")) di_serie.push(t);
    else if (v !== "" && !isNaN(Number(v))) prezzi[t] = Number(v);
    return { ...f, di_serie, prezzi_per_modello: prezzi };
  });

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
      <DialogContent className="max-w-2xl" data-testid="dialog-accessorio">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifica accessorio" : "Nuovo accessorio optional"}</DialogTitle>
          <DialogDescription className="text-xs">Prezzi <b>IVA esclusa</b> (come listino GEB). Per taglia scrivi il prezzo oppure "serie" se incluso.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2"><Field label="Nome *"><Input value={form.nome || ""} onChange={(e) => set("nome", e.target.value)} data-testid="a-nome" /></Field></div>
          <Field label="Serie">
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.serie || ""} onChange={(e) => set("serie", e.target.value)} data-testid="a-serie">
              <option value="">Tutte</option>
              {SERIE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Specifiche"><Input value={form.specifiche || ""} onChange={(e) => set("specifiche", e.target.value)} placeholder="Montato" /></Field>
          <Field label="Prezzo base € (IVA escl.)"><Input type="number" step="0.01" value={form.prezzo || ""} onChange={(e) => set("prezzo", e.target.value)} data-testid="a-prezzo" /></Field>
          <div className="col-span-2 md:col-span-3"><Field label="Descrizione"><Input value={form.descrizione || ""} onChange={(e) => set("descrizione", e.target.value)} /></Field></div>
        </div>
        {taglie.length > 0 && (
          <div>
            <div className="label-mini mb-2">Prezzo per taglia (IVA escl.) — serie {form.serie}</div>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {taglie.map((t) => (
                <Field key={t} label={t}><Input value={cellValue(t)} onChange={(e) => setCell(t, e.target.value)} placeholder="—" className={`h-8 text-right ${form.di_serie.includes(t) ? "text-emerald-700 font-semibold" : ""}`} data-testid={`a-prezzo-${t}`} /></Field>
              ))}
            </div>
          </div>
        )}
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
  const [modelli, setModelli] = useState([]);
  const [iva, setIva] = useState(22);
  const [editing, setEditing] = useState(null);
  const [serieFilter, setSerieFilter] = useState("");
  const load = async () => {
    try {
      const [ra, rm, rc] = await Promise.all([api.get("/gommoni/accessori"), api.get("/gommoni/modelli"), api.get("/cantiere")]);
      setItems(ra.data); setModelli(rm.data); setIva(Number(rc.data?.iva_percentuale) || 22);
    } catch { toast.error("Errore caricamento accessori"); }
  };
  useEffect(() => { load(); }, []);
  const taglieBySerie = useMemo(() => taglieDaModelli(modelli), [modelli]);
  const remove = async (id) => {
    if (!await confirmDialog("Eliminare questo accessorio?")) return;
    await api.delete(`/gommoni/accessori/${id}`); toast.success("Accessorio eliminato"); load();
  };
  const groups = useMemo(() => {
    const g = {};
    for (const a of items) if (!serieFilter || (a.serie || "") === serieFilter) (g[a.serie || "Tutte le serie"] ||= []).push(a);
    return g;
  }, [items, serieFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Serie</span>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={serieFilter} onChange={(e) => setSerieFilter(e.target.value)} data-testid="acc-serie-filter">
            <option value="">Tutte</option>
            {SERIE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-muted-foreground ml-2">Prezzi listino IVA esclusa · tra parentesi IVA {iva}% inclusa</span>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY_ACCESSORIO, serie: serieFilter })} className="bg-primary" data-testid="btn-new-accessorio"><Plus className="w-4 h-4 mr-2" /> Nuovo accessorio</Button>
      </div>
      {Object.keys(groups).length === 0 && <Card className="p-10 text-center text-muted-foreground">Nessun accessorio optional.</Card>}
      {Object.entries(groups).map(([serie, list]) => {
        const taglie = taglieBySerie[serie] || [];
        return (
          <Card key={serie} className="overflow-hidden" data-testid={`acc-group-${serie}`}>
            <div className="px-4 py-2 bg-muted/60 font-semibold text-sm">Serie {serie}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-accessori">
                <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Accessorio</th><th className="text-left px-2 py-2">Specifiche</th>
                    {taglie.length ? taglie.map((t) => <th key={t} className="text-right px-2 py-2">{t}</th>) : <th className="text-right px-2 py-2">Prezzo</th>}
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-t border-border/60 hover:bg-muted/30" data-testid={`row-accessorio-${a.id}`}>
                      <td className="px-4 py-2 font-semibold">{a.nome}{a.descrizione && <div className="text-xs text-muted-foreground font-normal">{a.descrizione}</div>}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">{a.specifiche || "—"}</td>
                      {taglie.length ? taglie.map((t) => {
                        const p = prezzoAccessorio(a, t);
                        return <td key={t} className="px-2 py-2 text-right font-mono-num text-xs">{p === null ? "—" : p === 0 ? <span className="text-emerald-700 font-semibold">di serie</span> : <>{fmt(p)}<div className="text-[10px] text-muted-foreground">({fmt(p * (1 + iva / 100))})</div></>}</td>;
                      }) : <td className="px-2 py-2 text-right font-mono-num">{fmt(a.prezzo)}<div className="text-[10px] text-muted-foreground">({fmt(a.prezzo * (1 + iva / 100))})</div></td>}
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing({ ...a })} data-testid={`btn-edit-accessorio-${a.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => remove(a.id)} data-testid={`btn-del-accessorio-${a.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
      {editing && <AccessorioDialog value={editing} taglieBySerie={taglieBySerie} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
