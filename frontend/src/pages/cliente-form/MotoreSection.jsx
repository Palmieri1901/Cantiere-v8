import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, ToggleRow } from "./common";

export default function MotoreSection({ f, update }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="label-mini">{f.secondo_motore ? "1° Motore" : "Motore"}</div>
        <div className="flex items-center gap-2">
          <Label htmlFor="switch-primo-motore" className="text-sm text-muted-foreground">Motore presente</Label>
          <Switch
            id="switch-primo-motore"
            checked={f.primo_motore_attivo !== false}
            onCheckedChange={(v) => update("primo_motore_attivo", v)}
            data-testid="switch-primo-motore"
          />
        </div>
      </div>
      {f.primo_motore_attivo === false ? (
        <div className="p-4 rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground mb-4" data-testid="motore-disattivato">
          Motore <b>disattivato</b> — nessun costo manodopera/ricambi motore verrà calcolato. I servizi opzionali qui sotto restano comunque disponibili.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Field label="Tipo motore">
              <Select value={f.tipo_motore || "fuoribordo"} onValueChange={(v) => update("tipo_motore", v)}>
                <SelectTrigger data-testid="select-tipo-motore"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuoribordo">Fuoribordo</SelectItem>
                  <SelectItem value="entrobordo">Entrobordo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cavalli (HP)">
              <Input type="number" min="0" step="1" value={f.potenza_motore} onChange={(e) => update("potenza_motore", e.target.value)} data-testid="input-potenza-motore" />
            </Field>
            <Field label="Litri olio motore">
              <Input type="number" min="0" step="0.1" value={f.litri_olio_motore} onChange={(e) => update("litri_olio_motore", e.target.value)} data-testid="input-litri-olio" />
            </Field>
            <Field label="Litri olio piede">
              <Input type="number" min="0" step="0.1" value={f.litri_olio_piede} onChange={(e) => update("litri_olio_piede", e.target.value)} data-testid="input-litri-olio-piede" />
            </Field>
            <Field label="N° candele">
              <Input type="number" min="0" step="1" value={f.numero_candele} onChange={(e) => update("numero_candele", e.target.value)} data-testid="input-numero-candele" />
            </Field>
            <Field label="N° termostati">
              <Input type="number" min="0" step="1" value={f.numero_termostati} onChange={(e) => update("numero_termostati", e.target.value)} data-testid="input-numero-termostati" />
            </Field>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2">
            Fuoribordo: manodopera a scaglioni HP (2-15 · 16-40 · 41-150 · &gt;150). Entrobordo: tariffa unica valida per qualsiasi HP. Olio motore calcolato al litro. I ricambi si moltiplicano per il numero indicato.
          </div>
        </>
      )}

      {/* Servizi opzionali - SEMPRE visibili, anche senza motore */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <ToggleRow
          label="Antivegetativa"
          description="Applica il costo antivegetativa"
          checked={!!f.antivegetativa_attiva}
          onChange={(v) => update("antivegetativa_attiva", v)}
          testId="switch-antivegetativa"
        />
        <ToggleRow
          label="Scafo sporco"
          description="Applica la maggiorazione scafo sporco"
          checked={!!f.scafo_sporco_attivo}
          onChange={(v) => update("scafo_sporco_attivo", v)}
          testId="switch-scafo-sporco"
        />
        <ToggleRow
          label="Copertura"
          description={f.tipo_sosta === "dentro" ? "Non applicabile con sosta al coperto" : "Applica il costo copertura (€ / metro)"}
          checked={!!f.copertura_attiva}
          onChange={(v) => update("copertura_attiva", v)}
          testId="switch-copertura"
          disabled={f.tipo_sosta === "dentro"}
        />
        {f.primo_motore_attivo !== false && (
          <ToggleRow
            label={f.secondo_motore ? "Girante 1° motore" : "Sostituzione girante"}
            description="Includi ricambio girante"
            checked={!!f.girante_attivo}
            onChange={(v) => update("girante_attivo", v)}
            testId="switch-girante"
          />
        )}
        {f.primo_motore_attivo !== false && (
          <ToggleRow
            label={f.secondo_motore ? "Filtro olio 1° motore" : "Filtro olio"}
            description="Includi ricambio filtro olio"
            checked={!!f.filtro_olio_attivo}
            onChange={(v) => update("filtro_olio_attivo", v)}
            testId="switch-filtro-olio"
          />
        )}
        {f.primo_motore_attivo !== false && (
          <ToggleRow
            label={f.secondo_motore ? "Kit anodi interni 1° motore" : "Kit anodi interni"}
            description="Includi kit anodi interni"
            checked={!!f.anodi_interni_attivo}
            onChange={(v) => update("anodi_interni_attivo", v)}
            testId="switch-anodi-interni"
          />
        )}
        {f.primo_motore_attivo !== false && (
          <ToggleRow
            label={f.secondo_motore ? "Kit anodi esterni 1° motore" : "Kit anodi esterni"}
            description="Includi kit anodi esterni"
            checked={!!f.anodi_esterni_attivo}
            onChange={(v) => update("anodi_esterni_attivo", v)}
            testId="switch-anodi-esterni"
          />
        )}
        {f.primo_motore_attivo !== false && (
          <ToggleRow
            label={f.secondo_motore ? "Olio piede 1° motore" : "Olio piede"}
            description="Includi olio piede (calcolato al litro)"
            checked={!!f.olio_piede_attivo}
            onChange={(v) => update("olio_piede_attivo", v)}
            testId="switch-olio-piede"
          />
        )}
        {f.primo_motore_attivo !== false && (
          <ToggleRow
            label={f.secondo_motore ? "Ingrassaggio 1° motore" : "Ingrassaggio"}
            description="Includi ingrassaggio completo"
            checked={!!f.ingrassaggio_attivo}
            onChange={(v) => update("ingrassaggio_attivo", v)}
            testId="switch-ingrassaggio"
          />
        )}
        <ToggleRow
          label="Lavaggio inizio stagione"
          description="Includi lavaggio a inizio stagione"
          checked={!!f.lavaggio_inizio_attivo}
          onChange={(v) => update("lavaggio_inizio_attivo", v)}
          testId="switch-lavaggio-inizio"
        />
        <ToggleRow
          label="Lavaggio fine stagione"
          description="Includi lavaggio a fine stagione"
          checked={!!f.lavaggio_fine_attivo}
          onChange={(v) => update("lavaggio_fine_attivo", v)}
          testId="switch-lavaggio-fine"
        />
        <ToggleRow
          label="Alaggio e varo"
          description="Richiesta alaggio + varo (sempre calcolati quando attivo)"
          checked={!!f.alaggio_varo_attivo}
          onChange={(v) => update("alaggio_varo_attivo", v)}
          testId="switch-alaggio-varo"
        />
      </div>
      {!f.antivegetativa_attiva && !f.scafo_sporco_attivo && (
        <div className="mt-2 text-[11px] text-muted-foreground bg-muted/40 border border-border rounded-md p-2" data-testid="info-no-antiveg">
          Antivegetativa disattivata. Attiva "Scafo sporco" se serve applicare la maggiorazione.
        </div>
      )}

      {/* Secondo motore */}
      <div className="mt-4 p-4 rounded-md border border-border bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <Label className="text-sm font-medium">Secondo motore</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Attiva se la barca ha un secondo motore. I ricambi vengono calcolati separatamente.
            </p>
          </div>
          <Switch checked={!!f.secondo_motore} onCheckedChange={(v) => update("secondo_motore", v)} data-testid="switch-secondo-motore" />
        </div>
        {f.secondo_motore && (
          <div className="pt-3 border-t border-border/60 space-y-3">
            <div className="label-mini">2° Motore</div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Field label="Tipo 2° motore">
                <Select value={f.tipo_motore_2 || "fuoribordo"} onValueChange={(v) => update("tipo_motore_2", v)}>
                  <SelectTrigger data-testid="select-tipo-motore-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuoribordo">Fuoribordo</SelectItem>
                    <SelectItem value="entrobordo">Entrobordo</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cavalli 2° motore">
                <Input type="number" min="0" step="1" value={f.potenza_motore_2} onChange={(e) => update("potenza_motore_2", e.target.value)} data-testid="input-potenza-motore-2" />
              </Field>
              <Field label="Litri olio 2°">
                <Input type="number" min="0" step="0.1" value={f.litri_olio_motore_2} onChange={(e) => update("litri_olio_motore_2", e.target.value)} data-testid="input-litri-olio-2" />
              </Field>
              <Field label="Lt olio piede 2°">
                <Input type="number" min="0" step="0.1" value={f.litri_olio_piede_2} onChange={(e) => update("litri_olio_piede_2", e.target.value)} data-testid="input-litri-olio-piede-2" />
              </Field>
              <Field label="N° candele 2°">
                <Input type="number" min="0" step="1" value={f.numero_candele_2} onChange={(e) => update("numero_candele_2", e.target.value)} data-testid="input-numero-candele-2" />
              </Field>
              <Field label="N° termostati 2°">
                <Input type="number" min="0" step="1" value={f.numero_termostati_2} onChange={(e) => update("numero_termostati_2", e.target.value)} data-testid="input-numero-termostati-2" />
              </Field>
            </div>
            <ToggleRow label="Girante 2° motore" description="Includi ricambio girante per il 2° motore" checked={!!f.girante_2_attivo} onChange={(v) => update("girante_2_attivo", v)} testId="switch-girante-2" />
            <ToggleRow label="Filtro olio 2° motore" description="Includi ricambio filtro olio del 2° motore" checked={!!f.filtro_olio_2_attivo} onChange={(v) => update("filtro_olio_2_attivo", v)} testId="switch-filtro-olio-2" />
            <ToggleRow label="Kit anodi interni 2° motore" description="Includi kit anodi interni per il 2° motore" checked={!!f.anodi_interni_2_attivo} onChange={(v) => update("anodi_interni_2_attivo", v)} testId="switch-anodi-interni-2" />
            <ToggleRow label="Kit anodi esterni 2° motore" description="Includi kit anodi esterni per il 2° motore" checked={!!f.anodi_esterni_2_attivo} onChange={(v) => update("anodi_esterni_2_attivo", v)} testId="switch-anodi-esterni-2" />
            <ToggleRow label="Olio piede 2° motore" description="Includi olio piede per il 2° motore (al litro)" checked={!!f.olio_piede_2_attivo} onChange={(v) => update("olio_piede_2_attivo", v)} testId="switch-olio-piede-2" />
            <ToggleRow label="Ingrassaggio 2° motore" description="Includi ingrassaggio completo per il 2° motore" checked={!!f.ingrassaggio_2_attivo} onChange={(v) => update("ingrassaggio_2_attivo", v)} testId="switch-ingrassaggio-2" />
          </div>
        )}
      </div>
    </section>
  );
}
