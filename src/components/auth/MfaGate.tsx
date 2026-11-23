import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { carregarMfaEstado, decidirMfa } from "@/lib/mfa";
import { MfaCadastro } from "./MfaCadastro";
import { MfaDesafio } from "./MfaDesafio";

/** Barra a equipe até a sessão estar em aal2. Aluno nunca chega aqui (só rotas requireStaff). */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["mfa-estado", user?.id],
    queryFn: carregarMfaEstado,
    enabled: !!user,
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    if (isError) {
      return (
        <Tela titulo="Não foi possível verificar o 2FA" onSair={signOut}>
          <Button className="w-full" onClick={() => refetch()}>Tentar novamente</Button>
        </Tela>
      );
    }
    return <div className="min-h-screen bg-background" />;
  }

  const destino = decidirMfa({ isStaff: true, currentLevel: data.currentLevel, fatoresVerificados: data.fatores.length });
  if (destino === "liberado") return <>{children}</>;

  const concluir = () => { void qc.invalidateQueries({ queryKey: ["mfa-estado"] }); };

  return destino === "cadastro" ? (
    <Tela titulo="Ativar verificação em duas etapas" subtitulo="Obrigatório para a equipe Fortem. Leva menos de um minuto." onSair={signOut}>
      <MfaCadastro nomeAparelho="Principal" onConcluido={concluir} />
    </Tela>
  ) : (
    <Tela titulo="Verificação em duas etapas" subtitulo={user?.email ?? undefined} onSair={signOut}>
      <MfaDesafio fatores={data.fatores} onConcluido={concluir} />
    </Tela>
  );
}

function Tela({ titulo, subtitulo, onSair, children }: { titulo: string; subtitulo?: string; onSair: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">{titulo}</h1>
          {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        {children}
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSair}>Sair</Button>
      </div>
    </div>
  );
}
