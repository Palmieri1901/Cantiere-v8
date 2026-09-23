import { useEffect, useState } from "react";
import { api, fmtEuro } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Eye } from "lucide-react";

const L = ({ children }) => <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</Label>;

const splitIban = (raw) => {
  const s = (raw || "").replace(/\s+/g, "").toUpperCase();
  const ok = s.startsWith("IT") && s.length === 27;
  return { s, ok, paese: s.slice(0, 2), check: s.slice(2, 4), cin: ok ? s[4] : "", abi: ok ? s.slice(5, 10) : "", cab: ok ? s.slice(10, 15) : "", conto: ok ? s.slice(15) : "" };
};

export default function DatiBancariTab({ dati, onSaved, anteprima }) {
  const [f, setF] = useState({ banca: dati.banca || "", intestatario: dati.intestatario || "", iban: dati.iban || "", bic: dati.bic || "", note_pagamento: dati.note_pagamento || "" });
  const [clienti, setClienti] = useState([]);
  const [cid, setCid] = useState("");
  const [importo, setImporto] = useState("");
  const [causale, setCausale] = useState("");
  const sp = splitIban(f.iban);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { api.get("/clienti").then((r) => setClienti(r.data)).catch(() => {}); }, []);

  const salva = async () => {
    if (f.iban && !sp.ok && sp.paese === "IT") return toast.error("IBAN italiano non valido: deve avere 27 caratteri");
    const r = await api.put("/servizio/dati", f); onSaved(r.data); toast.success("Dati bancari salvati");
  };

  const cliente = clienti.find((c) => c.id === cid);
  const perCliente = () => {
    if (!cid) return toast.error("Seleziona il cliente");
    const q = new URLSearchParams({ cliente_id: cid });
    if (importo) q.set("importo", importo);
    if (causale) q.set("causale", causale);
    anteprima(`/servizio/coordinate.pdf?${q}`, `Istruzioni_pagamento_${cliente?.cognome || ""}.pdf`);
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6" data-testid="banca-tab">
      <Card className="p-5 lg:col-span-3 space-y-4">
        <div className="label-mini">I tuoi dati bancari</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><L>Intestatario conto</L><Input value={f.intestatario} onChange={(e) => set("intestatario", e.target.value)} placeholder="Ragione sociale" data-testid="input-intestatario" /></div>
          <div className="space-y-1.5"><L>Banca</L><Input value={f.banca} onChange={(e) => set("banca", e.target.value)} placeholder="Es. Banca Intesa - Filiale di…" data-testid="input-banca" /></div>
        </div>
        <div className="space-y-1.5"><L>IBAN</L><Input value={f.iban} onChange={(e) => set("iban", e.target.value.toUpperCase())} placeholder="IT60 X054 2811 1010 0000 0123 456" className="font-mono tracking-wider" data-testid="input-iban" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" data-testid="iban-split">
          {[["Paese", sp.paese], ["CIN", sp.cin], ["ABI", sp.abi], ["CAB", sp.cab], ["Conto", sp.conto]].map(([k, v]) => (
            <div key={k} className="rounded-md bg-muted/50 border border-border/60 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="font-mono text-sm font-semibold min-h-5" data-testid={`iban-${k.toLowerCase()}`}>{v || "—"}</div>
            </div>
          ))}
        </div>
        {f.iban && !sp.ok && <div className="text-xs text-amber-700">Suddivisione ABI/CAB/CIN disponibile per IBAN italiani completi (27 caratteri).</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><L>BIC / SWIFT</L><Input value={f.bic} onChange={(e) => set("bic", e.target.value.toUpperCase())} className="font-mono" data-testid="input-bic" /></div>
        </div>
        <div className="space-y-1.5"><L>Nota in calce al PDF</L><Textarea rows={2} value={f.note_pagamento} onChange={(e) => set("note_pagamento", e.target.value)} placeholder="Es. Si prega di indicare la causale nel bonifico." data-testid="input-note-pagamento" /></div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={salva} className="bg-primary hover:bg-primary/90" data-testid="btn-salva-banca"><Save className="w-4 h-4 mr-1.5" /> Salva</Button>
          <Button variant="outline" onClick={() => anteprima("/servizio/coordinate.pdf", "Coordinate_bancarie.pdf")} disabled={!dati.iban} data-testid="btn-pdf-coordinate"><Eye className="w-4 h-4 mr-1.5" /> Anteprima PDF coordinate</Button>
        </div>
      </Card>

      <Card className="p-5 lg:col-span-2 space-y-4">
        <div className="label-mini">Istruzioni di pagamento per un cliente</div>
        <div className="space-y-1.5"><L>Cliente</L>
          <Select value={cid} onValueChange={(v) => { setCid(v); const c = clienti.find((x) => x.id === v); setCausale(c ? `Rimessaggio ${c.anno} - ${c.cognome} ${c.nome}` : ""); setImporto(""); }}>
            <SelectTrigger data-testid="select-banca-cliente"><SelectValue placeholder="Seleziona…" /></SelectTrigger>
            <SelectContent>{clienti.map((c) => <SelectItem key={c.id} value={c.id}>{c.cognome} {c.nome} · {c.tipo_barca} ({c.anno})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><L>Importo € (vuoto = totale annuale{cliente ? `: ${fmtEuro(totaleCliente(cliente))}` : ""})</L><Input type="number" step="0.01" value={importo} onChange={(e) => setImporto(e.target.value)} className="font-mono-num" data-testid="input-banca-importo" /></div>
        <div className="space-y-1.5"><L>Causale</L><Input value={causale} onChange={(e) => setCausale(e.target.value)} data-testid="input-banca-causale" /></div>
        <Button onClick={perCliente} disabled={!dati.iban} className="w-full bg-primary hover:bg-primary/90" data-testid="btn-pdf-pagamento"><Eye className="w-4 h-4 mr-1.5" /> Anteprima PDF per cliente</Button>
        {!dati.iban && <div className="text-xs text-muted-foreground">Salva prima l'IBAN.</div>}
      </Card>
    </div>
  );
}

const KEYS = ["costo_sosta", "costo_movimentazione", "costo_taccaggio", "costo_copertura", "costo_alaggio", "costo_varo", "costo_antivegetativa", "costo_scafo_sporco", "costo_lavaggio_inizio", "costo_lavaggio_fine", "costo_manutenzione_motore"];
function totaleCliente(c) {
  const extra = (c.lavorazioni_extra || []).reduce((s, it) => s + (Number(it?.prezzo) || 0), 0);
  return KEYS.reduce((s, k) => s + (Number(c[k]) || 0), 0) + extra + (Number(c.costo_lavori) || 0);
}
