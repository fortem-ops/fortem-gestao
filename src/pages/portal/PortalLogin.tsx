import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import fortemIcon from "@/assets/fortem-icon.png";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { userHasStaffAccess } from "@/lib/authAccess";
import { diagnoseNetwork, describeDiagnosis, type DiagnosisResult } from "@/lib/networkDiagnostics";
import { NetworkHelpPanel } from "@/components/NetworkHelpPanel";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [testing, setTesting] = useState(false);
  const { signIn, user, resetAuthState } = useAuth();
  const navigate = useNavigate();

  const runDiagnosis = async () => {
    setTesting(true);
    try {
      const d = await diagnoseNetwork();
      setDiagnosis(d);
      return d;
    } finally {
      setTesting(false);
    }
  };

  // Diagnóstico proativo ao abrir a tela de login.
  useEffect(() => {
    let cancelled = false;
    diagnoseNetwork().then((d) => {
      if (!cancelled && d.status !== "ok") setDiagnosis(d);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    userHasStaffAccess(user.id).then((isStaff) => {
      navigate(isStaff ? "/" : "/portal", { replace: true });
    });
  }, [navigate, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    if (error) {
      setLoading(false);
      const msg = error.message ?? "";
      const isNetwork = /fetch|network|timeout|aborted/i.test(msg);
      if (isNetwork) {
        const d = await runDiagnosis();
        const { title, description } = describeDiagnosis(d);
        toast.error(title, { description: description });
      } else {
        setDiagnosis(null);
        toast.error("Erro ao entrar", { description: "E-mail ou senha incorretos." });
      }
      return;
    }
    setDiagnosis(null);
  }

  async function handleResetSession() {
    setLoading(true);
    await resetAuthState();
    setLoading(false);
    toast.success("Sessão limpa", { description: "Tente entrar novamente com seu e-mail e senha." });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Card className="w-full max-w-md glass-card">
          <CardHeader className="text-center space-y-3 pb-2">
            <img src={fortemIcon} alt="Fortem" className="mx-auto w-14 h-14" />
            <div className="space-y-1">
              <img src={fortemWordmark} alt="Fortem" className="mx-auto h-5 dark:invert" />
              <p className="text-xs text-muted-foreground">Portal do Aluno</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <div className="text-right">
                <Link to="/portal/recuperar-senha" className="text-xs text-muted-foreground hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-2 text-muted-foreground">ou</span>
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full" asChild>
                <Link to="/portal/cadastro">Criar nova conta</Link>
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs" onClick={handleResetSession} disabled={loading}>
                Limpar sessão e tentar novamente
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Use o e-mail cadastrado pelo seu professor.
              </p>
              {diagnosis && diagnosis.status !== "ok" && (
                <NetworkHelpPanel diagnosis={diagnosis} onRetest={runDiagnosis} testing={testing} />
              )}
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
