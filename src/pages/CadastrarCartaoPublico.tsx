import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import fortemLogoRed from "@/assets/fortem-logo-red.png";
import { CartaoForm } from "@/components/pagamentos/CadastrarCartaoDialog";

interface LinkInfo {
  aluno_id: string;
  aluno_nome: string;
  expires_at: string;
}

export default function CadastrarCartaoPublico() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "ok" | "invalid" | "expired" | "used" | "success">("loading");
  const [info, setInfo] = useState<LinkInfo | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setStatus("invalid"); return; }
      const { data: link } = await (supabase as any)
        .from("links_cartao")
        .select("aluno_id, usado, expires_at, alunos:alunos(nome)")
        .eq("token", token)
        .maybeSingle();

      if (!link) { setStatus("invalid"); return; }
      if (link.usado) { setStatus("used"); return; }
      if (new Date(link.expires_at).getTime() < Date.now()) { setStatus("expired"); return; }

      setInfo({
        aluno_id: link.aluno_id,
        aluno_nome: link.alunos?.nome ?? "",
        expires_at: link.expires_at,
      });
      setStatus("ok");
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <img src={fortemLogoRed} alt="FORTEM" className="h-7" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Ambiente seguro
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">

          {status === "loading" && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Validando link...</p>
            </div>
          )}

          {(status === "invalid" || status === "expired" || status === "used") && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <h1 className="text-lg font-bold text-foreground">
                {status === "invalid" && "Link inválido"}
                {status === "expired" && "Link expirado"}
                {status === "used" && "Link já utilizado"}
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                {status === "invalid" && "Este link de cadastro não é válido."}
                {status === "expired" && "O prazo para cadastro deste cartão expirou. Solicite um novo link à equipe FORTEM."}
                {status === "used" && "Este link já foi usado para cadastrar um cartão."}
              </p>
            </div>
          )}

          {status === "ok" && info && (
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div>
                <h1 className="text-xl font-black text-foreground">Cadastro de cartão</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Olá, <strong className="text-foreground">{info.aluno_nome}</strong>! Preencha os
                  dados do seu cartão para concluir o cadastro.
                </p>
              </div>
              <CartaoForm
                alunoId={info.aluno_id}
                alunoNome={info.aluno_nome}
                origem="link_cadastro"
                token={token}
                onSuccess={() => setStatus("success")}
              />
            </div>
          )}

          {status === "success" && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h1 className="text-xl font-black text-foreground">Cartão cadastrado!</h1>
              <p className="text-sm text-muted-foreground mt-2">
                Seu cartão foi salvo com segurança. Você já pode fechar esta página.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border bg-card">
        <p className="text-center text-[10px] text-muted-foreground py-3">
          FORTEM · Processamento seguro via Rede
        </p>
      </footer>
    </div>
  );
}
