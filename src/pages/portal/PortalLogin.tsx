import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBackdrop } from "@/components/portal/AuthBackdrop";
import { toast } from "sonner";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { userHasStaffAccess } from "@/lib/authAccess";
import { diagnoseNetwork, describeDiagnosis, type DiagnosisResult } from "@/lib/networkDiagnostics";
import { NetworkHelpPanel } from "@/components/NetworkHelpPanel";
import { Seo } from "@/components/Seo";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [loginFalhou, setLoginFalhou] = useState(false);
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
      setLoginFalhou(true);
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
    setLoginFalhou(false);
    setDiagnosis(null);
  }

  async function handleResetSession() {
    setLoading(true);
    await resetAuthState();
    setLoading(false);
    toast.success("Sessão limpa", { description: "Tente entrar novamente com seu e-mail e senha." });
  }

  const rotulo = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
  const campo = "h-12 rounded-none border-[#4A4B4B] bg-transparent";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E0E0E] p-4" style={{ fontFamily: "Archivo, sans-serif" }}>
      <Seo
        title="Portal do Aluno — Fortem - Treinamento"
        description="Entre no Portal do Aluno Fortem para ver seus treinos, avaliações, agenda de aulas, contratos e pagamentos."
        path="/portal/login"
      />
      <AuthBackdrop />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-md flex-col justify-center gap-8">
        <div className="space-y-3 text-center">
          <img src={fortemWordmark} alt="Fortem" className="mx-auto h-6 invert" />
          <p className={rotulo}>Portal do aluno</p>
        </div>

        <div
          className="relative border border-[#4A4B4B] p-6"
          style={{ background: "rgba(20,20,20,.78)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        >
          <span aria-hidden className="absolute -right-px -top-px h-6 w-6 border-r-2 border-t-2 border-[#E73C3E]" />
          <span aria-hidden className="absolute -bottom-px -left-px h-6 w-6 border-b-2 border-l-2 border-[#E73C3E]" />

          {/* Espaço reservado para o futuro "Entrar com Google" */}
          <div data-slot="login-social" />

          <div className="mb-6 space-y-1">
            <h1 className="text-[28px] font-black uppercase leading-none text-foreground">Entrar</h1>
            <p className="text-sm text-[#B1B3B3]">Use o e-mail cadastrado no estúdio.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={rotulo}>E-mail</Label>
              <Input id="email" type="email" autoComplete="email" className={campo} value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className={rotulo}>Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" className={campo} value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            <div className="flex justify-end">
              <Link to="/portal/recuperar-senha" className="flex min-h-[44px] items-center text-xs text-[#B1B3B3] hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-[#C8282A] text-[13px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {loginFalhou && (
              <div role="alert" className="space-y-2 border border-[#4A4B4B] p-3">
                <p className="text-xs text-[#B1B3B3]">Não foi possível entrar. Confira e-mail e senha ou limpe a sessão e tente de novo.</p>
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={loading}
                  className="min-h-[44px] w-full border border-[#4A4B4B] text-xs font-bold uppercase tracking-[0.08em] text-foreground"
                >
                  Limpar sessão e tentar novamente
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-[#4A4B4B]" />
              <span className="text-xs text-[#B1B3B3]">ou</span>
              <span className="h-px flex-1 bg-[#4A4B4B]" />
            </div>
            <Link
              to="/portal/cadastro"
              className="flex min-h-[48px] w-full items-center justify-center border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-foreground"
            >
              Criar conta
            </Link>
            {diagnosis && diagnosis.status !== "ok" && (
              <NetworkHelpPanel diagnosis={diagnosis} onRetest={runDiagnosis} testing={testing} />
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
