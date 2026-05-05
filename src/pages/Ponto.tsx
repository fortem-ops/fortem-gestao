import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Clock, Eye } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusJornadaCard } from "@/components/ponto/StatusJornadaCard";
import { BotaoInteligente } from "@/components/ponto/BotaoInteligente";
import { ResumoDoDia, type EventoPonto } from "@/components/ponto/ResumoDoDia";
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

export default function Ponto() {
  const { user, loading } = useAuth();
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["ponto-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: profissionais } = useQuery({
    queryKey: ["ponto-profissionais"],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids)
        .order("full_name");
      return profs ?? [];
    },
  });

  const targetId = (isCoordAdmin && viewAsUserId) ? viewAsUserId : user?.id;
  const isViewingOther = !!viewAsUserId && viewAsUserId !== user?.id;

  const { data: estado, isLoading } = useQuery({
    queryKey: ["ponto-estado", targetId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_ponto_estado_atual", { _user_id: targetId! });
      if (error) throw error;
      return data as unknown as EstadoAtual;
    },
    enabled: !!targetId,
    refetchInterval: 60_000,
  });

  const { data: jornadaHoje } = useQuery({
    queryKey: ["ponto-jornada-hoje", targetId],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("ponto_jornadas")
        .select("observacao")
        .eq("usuario_id", targetId!)
        .eq("data", hoje)
        .maybeSingle();
      return data;
    },
    enabled: !!targetId,
  });

  const { data: eventosDia } = useQuery({
    queryKey: ["ponto-eventos-dia", targetId, estado?.jornada_id],
    enabled: !!targetId && !!estado?.jornada_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_eventos")
        .select("tipo, data_hora, latitude, longitude, dispositivo")
        .eq("usuario_id", targetId!)
        .eq("jornada_id", estado!.jornada_id!)
        .order("data_hora", { ascending: true });
      return (data ?? []) as EventoPonto[];
    },
  });

  // Jornada prevista do dia (Admin Ponto → ponto_horarios_professor)
  const dowHoje = new Date().getDay();
  const { data: horarioHoje } = useQuery({
    queryKey: ["ponto-horario-dia", targetId, dowHoje],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_horarios_professor")
        .select("horario_inicio, horario_fim, intervalo_min, ativo")
        .eq("usuario_id", targetId!)
        .eq("dia_semana", dowHoje)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
  });

  // Fallback: configuração global de carga diária
  const { data: cargaMin } = useQuery({
    queryKey: ["ponto-config-carga", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data: own } = await supabase
        .from("ponto_configuracoes")
        .select("carga_diaria_min")
        .eq("usuario_id", targetId!)
        .maybeSingle();
      if (own?.carga_diaria_min != null) return own.carga_diaria_min;
      const { data: global } = await supabase
        .from("ponto_configuracoes")
        .select("carga_diaria_min")
        .is("usuario_id", null)
        .maybeSingle();
      return global?.carga_diaria_min ?? 480;
    },
  });

  if (loading) return <Skeleton className="h-64" />;
  if (!user) return <Navigate to="/login" replace />;

  const pularIntervalo = (cargaMin ?? 480) <= 240;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" /> Ponto
            {isViewingOther && (
              <Badge variant="outline" className="gap-1 text-info border-info/30 bg-info/10">
                <Eye className="w-3 h-3" /> Visualização
              </Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isViewingOther
              ? "Você está visualizando o ponto de outro profissional. Apenas leitura."
              : "Registre sua jornada com um clique. Os horários são gravados com data, hora e dispositivo."}
          </p>
        </div>

        {isCoordAdmin && (
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Visualizar como</label>
              <Select
                value={viewAsUserId ?? user.id}
                onValueChange={(v) => setViewAsUserId(v === user.id ? null : v)}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecionar profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={user.id}>Meu perfil</SelectItem>
                  {(profissionais ?? [])
                    .filter((p) => p.user_id !== user.id)
                    .map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {isViewingOther && (
              <Button variant="ghost" size="sm" onClick={() => setViewAsUserId(null)}>
                Voltar
              </Button>
            )}
          </div>
        )}
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

          {!isViewingOther && (
            <Card className="p-4">
              <BotaoInteligente proximaAcao={estado.proxima_acao} pularIntervalo={pularIntervalo} />
            </Card>
          )}

          <ResumoDoDia
            jornadaId={estado.jornada_id}
            entrada={estado.entrada}
            intervaloInicio={estado.intervalo_inicio}
            intervaloFim={estado.intervalo_fim}
            saida={estado.saida}
            minutosTrabalhados={estado.minutos_trabalhados}
            observacao={jornadaHoje?.observacao}
            eventos={eventosDia}
            readOnly={isViewingOther}
            usuarioAlvoId={targetId!}
          />
        </>
      )}

      <HistoricoJornadas userId={targetId!} />
    </div>
  );
}
