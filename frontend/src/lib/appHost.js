// Host dedicato all'app dipendenti (es. lavori.genbnautica.it): mostra SOLO l'app, nulla del gestionale.
export const isAppDipendentiHost = () => {
  const h = window.location.hostname.toLowerCase();
  const cfg = (process.env.REACT_APP_APP_DIPENDENTI_HOST || "").toLowerCase();
  return (cfg && h === cfg) || h.startsWith("lavori.");
};

export const appDipendentiUrl = () =>
  process.env.REACT_APP_APP_DIPENDENTI_HOST
    ? `https://${process.env.REACT_APP_APP_DIPENDENTI_HOST}`
    : `${window.location.origin}/app-dipendente`;
