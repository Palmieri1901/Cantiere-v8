import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sailboat, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

function formatError(detail) {
  if (!detail) return "Errore imprevisto";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" · ");
  return String(detail);
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token") || "";
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (pw1.length < 6) { setErr("La password deve contenere almeno 6 caratteri"); return; }
    if (pw1 !== pw2) { setErr("Le due password non coincidono"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw1 });
      setDone(true);
      setTimeout(() => nav("/login", { replace: true }), 2500);
    } catch (e) {
      setErr(formatError(e.response?.data?.detail) || "Impossibile aggiornare la password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background grid place-items-center px-4" data-testid="reset-page">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-lg bg-primary text-primary-foreground grid place-items-center mb-4">
            <Sailboat className="w-8 h-8" strokeWidth={1.8} />
          </div>
          <div className="label-mini mb-1">Gestione Cantiere</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Portomare</h1>
        </div>

        <Card className="p-8">
          <h2 className="font-display text-2xl font-semibold mb-1">Nuova password</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Scegli una password di almeno 6 caratteri. Il link è utilizzabile una sola volta.
          </p>

          {!token && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm" data-testid="reset-no-token">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Link non valido: token mancante.</span>
            </div>
          )}

          {done ? (
            <div className="space-y-4" data-testid="reset-done">
              <div className="flex items-start gap-3 p-4 rounded-md bg-primary/5 border border-primary/20">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold text-foreground">Password aggiornata</div>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    Puoi ora accedere con la nuova password. Reindirizzamento in corso…
                  </p>
                </div>
              </div>
            </div>
          ) : token ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nuova password</Label>
                <Input
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  required
                  autoFocus
                  data-testid="input-reset-pw1"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ripeti la password</Label>
                <Input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                  data-testid="input-reset-pw2"
                />
              </div>

              {err && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm" data-testid="reset-error">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90" data-testid="btn-reset-submit">
                <KeyRound className="w-4 h-4 mr-2" />
                {loading ? "Aggiornamento…" : "Salva nuova password"}
              </Button>
            </form>
          ) : null}

          <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-4" data-testid="link-back-login-reset">
            <ArrowLeft className="w-3 h-3" />
            Torna al login
          </Link>
        </Card>
      </div>
    </div>
  );
}
