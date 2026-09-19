import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, FileSignature, Save, Anchor } from "lucide-react";

const BLOCCHI = [
  { titoloKey: "preventivo_interno_titolo", testoKey: "preventivo_interno_testo", label: "Interno cantiere" },
  { titoloKey: "preventivo_piazzale_titolo", testoKey: "preventivo_piazzale_testo", label: "Sosta su piazzale" },
  { titoloKey: "preventivo_esclusi_titolo", testoKey: "preventivo_esclusi_testo", label: "Esclusi dal servizio" },
  { titoloKey: "preventivo_condizioni_titolo", testoKey: "preventivo_condizioni_testo", label: "Condizioni generali" },
];

export default function ImpostazioniRimessaggio() {
  const [c, setC] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await api.get("/cantiere");
      setC(r.data);
    } catch { toast.error("Errore caricamento impostazioni"); }
  };

  useEffect(() => { load(); }, []);

  const update = (k, v) => setC((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!c) return;
    setSaving(true);
    try {
      // preserva TUTTI gli altri campi del cantiere: fai un merge e re-invia
      const payload = { ...c };
      // rimuovi campi non modificabili se presenti
      delete payload.id;
      delete payload._id;
      await api.put("/cantiere", payload);
      toast.success("Impostazioni Rimessaggio salvate");
      load();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally { setSaving(false); }
  };

  if (!c) return <div className="p-8 text-muted-foreground">Caricamento…</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 label-mini mb-2">
            <Anchor className="w-3.5 h-3.5" /> Rimessaggio
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Impostazioni Rimessaggio</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Testi e condizioni stampate nei preventivi Rimessaggio e template usato nei contratti clienti.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90 shrink-0" data-testid="btn-save-imp-rim">
          <Save className="w-4 h-4 mr-1.5" /> {saving ? "Salvataggio…" : "Salva"}
        </Button>
      </div>

      {/* Blocchi editabili del preventivo PDF */}
      <Card className="p-6" data-testid="preventivo-blocks-card">
        <div className="label-mini mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Testo condizioni del preventivo PDF
        </div>
        <h3 className="font-display text-xl font-semibold mb-1">Blocchi personalizzabili stampati in coda al preventivo</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          Questi 4 blocchi compaiono automaticamente in fondo a ogni preventivo PDF generato. Lascia vuoto un titolo o un testo per non stamparlo.
        </p>
        <div className="grid grid-cols-1 gap-5">
          {BLOCCHI.map((b) => (
            <div key={b.titoloKey} className="border border-border/60 rounded-md p-4 bg-muted/10">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titolo · {b.label}</Label>
              <Input
                value={c[b.titoloKey] ?? ""}
                onChange={(e) => update(b.titoloKey, e.target.value)}
                className="mt-1.5 mb-3"
                data-testid={`input-${b.titoloKey}`}
              />
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testo</Label>
              <Textarea
                value={c[b.testoKey] ?? ""}
                onChange={(e) => update(b.testoKey, e.target.value)}
                rows={6}
                className="mt-1.5 font-mono text-xs"
                data-testid={`input-${b.testoKey}`}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Template contratto */}
      <Card className="p-6 mt-6" data-testid="contratto-template-card">
        <div className="label-mini mb-2 flex items-center gap-1.5">
          <FileSignature className="w-3.5 h-3.5" /> Template contratto
        </div>
        <h3 className="font-display text-xl font-semibold mb-1">Testo di partenza usato nella pagina Contratti</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
          Quando apri la pagina Contratti il testo qui sotto viene pre-caricato nell'editor. Puoi poi personalizzarlo per ogni singolo cliente prima di scaricare il PDF.
        </p>
        <Textarea
          value={c.contratto_template ?? ""}
          onChange={(e) => update("contratto_template", e.target.value)}
          rows={12}
          className="font-mono text-xs"
          data-testid="input-contratto-template"
        />
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90" data-testid="btn-save-imp-rim-2">
          <Save className="w-4 h-4 mr-1.5" /> {saving ? "Salvataggio…" : "Salva impostazioni"}
        </Button>
      </div>
    </div>
  );
}
