import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBackdrop } from "@/components/portal/AuthBackdrop";
import { toast } from "sonner";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { userHasStaffAccess } from "@/lib/authAccess";
import { lovable } from "@/integrations/lovable/index";
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
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

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("Não foi possível iniciar o login com Google", { description: "Tente novamente ou use e-mail e senha." });
      return;
    }
    if (result.redirected) {
      // O navegador vai para o Google; a sessão chega pelo retorno.
      return;
    }
    // Sessão definida sem redirect: o useEffect acima navega para o destino.
    setGoogleLoading(false);
  }

  async function handleAppleSignIn() {
    setAppleLoading(true);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setAppleLoading(false);
      toast.error("Não foi possível iniciar o login com Apple", { description: "Tente novamente ou use e-mail e senha." });
      return;
    }
    if (result.redirected) {
      // O navegador vai para a Apple; a sessão chega pelo retorno.
      return;
    }
    // Sessão definida sem redirect: o useEffect acima navega para o destino.
    setAppleLoading(false);
  }

  async function handleMicrosoftSignIn() {
    setMicrosoftLoading(true);
    const result = await lovable.auth.signInWithOAuth("microsoft", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMicrosoftLoading(false);
      toast.error("Não foi possível iniciar o login com Microsoft", { description: "Tente novamente ou use e-mail e senha." });
      return;
    }
    if (result.redirected) {
      // O navegador vai para a Microsoft; a sessão chega pelo retorno.
      return;
    }
    // Sessão definida sem redirect: o useEffect acima navega para o destino.
    setMicrosoftLoading(false);
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

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="mb-6 flex min-h-[48px] w-full items-center justify-center gap-3 border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-[#F0F0F0] disabled:opacity-60"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.87-3c-1.07.72-2.44 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.27 14.28a7.19 7.19 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l3.99-3.1Z" />
              <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l3.99 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
            </svg>
            {googleLoading ? "Abrindo Google..." : "Entrar com Google"}
          </button>

          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={appleLoading}
            className="mb-6 flex min-h-[48px] w-full items-center justify-center gap-3 border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-[#F0F0F0] disabled:opacity-60"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M17.05 12.54c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.68-.39 6.65 1.11 8.83.74 1.07 1.62 2.27 2.78 2.23 1.12-.05 1.54-.72 2.89-.72 1.35 0 1.73.72 2.91.7 1.2-.02 1.96-1.09 2.7-2.16.84-1.23 1.19-2.42 1.21-2.48-.03-.01-2.33-.9-2.36-3.59ZM14.9 5.9c.61-.74 1.02-1.77.91-2.8-.88.04-1.95.59-2.58 1.32-.56.66-1.06 1.71-.93 2.72.98.08 1.99-.5 2.6-1.24Z" />
            </svg>
            {appleLoading ? "Abrindo Apple..." : "Entrar com Apple"}
          </button>

          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={microsoftLoading}
            className="mb-6 flex min-h-[48px] w-full items-center justify-center gap-3 border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-[#F0F0F0] disabled:opacity-60"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
              <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
              <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
              <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
              <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
            </svg>
            {microsoftLoading ? "Abrindo Microsoft..." : "Entrar com Microsoft"}
          </button>

          <div className="mb-6 space-y-1">
            <h1 className="text-[28px] font-black uppercase leading-none text-[#F0F0F0]">Entrar</h1>
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

            <Link
              to="/portal/cadastro"
              className="flex min-h-[48px] w-full items-center justify-center border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-[#F0F0F0]"
            >
              Primeiro acesso
            </Link>

            {loginFalhou && (
              <div role="alert" className="space-y-2 border border-[#4A4B4B] p-3">
                <p className="text-xs text-[#B1B3B3]">Não foi possível entrar. Confira e-mail e senha ou limpe a sessão e tente de novo.</p>
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={loading}
                  className="min-h-[44px] w-full border border-[#4A4B4B] text-xs font-bold uppercase tracking-[0.08em] text-[#F0F0F0]"
                >
                  Limpar sessão e tentar novamente
                </button>
              </div>
            )}

            {diagnosis && diagnosis.status !== "ok" && (
              <NetworkHelpPanel diagnosis={diagnosis} onRetest={runDiagnosis} testing={testing} />
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
