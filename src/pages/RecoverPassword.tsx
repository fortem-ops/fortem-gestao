import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import fortemIcon from "@/assets/fortem-icon.png";

export default function RecoverPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function callRecover(targetEmail: string) {
    // Tenta 2x com pequeno backoff — extensões/proxy do navegador podem
    // intermitentemente derrubar a 1ª chamada com "Failed to fetch".
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: `${window.location.origin}/redefinir-senha`,
        });
        if (!error) return { ok: true as const };
        lastErr = error;
        // erros de rede transitórios — tenta de novo
        if (!/fetch|network/i.test(error.message)) break;
      } catch (e: any) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return { ok: false as const, error: lastErr };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target) return;
    setLoading(true);
    const result = await callRecover(target);
    setLoading(false);
    if (!result.ok) {
      const msg = result.error?.message ?? "Erro desconhecido";
      const isNetwork = /fetch|network/i.test(msg);
      toast.error(isNetwork ? "Falha de conexão" : "Erro", { description: isNetwork
          ? "Não foi possível conectar. Desative extensões do navegador (ex: bloqueadores) ou tente em uma janela anônima."
          : msg });
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="text-center space-y-3 pb-2">
          <img src={fortemIcon} alt="Fortem" className="mx-auto w-14 h-14 object-contain" />
          <div className="space-y-1">
            <h1 className="font-heading font-bold text-lg">Recuperar senha</h1>
            <p className="text-xs text-muted-foreground">
              Enviaremos um link de redefinição para seu e-mail.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm">
                Se existir uma conta para <strong>{email}</strong>, você receberá um e-mail com o link.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link to="/login">Voltar para login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                <Link to="/login" className="text-primary hover:underline">
                  Voltar para login
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
