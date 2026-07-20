import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !senha) {
      toast.error("Preencha email e senha");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("fn_parceiro_login", {
        p_email: email,
        p_senha: senha,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.ok) throw new Error(result?.erro || "Falha no login");

      sessionStorage.setItem(
        "parceiro_session",
        JSON.stringify({
          parceiro_id: result.parceiro_id,
          nome: result.nome,
          categoria: result.categoria,
          modo_validacao: result.modo_validacao,
        }),
      );

      toast.success(`Bem-vindo, ${result.nome}!`);
      navigate("/parceiro");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#141414] flex items-center justify-center p-6"
      style={{ fontFamily: "Manrope,sans-serif" }}
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <span
              className="text-3xl font-black text-primary"
              style={{ fontFamily: "Archivo,sans-serif" }}
            >
              F
            </span>
          </div>
          <h1
            className="text-2xl font-black text-white"
            style={{ fontFamily: "Archivo,sans-serif" }}
          >
            Clube FORTEM
          </h1>
          <p className="text-sm text-[#8A8A8A]">Portal do Parceiro</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide block mb-1.5">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-wide block mb-1.5">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              className="w-full bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#555] focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ fontFamily: "Archivo,sans-serif" }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
          </button>
        </div>

        <p className="text-center text-xs text-[#555]">
          Problemas de acesso? Entre em contato com a FORTEM.
        </p>
      </div>
    </div>
  );
}
