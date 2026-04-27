import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Navigate } from "react-router-dom";
import { StatusJornadaCard } from "@/components/ponto/StatusJornadaCard";
import { BotaoInteligente } from "@/components/ponto/BotaoInteligente";
import { ResumoDoDia } from "@/components/ponto/ResumoDoDia";
import { HistoricoJornadas } from "@/components/ponto/HistoricoJornadas";
import type { PontoEstado, ProximaAcao } from "@/lib/ponto";

interface EstadoAtual {
  status: PontoEstado;
  proxima_acao: ProximaAcao;
  jornada_id: string | null;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  minutos_trabalhados: number | null;
}

/**
 * Tela principal do professor: bate ponto via botão único contextual,
 * acompanha resumo do dia e histórico recente.
 */
export default function Ponto() {
  const { user, loading } = useAuth();

  const { data: estado, isLoading } = useQuery({
    queryKey: ["ponto-estado", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_estado_atual", { _user_id: user!.id });
      if (error) throw error;
      return data as unknown as EstadoAtual;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Busca observação atual da jornada do dia
  const { data: jornadaHoje } = useQuery({
    queryKey: ["ponto-jornada-hoje", user?.id],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("ponto_jornadas")
        .select("observacao")
        .eq("usuario_id", user!.id)
        .eq("data", hoje)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (loading) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" /> Ponto
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre sua jornada com um clique. Os horários são gravados com data, hora e dispositivo.
        </p>
      </header>

      {isLoading || !estado ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <StatusJornadaCard
            status={estado.status}
            entrada={estado.entrada}
            intervaloInicio={estado.intervalo_inicio}
            intervaloFim={estado.intervalo_fim}
            saida={estado.saida}
          />

          <Card className="p-4">
            <BotaoInteligente proximaAcao={estado.proxima_acao} />
          </Card>

          <ResumoDoDia
            jornadaId={estado.jornada_id}
            entrada={estado.entrada}
            intervaloInicio={estado.intervalo_inicio}
            intervaloFim={estado.intervalo_fim}
            saida={estado.saida}
            minutosTrabalhados={estado.minutos_trabalhados}
            observacao={jornadaHoje?.observacao}
          />
        </>
      )}

      <HistoricoJornadas />
    </div>
  );
}
