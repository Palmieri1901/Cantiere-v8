import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sailboat, Mail, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";

function formatError(detail) {
  if (!detail) return "Errore imprevisto";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" · ");
  return String(detail);
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (e) {
      setErr(formatError(e.response?.data?.detail) || "Impossibile inviare la richiesta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/40 to-background grid place-items-center px-4" data-testid="forgot-page">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-lg bg-primary text-primary-foreground grid place-items-center mb-4">
            <Sailboat className="w-8 h-8" strokeWidth={1.8} />
          </div>
          <div className="label-mini mb-1">Gestione Cantiere</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Portomare</h1>
        </div>

        <Card className="p-8">
          <h2 className="font-display text-2xl font-semibold mb-1">Password dimenticata</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Inserisci l'email dell'account. Il link di recupero verrà inviato
            all'indirizzo di ripristino del cantiere.
          </p>

          {sent ? (
            <div className="space-y-4" data-testid="forgot-sent">
              <div className="flex items-start gap-3 p-4 rounded-md bg-primary/5 border border-primary/20">
                <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold text-foreground">Richiesta inviata</div>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    Se l'account esiste, un link di recupero è stato spedito all'indirizzo
                    email di ripristino registrato dal cantiere. Il link è valido per 1 ora.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full" data-testid="btn-back-login">
                <Link to="/login">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Torna al login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email account</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@portomare.it"
                  required
                  autoFocus
                  data-testid="input-forgot-email"
                />
              </div>

              {err && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm" data-testid="forgot-error">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{err}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90" data-testid="btn-forgot-submit">
                <Mail className="w-4 h-4 mr-2" />
                {loading ? "Invio…" : "Invia link di recupero"}
              </Button>

              <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 pt-2" data-testid="link-back-login">
                <ArrowLeft className="w-3 h-3" />
                Torna al login
              </Link>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Portomare · Gestionale Cantiere Nautico
        </p>
      </div>
    </div>
  );
}
