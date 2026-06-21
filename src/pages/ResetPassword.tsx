import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import fortemIcon from "@/assets/fortem-icon.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase processa automaticamente o token de recovery presente na URL.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Senha curta", { description: "Use pelo menos 8 caracteres." });
      return;
    }
    if (password !== confirm) {
      toast.error("Senhas não conferem");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast("Senha atualizada!");
    navigate("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="text-center space-y-3 pb-2">
          <img src={fortemIcon} alt="Fortem" className="mx-auto w-14 h-14 object-contain" />
          <h1 className="font-heading font-bold text-lg">Redefinir senha</h1>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <p className="text-sm text-center text-muted-foreground">Validando link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">Nova senha</Label>
                <Input
                  id="pwd"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
