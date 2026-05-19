import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, Utensils, Footprints, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AddStudentDialog from "@/components/student/AddStudentDialog";
import { StudentListFilters, defaultFilters, type StudentFilters } from "@/components/student/StudentListFilters";
import { addMonths, format, isAfter, isBefore, startOfDay } from "date-fns";
import { getDisplayStatus } from "@/lib/studentStatus";
import type { AlunoLicenca } from "@/lib/licencas";
import { useDebounce } from "@/hooks/useDebounce";
import { fetchLastFuncionalDateBatch, severityForLastFuncional } from "@/lib/avaliacaoFuncional";

const ALUNOS_COLUMNS =
  "id, nome, email, telefone, status, frequencia_semanal, responsavel_id, foto_url, user_id, current_pipeline_stage_id";

function parseServiceCount(servicos: string[] | null, tipoServico: string): number {
  if (!servicos) return 0;
  for (const s of servicos) {
    const match = s.match(/^(\d+)\s+(.+)$/);
    if (match && match[2] === tipoServico) return parseInt(match[1]);
  }
  return 0;
}

interface CreditAgg {
  total: number;
  usado: number;
  ilimitado: boolean;
}
interface ServiceCredits {
  plano: Record<string, CreditAgg>;
  servico: Record<string, CreditAgg>;
}

function emptyCredits(): ServiceCredits {
  return { plano: {}, servico: {} };
}

function sumByAtividade(map: Record<string, CreditAgg>) {
  let total = 0, usado = 0, ilimitado = false;
  for (const k of Object.keys(map)) {
    total += map[k].total;
    usado += map[k].usado;
    if (map[k].ilimitado) ilimitado = true;
  }
  return { total, usado, ilimitado };
}

