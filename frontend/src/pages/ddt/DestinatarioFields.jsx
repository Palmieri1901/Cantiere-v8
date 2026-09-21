import { Input } from "@/components/ui/input";
import { Field } from "./common";

export default function DestinatarioFields({ value, onChange, prefix, disabled }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <div className="col-span-2 md:col-span-3"><Field label="Nome / Ragione sociale"><Input disabled={disabled} value={value.nome || ""} onChange={(e) => set("nome", e.target.value)} data-testid={`${prefix}-nome`} /></Field></div>
      <div className="col-span-2 md:col-span-3"><Field label="Indirizzo"><Input disabled={disabled} value={value.indirizzo || ""} onChange={(e) => set("indirizzo", e.target.value)} data-testid={`${prefix}-indirizzo`} /></Field></div>
      <Field label="CAP"><Input disabled={disabled} value={value.cap || ""} onChange={(e) => set("cap", e.target.value)} data-testid={`${prefix}-cap`} /></Field>
      <div className="col-span-2"><Field label="Città"><Input disabled={disabled} value={value.citta || ""} onChange={(e) => set("citta", e.target.value)} data-testid={`${prefix}-citta`} /></Field></div>
      <Field label="Prov."><Input disabled={disabled} value={value.provincia || ""} onChange={(e) => set("provincia", e.target.value)} maxLength={2} data-testid={`${prefix}-prov`} /></Field>
      <div className="col-span-2"><Field label="Telefono"><Input disabled={disabled} value={value.telefono || ""} onChange={(e) => set("telefono", e.target.value)} data-testid={`${prefix}-tel`} /></Field></div>
    </div>
  );
}
