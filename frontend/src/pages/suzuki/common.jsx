import { Label } from "@/components/ui/label";

export const fmt = (v) => `${Number(v || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const EMPTY_MODEL = {
  codice: "", modello: "", potenza_hp: 0, cilindrata_cc: 0, cilindri: "", alimentazione: "",
  peso_kg: 0, avviamento: "", gambo: "", trim: "", comandi: "", alternatore_A: 0,
  categoria: "", prezzo_listino: 0, prezzo_pubblico: 0, prezzo_offerta: 0,
  sconto_perc_1: 0, sconto_perc_2: 0, note: "",
};

export const EMPTY_PREV = {
  cliente_nome: "", cliente_telefono: "", cliente_email: "",
  modello_id: "", codice: "", modello: "", potenza_hp: 0, specifiche: "",
  cilindri: "", cilindrata_cc: 0, alimentazione: "", peso_kg: 0, avviamento: "",
  gambo: "", trim: "", comandi: "", alternatore_A: 0, carburante: "",
  prezzo_listino: 0, prezzo_acquisto_concessionario: 0,
  sconto_perc_1: 0, sconto_perc_2: 0, montaggio: 0, cavetteria: 0,
  note: "", stato: "bozza",
  data: new Date().toISOString().slice(0, 10),
};

export function Field({ label, children, className }) {
  return (
    <div className={className}>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
