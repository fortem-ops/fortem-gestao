import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock, Coffee, X, ArrowRight } from "lucide-react";
import type { PontoEstado } from "@/lib/ponto";

interface EstadoAtual {
  status: PontoEstado;
  entrada: string | null;
  intervalo_inicio: string | null;
}

const DISMISS_KEY = "lembrete-ponto-dismiss";
const DISMISS_MS = 2 * 60 * 60 * 1000; // 2h

/**
 * Banner contextual no Dashboard que lembra o profissional de bater o ponto.
 * Aparece quando a jornada ainda não foi iniciada ou quando está em intervalo.
 */
export function LembretePontoBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) setDismissedAt(Number(raw) || null);
  }, []);

  // Não mostrar para coord/admin (eles têm o dashboard de equipe)
  const { data: isCoordAdmin } = useQuery({
    queryKey: ["lembrete-ponto-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: estado } = useQuery({
    queryKey: ["lembrete-ponto-estado", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("fn_ponto_estado_atual", { _user_id: user!.id });
      return data as unknown as EstadoAtual;
    },
    enabled: !!user,
    refetchInterval: 2 * 60_000,
  });

  const dowHoje = new Date().getDay();
  const { data: horarioHoje } = useQuery({
    queryKey: ["lembrete-ponto-horario", user?.id, dowHoje],
    enabled: !!user && estado?.status === "nao_iniciado",
    queryFn: async () => {
      const { data } = await supabase
        .from("ponto_horarios_professor")
        .select("horario_inicio, horario_fim")
        .eq("usuario_id", user!.id)
        .eq("dia_semana", dowHoje)
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
  });

  if (!user || !estado) return null;

  const status = estado.status;
  const shouldShow = status === "nao_iniciado" || status === "em_intervalo";
  if (!shouldShow) return null;

  // Dismiss válido apenas para o mesmo status
  if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    localStorage.setItem(DISMISS_KEY, String(now));
    setDismissedAt(now);
  };

  const handleClick = () => navigate("/ponto");

  if (status === "em_intervalo") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="w-full text-left animate-fade-in flex items-center gap-3 rounded-lg border border-info/30 bg-info/10 hover:bg-info/15 transition-colors px-4 py-3 shadow-sm"
      >
        <div className="w-10 h-10 rounded-full bg-info/20 flex items-center justify-center shrink-0">
          <Coffee className="w-5 h-5 text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Você está em intervalo</p>
          <p className="text-xs text-muted-foreground">Lembre-se de bater o retorno quando voltar.</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 border-info/40 text-info hover:bg-info/20 hover:text-info">
          Encerrar intervalo <ArrowRight className="w-3.5 h-3.5" />
        </Button>
        <span
          role="button"
          tabIndex={0}
          onClick={handleDismiss}
          onKeyDown={(e) => { if (e.key === "Enter") handleDismiss(e as any); }}
          className="p-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground"
          aria-label="Dispensar lembrete"
        >
          <X className="w-4 h-4" />
        </span>
      </button>
    );
  }

  // nao_iniciado
  const janela = horarioHoje
    ? `${horarioHoje.horario_inicio.slice(0, 5)} – ${horarioHoje.horario_fim.slice(0, 5)}`
    : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left animate-fade-in flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 hover:bg-warning/15 transition-colors px-4 py-3 shadow-sm"
    >
      <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
        <Clock className="w-5 h-5 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Você ainda não bateu o ponto hoje</p>
        <p className="text-xs text-muted-foreground">
          {janela ? <>Jornada prevista: <span className="font-medium text-foreground">{janela}</span></> : "Registre sua entrada para iniciar a jornada."}
        </p>
      </div>
      <Button size="sm" className="gap-1">
        Bater ponto <ArrowRight className="w-3.5 h-3.5" />
      </Button>
      <span
        role="button"
        tabIndex={0}
        onClick={handleDismiss}
        onKeyDown={(e) => { if (e.key === "Enter") handleDismiss(e as any); }}
        className="p-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground"
        aria-label="Dispensar lembrete"
      >
        <X className="w-4 h-4" />
      </span>
    </button>
  );
}