export default function StudentList({ mode = "ativos" }: { mode?: "ativos" | "inativos" } = {}) {
  const [filters, setFilters] = useState<StudentFilters>(defaultFilters);
  const navigate = useNavigate();
  const isInativos = mode === "inativos";
  const pageTitle = isInativos ? "Alunos Inativos" : "Alunos Ativos";

  const { data: profiles = [] } = useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const { professors, profileMap } = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => { map[p.user_id] = p.full_name; });
    return {
      professors: profiles.map((p) => ({ id: p.user_id, name: p.full_name })),
      profileMap: map,
    };
  }, [profiles]);

  const { data: alunos = [], isLoading, refetch } = useQuery({
    queryKey: ["alunos_with_plans"],
    queryFn: async () => {
      const { data: students, error } = await supabase
        .from("alunos")
        .select(ALUNOS_COLUMNS)
        .order("nome");
      if (error) throw error;

      const ids = students.map((s) => s.id);
      const { data: planos } = await supabase
        .from("planos")
        .select("id, aluno_id, tipo, data_inicio, data_fim, duracao_meses, ativo, servicos")
        .in("aluno_id", ids)
        .eq("ativo", true);
      const planoIds = (planos || []).map((p: any) => p.id);
      const { data: consumos } = planoIds.length
        ? await supabase
            .from("consumo_servicos")
            .select("aluno_id, plano_id, tipo_servico, tipo_registro, quantidade, agenda_id")
            .in("plano_id", planoIds)
        : { data: [] as any[] };
      const { data: creditos } = await supabase
        .from("creditos_aluno" as any)
        .select("aluno_id, origem_tipo, atividade, quantidade_inicial, quantidade_usada, ilimitado")
        .in("aluno_id", ids)
        .eq("ativo", true);
      const { data: licencas } = await supabase
        .from("aluno_licencas" as any)
        .select("aluno_id, tipo, data_inicio, data_fim, dias, motivo")
        .in("aluno_id", ids);
      const licencasMap: Record<string, AlunoLicenca[]> = {};
      ((licencas as unknown as AlunoLicenca[]) || []).forEach((l) => {
        (licencasMap[l.aluno_id] ||= []).push(l);
      });

      const creditsMap: Record<string, ServiceCredits> = {};
      const planEndMap: Record<string, Date | null> = {};
      const planTipoMap: Record<string, string | null> = {};

      const PLAN_SERVICES = ["Avaliação Funcional", "Consultas Nutrição", "Consultas Reabilitação"];

      for (const student of students) {
        const plano: any = planos?.find((p) => p.aluno_id === student.id);
        if (plano) {
          planEndMap[student.id] = plano.data_fim
            ? new Date(plano.data_fim + "T00:00:00")
            : addMonths(new Date(plano.data_inicio), plano.duracao_meses);
          planTipoMap[student.id] = plano.tipo || null;
        } else {
          planEndMap[student.id] = null;
          planTipoMap[student.id] = null;
        }
        creditsMap[student.id] = emptyCredits();

        // Serviços do Plano: derivados de planos.servicos + consumo_servicos do plano ativo
        if (plano) {
          const planoConsumos = (consumos as any[] || []).filter((c) => c.plano_id === plano.id);
          for (const label of PLAN_SERVICES) {
            const base = parseServiceCount(plano.servicos || [], label);
            const comprado = planoConsumos
              .filter((c) => c.tipo_servico === label && c.tipo_registro === "compra")
              .reduce((s, c) => s + (c.quantidade ?? 1), 0);
            const usado = planoConsumos
              .filter((c) => c.tipo_servico === label && (!!c.agenda_id || c.tipo_registro === "uso_manual"))
              .length;
            const total = base + comprado;
            if (total > 0) {
              creditsMap[student.id].plano[label] = { total, usado, ilimitado: false };
            }
          }
        }
      }

      // Serviços Contratados: continuam vindo de creditos_aluno (origem_tipo='servico')
      ((creditos as any[]) || []).forEach((c) => {
        if (c.origem_tipo !== "servico") return;
        const bucket = creditsMap[c.aluno_id];
        if (!bucket) return;
        const cur = bucket.servico[c.atividade] || { total: 0, usado: 0, ilimitado: false };
        cur.total += c.quantidade_inicial ?? 0;
        cur.usado += c.quantidade_usada ?? 0;
        if (c.ilimitado) cur.ilimitado = true;
        bucket.servico[c.atividade] = cur;
      });

      return students.map((s) => ({ ...s, credits: creditsMap[s.id], planEnd: planEndMap[s.id], planTipo: planTipoMap[s.id], licencas: licencasMap[s.id] || [] }));
    },
  });


  const debouncedSearch = useDebounce(filters.search, 250);

  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase();
    return alunos.filter((s) => {
      const c = s.credits;
      const matchSearch = (s.nome ?? "").toLowerCase().includes(term) ||
        (s.email?.toLowerCase().includes(term) ?? false);
      const display = getDisplayStatus(s.status, s.planEnd, s.licencas, s.planTipo);
      const matchMode = isInativos
        ? display.key === "encerrado"
        : display.key === "ativo" || display.key === "licenca";
      if (!matchMode) return false;
      const matchStatus = filters.status === "todos" || display.key === filters.status;

      const matchFreq = filters.frequencia === "todos" ||
        (filters.frequencia === "livre" ? s.frequencia_semanal === 0 : s.frequencia_semanal === parseInt(filters.frequencia));

      const hasBase = c && Object.keys(c.plano).length > 0;
      const matchSP = filters.servicosPlano === "todos" ||
        (filters.servicosPlano === "com" ? hasBase : !hasBase);

      const hasPurch = c && Object.keys(c.servico).length > 0;
      const matchSC = filters.servicosContratados === "todos" ||
        (filters.servicosContratados === "com" ? hasPurch : !hasPurch);

      const matchProf = filters.professor === "todos" || s.responsavel_id === filters.professor;

      let matchDate = true;
      if (filters.dataFinalDe && s.planEnd) {
        matchDate = matchDate && !isBefore(s.planEnd, startOfDay(filters.dataFinalDe));
      }
      if (filters.dataFinalAte && s.planEnd) {
        matchDate = matchDate && !isAfter(s.planEnd, startOfDay(filters.dataFinalAte));
      }
      if ((filters.dataFinalDe || filters.dataFinalAte) && !s.planEnd) {
        matchDate = false;
      }

      return matchSearch && matchStatus && matchFreq && matchSP && matchSC && matchProf && matchDate;
    });
  }, [alunos, debouncedSearch, filters.status, filters.frequencia, filters.servicosPlano, filters.servicosContratados, filters.professor, filters.dataFinalDe, filters.dataFinalAte, isInativos]);


  const iconForAtividade = (atividade: string) => {
    const a = atividade.toLowerCase();
    if (a.includes("nutri")) return Utensils;
    if (a.includes("reab") || a.includes("fisio")) return Footprints;
    return Activity;
  };

  const CreditsCell = ({ map, originLabel }: { map: Record<string, CreditAgg>; originLabel: string }) => {
    const entries = Object.entries(map);
    if (entries.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {entries.map(([atividade, agg]) => {
          const Icon = iconForAtividade(atividade);
          const restante = agg.ilimitado ? Infinity : agg.total - agg.usado;
          const color = restante > 0 ? "text-primary" : "text-destructive";
          const label = `${atividade} (${originLabel})`;
          const display = agg.ilimitado ? "∞" : `${agg.usado}/${agg.total}`;
          return (
            <Tooltip key={atividade}>
              <TooltipTrigger asChild>
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
                  <Icon className="h-3 w-3" />
                  {display}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}: {agg.ilimitado ? "ilimitado" : `${agg.usado} de ${agg.total} utilizado${agg.usado !== 1 ? "s" : ""}`}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  };

  const queryClient = useQueryClient();
  const [recalculando, setRecalculando] = useState(false);

  async function recalcularStatus() {
    setRecalculando(true);
    try {
      const { data, error } = await supabase.rpc("fn_detect_evasao" as any);
      if (error) throw error;
      const r = (data || {}) as any;
      toast.success(
        `Recálculo concluído: ${r.movidos_para_recuperado || 0} reativado(s) · ${r.movidos_para_inativo || 0} inativado(s) · ${r.movidos_para_renovacao || 0} renovação · ${r.movidos_para_risco || 0} risco`,
      );
      await queryClient.invalidateQueries({ queryKey: ["alunos_with_plans"] });
      await queryClient.invalidateQueries({ queryKey: ["pipeline-alunos"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao recalcular status");
    } finally {
      setRecalculando(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} aluno{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={recalcularStatus} disabled={recalculando} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${recalculando ? "animate-spin" : ""}`} />
            {recalculando ? "Recalculando..." : "Recalcular status"}
          </Button>
          <AddStudentDialog onStudentAdded={() => refetch()} />
        </div>
      </div>

      <StudentListFilters filters={filters} onChange={setFilters} professors={professors} />

      <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Frequência</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Professor</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Final Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Última Aval. Funcional</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Serviços do Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Serviços Contratados</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="p-4 hidden xl:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="p-4 hidden xl:table-cell"><Skeleton className="h-5 w-32" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((student) => {
                const c = student.credits;
                const whatsappNumber = student.telefone?.replace(/\D/g, "") || null;
                const professorName = student.responsavel_id ? profileMap[student.responsavel_id] : null;

                const planEndStr = student.planEnd
                  ? format(student.planEnd, "dd/MM/yyyy")
                  : null;

                const isPlanExpired = student.planEnd && isBefore(student.planEnd, new Date());

                return (
                  <tr
                    key={student.id}
                    onClick={() => navigate(`/alunos/${student.id}`)}
                    className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{student.nome}</p>
                        <p className="text-xs text-muted-foreground">{student.email || "—"}</p>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {(() => {
                        const d = getDisplayStatus(student.status, student.planEnd, student.licencas, student.planTipo);
                        return (
                          <Badge variant="outline" className={`text-xs ${d.className}`}>{d.label}</Badge>
                        );
                      })()}
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      {student.planTipo ? (
                        <Badge variant="outline" className="text-xs">{student.planTipo}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {student.frequencia_semanal === 0 ? "Livre" : `${student.frequencia_semanal}x/semana`}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{professorName || "—"}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {planEndStr ? (
                        <span className={`text-sm ${isPlanExpired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          {planEndStr}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      <CreditsCell map={c?.plano ?? {}} originLabel="Plano" />
                    </td>
                    <td className="p-4 hidden xl:table-cell">
                      <CreditsCell map={c?.servico ?? {}} originLabel="Contratado" />
                    </td>
                    <td className="p-4 hidden xl:table-cell text-center">
                      {whatsappNumber ? (
                        <a
                          href={`https://wa.me/55${whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
                        >
                          <MessageCircle className="h-5 w-5" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
