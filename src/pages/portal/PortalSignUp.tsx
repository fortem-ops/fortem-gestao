import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthBackdrop } from "@/components/portal/AuthBackdrop";
import { toast } from "sonner";
import fortemWordmark from "@/assets/fortem-wordmark.png";
import { Seo } from "@/components/Seo";
import { z } from "zod";

const SENHA_MIN = 8;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido").max(255),
  password: z.string().min(SENHA_MIN, `A senha deve ter pelo menos ${SENHA_MIN} caracteres`).max(72),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "As senhas não são iguais.",
  path: ["confirmPassword"],
});

export default function PortalSignUp() {
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error("Verifique os dados", { description: parsed.error.errors[0].message });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar sua senha", { description: error.message });
      return;
    }

    // E-mail já possui conta: o backend responde com usuário sem identidades.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast.error("Este e-mail já tem acesso", {
        description: "Entre com sua senha ou use Esqueci minha senha.",
      });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      navigate("/portal");
      return;
    }

    setEnviado(true);
  }

  const rotulo = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
  const campo = "h-12 rounded-none border-[#4A4B4B] bg-transparent";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E0E0E] p-4" style={{ fontFamily: "Archivo, sans-serif" }}>
      <Seo
        title="Primeiro acesso — Portal do Aluno Fortem"
        description="Crie sua senha para acessar o Portal do Aluno Fortem pela primeira vez."
        path="/portal/cadastro"
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

          {enviado ? (
            <div className="space-y-6">
              <h1 className="text-[28px] font-black uppercase leading-none text-[#F0F0F0]">Verifique seu e-mail</h1>
              <p className="text-sm text-[#B1B3B3]">
                Enviamos um link de confirmação para o seu e-mail. Abra o link para concluir o acesso.
              </p>
              <Link
                to="/portal/login"
                className="flex min-h-[48px] w-full items-center justify-center border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-[#F0F0F0]"
              >
                Voltar para entrar
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-1">
                <h1 className="text-[28px] font-black uppercase leading-none text-[#F0F0F0]">Primeiro acesso</h1>
                <p className="text-sm text-[#B1B3B3]">
                  Use o mesmo e-mail que você informou à Fortem. Você vai criar sua senha e confirmar o e-mail.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className={rotulo}>E-mail</Label>
                  <Input id="email" type="email" autoComplete="email" className={campo} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={loading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className={rotulo}>Criar senha</Label>
                  <Input id="password" type="password" autoComplete="new-password" className={campo} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} disabled={loading} />
                  <p className="text-xs text-[#B1B3B3]">Mínimo de {SENHA_MIN} caracteres.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className={rotulo}>Confirmar senha</Label>
                  <Input id="confirmPassword" type="password" autoComplete="new-password" className={campo} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} disabled={loading} />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full bg-[#C8282A] text-[13px] font-bold uppercase tracking-[0.08em] text-white disabled:opacity-60"
                >
                  {loading ? "Enviando..." : "Criar minha senha"}
                </button>
                <Link
                  to="/portal/login"
                  className="flex min-h-[48px] w-full items-center justify-center border border-[#4A4B4B] text-[13px] font-bold uppercase tracking-[0.08em] text-[#F0F0F0]"
                >
                  Voltar para entrar
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
