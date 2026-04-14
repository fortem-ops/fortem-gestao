import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Utensils, Footprints, Calendar, DollarSign, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { StudentServicos } from "./StudentServicos";

function parseServiceCount(servicos: string[], tipoServico: string): number {
  for (const s of servicos) {
    const match = s.match(/^(\d+)\s+(.+)$/);
    if (match && match[2] === tipoServico) return parseInt(match[1]);
  }
  return 0;
}

function calcEndDate(startDate: string, durationMonths: number): string {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + durationMonths);
  return d.toLocaleDateString("pt-BR");
}

export function StudentPlan({ student }: { student: Tables<"alunos"> }) {
  const { data: isCoordAdmin = false } = useQuery({
    queryKey: ["is_coord_admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user.id });
      return !!data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["plano_ativo", student.id],
    queryFn: async () => {
      const { data: planos } = await supabase
        .from("planos")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!planos || planos.length === 0) return null;
      const plano = planos[0];

      const { data: consumos } = await supabase
        .from("consumo_servicos")
        .select("tipo_servico, quantidade, agenda_id")
        .eq("aluno_id", student.id)
        .eq("plano_id", plano.id);

      const servicos = plano.servicos || [];

      // Credits from plan base + purchased services (no agenda = sale/purchase)
      const countPurchased = (tipo: string) =>
        consumos?.filter((c) => c.tipo_servico === tipo && !c.agenda_id)
          .reduce((sum, c) => sum + ((c as any).quantidade ?? 1), 0) || 0;

      // Credits used = linked to agenda (scheduled/consumed)
      const countUsed = (tipo: string) =>
        consumos?.filter((c) => c.tipo_servico === tipo && !!c.agenda_id).length || 0;

      const buildCredit = (tipo: string) => ({
        base: parseServiceCount(servicos, tipo),
        comprado: countPurchased(tipo),
        total: parseServiceCount(servicos, tipo) + countPurchased(tipo),
        usado: countUsed(tipo),
      });

      return {
        ...plano,
        credits: {
          avalFuncional: buildCredit("Avaliação Funcional"),
          nutricao: buildCredit("Consultas Nutrição"),
          reabilitacao: buildCredit("Consultas Reabilitação"),
        },
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 mt-4">
        <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
        <div className="glass-card rounded-lg p-5">
          <p className="text-sm text-muted-foreground">Nenhum plano ativo encontrado para este aluno.</p>
        </div>
      </div>
    );
  }

  const serviceItems = [
    { label: "Avaliação Funcional", icon: Activity, ...data.credits.avalFuncional },
    { label: "Consultas Nutrição", icon: Utensils, ...data.credits.nutricao },
    { label: "Consultas Reabilitação", icon: Footprints, ...data.credits.reabilitacao },
  ].filter((s) => s.total > 0);

  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-heading font-semibold text-foreground">Plano Contratado</h3>
      <div className="glass-card rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className="text-sm px-3 py-1">{data.tipo}</Badge>
            <Badge variant="outline" className="status-active">Ativo</Badge>
          </div>
          {data.valor != null && data.valor > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span>R$ {Number(data.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Início</p>
              <p className="font-medium text-foreground">{new Date(data.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Término</p>
              <p className="font-medium text-foreground">{calcEndDate(data.data_inicio, data.duracao_meses)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Duração</p>
              <p className="font-medium text-foreground">{data.duracao_meses} {data.duracao_meses === 1 ? "mês" : "meses"}</p>
            </div>
          </div>
        </div>

        {serviceItems.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Créditos de Serviços</p>
            <div className="space-y-2">
              {serviceItems.map((s) => {
                const restante = s.total - s.usado;
                return (
                  <div key={s.label} className="flex items-center justify-between rounded-md border border-border/50 bg-muted/20 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <s.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {s.base > 0 && <span>Plano: {s.base}</span>}
                      {s.comprado > 0 && <span className="text-primary">+{s.comprado} comprado{s.comprado !== 1 ? "s" : ""}</span>}
                      <span className="text-sm font-medium text-foreground">{s.usado}/{s.total} usados</span>
                      <Badge variant="outline" className={`text-xs ${restante > 0 ? "status-active" : "status-urgent"}`}>
                        {restante > 0 ? `${restante} disponível${restante !== 1 ? "eis" : ""}` : "Esgotado"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Créditos são consumidos ao agendar o serviço na agenda.</p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Editável apenas por Coordenação e Administração</p>

      <StudentServicos student={student} isCoordAdmin={isCoordAdmin} />
    </div>
  );
}
