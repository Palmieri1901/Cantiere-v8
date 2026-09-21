export { fmt, Field } from "@/pages/suzuki/common";

export const EMPTY_DEST = { nome: "", indirizzo: "", cap: "", citta: "", provincia: "", telefono: "" };

export const EMPTY_INDIRIZZO = { ...EMPTY_DEST, codice_cliente: "", note: "" };

export const EMPTY_DDT = {
  numero: "", anno: new Date().getFullYear(), data: new Date().toISOString().slice(0, 10),
  codice_cliente: "", rif_ordine: "", condizioni_pagamento: "",
  cessionario: { ...EMPTY_DEST }, destinazione_idem: true, destinazione: { ...EMPTY_DEST },
  righe: [{ quantita: 1, descrizione: "", prezzo_unitario: 0 }],
  causale: "RIPARAZIONE", porto: "franco", colli: 1, peso: "", data_ora_trasporto: "",
  vettore: "", aspetto_beni: "a vista", note: "", note_destinazione: "",
};

export const destToText = (d) => [d?.nome, d?.indirizzo, [d?.cap, d?.citta, d?.provincia && `(${d.provincia})`].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

export const ddtPayload = (f) => ({
  ...f,
  numero: f.numero === "" || f.numero == null ? null : Number(f.numero),
  anno: Number(f.anno) || new Date().getFullYear(),
  colli: Math.round(Number(f.colli) || 0),
  righe: (f.righe || []).filter((r) => (r.descrizione || "").trim()).map((r) => ({ quantita: Number(r.quantita) || 0, descrizione: r.descrizione, prezzo_unitario: Number(r.prezzo_unitario) || 0 })),
});

export const openBlob = async (api, method, url, body, setUrl, setOpen) => {
  const res = method === "post" ? await api.post(url, body, { responseType: "blob" }) : await api.get(url, { responseType: "blob" });
  const u = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  setUrl((old) => { if (old) URL.revokeObjectURL(old); return u; });
  setOpen(true);
};
