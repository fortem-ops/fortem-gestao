import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, Utensils, Footprints, RefreshCw, Trash2, X } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AddStudentDialog from "@/components/student/AddStudentDialog";
import ImportStudentsCSVDialog from "@/components/student/ImportStudentsCSVDialog";
import { StudentListFilters, defaultFilters, type StudentFilters } from "@/components/student/StudentListFilters";
import { addMonths, format, isAfter, isBefore, startOfDay } from "date-fns";
import { getDisplayStatus } from "@/lib/studentStatus";
import type { AlunoLicenca } from "@/lib/licencas";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLastFuncionalDateBatch, severityForLastFuncional } from "@/lib/avaliacaoFuncional";

const ALUNOS_COLUMNS =
  "id, nome, email, telefone, status, frequencia_semanal, responsavel_id, foto_url, user_id, current_pipeline_stage_id, cpf, rg, data_nascimento, cep, logradouro, cidade";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isInativos = mode === "inativos";
  const pageTitle = isInativos ? "Alunos Inativos" : "Alunos Ativos";

  // Timeout de segurança para evitar skeleton infinito caso a query trave
  const [forceReady, setForceReady] = useState(false);
  const forceReadyTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    forceReadyTimer.current = setTimeout(() => {
      console.warn("[StudentList] Timeout de segurança ativado após 10s — forçando renderização.");
      setForceReady(true);
    }, 10000);
    return () => {
      if (forceReadyTimer.current) clearTimeout(forceReadyTimer.current);
    };
  }, []);

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["is-coord-admin", user?.id],
    queryFn: async () => {
      console.log("[StudentList] Verificando role do usuário:", user?.id, user?.email);
      const { data, error } = await supabase.rpc("is_coordenador_ou_admin");
      if (error) {
        console.error("[StudentList] Erro ao verificar role:", error);
        return false;
      }
      console.log("[StudentList] is_coordenador_ou_admin:", data);
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

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

  const { data: debugAccess } = useQuery({
    queryKey: ["debug-alunos-access", user?.id],
    queryFn: async () => {
      console.log("[StudentList] Iniciando diagnóstico de acesso a alunos. user:", user?.id);
      const { count, error } = await supabase
        .from("alunos")
        .select("id", { count: "exact", head: true });

      console.log("[StudentList] Acesso a alunos - count:", count, "error:", error);

      if (error) {
        console.error("[StudentList] Erro ao diagnosticar acesso a alunos:", error);
      }

      return count;
    },
    enabled: !!user,
    staleTime: 0,
  });

  const { data: alunos = [], isLoading, error, refetch } = useQuery({
    queryKey: ["alunos_with_plans"],
    queryFn: async () => {
      console.log("[StudentList] Iniciando fetch de alunos. user:", user?.id, "email:", user?.email);
      // Paginated fetch to bypass PostgREST 1000-row default limit
      const PAGE = 1000;
      const students: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("alunos")
          .select(ALUNOS_COLUMNS)
          .order("nome")
          .range(from, from + PAGE - 1);
        console.log(`[StudentList] Página alunos from=${from}:`, { count: data?.length, error });
        if (error) {
          console.error("[StudentList] Erro ao buscar alunos:", error);
          throw error;
        }
        students.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }

      console.log("[StudentList] Total alunos retornados:", students.length);
      if (students.length === 0) {
        console.warn("[StudentList] Nenhum aluno retornado — possível problema de RLS ou conexão", {
          debugAccess,
          userId: user?.id,
        });
        return [];
      }

      const ids = students.map((s) => s.id);
      // Chunk .in() filters to stay below PostgREST URL/row caps
      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const CHUNK = 300;

      const planos: any[] = [];
      for (const part of chunk(ids, CHUNK)) {
        const { data, error } = await supabase
          .from("planos")
          .select("id, aluno_id, tipo, data_inicio, data_fim, duracao_meses, ativo, servicos")
          .in("aluno_id", part)
          .eq("ativo", true);
        if (error) {
          console.error("[StudentList] Erro ao buscar planos dos alunos (continuando sem planos):", error, { chunkSize: part.length });
          // Não quebra toda a query; alunos sem planos aparecerão como encerrados.
          continue;
        }
        planos.push(...(data || []));
      }
      console.log("[StudentList] Total planos ativos retornados:", planos.length);
      const planoIds = planos.map((p: any) => p.id);
      const consumos: any[] = [];
      for (const part of chunk(planoIds, CHUNK)) {
        const { data, error } = await supabase
          .from("consumo_servicos")
          .select("aluno_id, plano_id, tipo_servico, tipo_registro, quantidade, agenda_id")
          .in("plano_id", part);
        if (error) {
          console.error("Erro ao buscar consumo de serviços:", error, { chunkSize: part.length });
          throw error;
        }
        consumos.push(...(data || []));
      }
      const creditos: any[] = [];
      for (const part of chunk(ids, CHUNK)) {
        const { data, error } = await supabase
          .from("creditos_aluno" as any)
          .select("aluno_id, origem_tipo, atividade, quantidade_inicial, quantidade_usada, ilimitado")
          .in("aluno_id", part)
          .eq("ativo", true);
        if (error) {
          console.error("Erro ao buscar créditos dos alunos:", error, { chunkSize: part.length });
          throw error;
        }
        creditos.push(...((data as any[]) || []));
      }
      const licencas: any[] = [];
      for (const part of chunk(ids, CHUNK)) {
        const { data, error } = await supabase
          .from("aluno_licencas" as any)
          .select("aluno_id, tipo, data_inicio, data_fim, dias, motivo")
          .in("aluno_id", part);
        if (error) {
          console.error("Erro ao buscar licenças dos alunos:", error, { chunkSize: part.length });
          throw error;
        }
        licencas.push(...((data as any[]) || []));
      }

      const licencasMap: Record<string, AlunoLicenca[]> = {};
      ((licencas as unknown as AlunoLicenca[]) || []).forEach((l) => {
        (licencasMap[l.aluno_id] ||= []).push(l);
      });

      const creditsMap: Record<string, ServiceCredits> = {};
      const planEndMap: Record<string, Date | null> = {};
      const planStartMap: Record<string, Date | null> = {};
      const planTipoMap: Record<string, string | null> = {};

      const PLAN_SERVICES = ["Avaliação Funcional", "Consultas Nutrição", "Consultas Reabilitação"];

      for (const student of students) {
        const plano: any = planos?.find((p) => p.aluno_id === student.id);
        if (plano) {
          planEndMap[student.id] = plano.data_fim
            ? new Date(plano.data_fim + "T00:00:00")
            : addMonths(new Date(plano.data_inicio), plano.duracao_meses);
          planStartMap[student.id] = plano.data_inicio ? new Date(plano.data_inicio + "T00:00:00") : null;
          planTipoMap[student.id] = plano.tipo || null;
        } else {
          planEndMap[student.id] = null;
          planStartMap[student.id] = null;
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

      const enriched = students.map((s) => ({ ...s, credits: creditsMap[s.id], planEnd: planEndMap[s.id], planStart: planStartMap[s.id], planTipo: planTipoMap[s.id], licencas: licencasMap[s.id] || [] }));
      console.log("[StudentList] Alunos enriquecidos:", enriched.length);
      return enriched;
    },
    retry: 2,
    retryDelay: 1000,
  });

  const alunoIds = useMemo(() => alunos.map((a) => a.id), [alunos]);
  const { data: lastFuncionalMap } = useQuery({
    queryKey: ["last_funcional_batch", alunoIds],
    queryFn: () => fetchLastFuncionalDateBatch(alunoIds),
    enabled: alunoIds.length > 0,
    staleTime: 30_000,
  });

  const debouncedSearch = useDebounce(filters.search, 250);

  const filtered = useMemo(() => {
    console.log("[StudentList] Recalculando filtros. Total alunos:", alunos.length, "isInativos:", isInativos);
    const term = debouncedSearch.toLowerCase();
    let droppedReasons: Record<string, number> = {};
    const result = alunos.filter((s) => {
      const c = s.credits;
      const matchSearch = (s.nome ?? "").toLowerCase().includes(term) ||
        (s.email?.toLowerCase().includes(term) ?? false);
      const display = getDisplayStatus(s.status, s.planEnd, s.licencas, s.planTipo);
      const matchMode = isInativos
        ? display.key === "encerrado"
        : display.key === "ativo" || display.key === "licenca";
      if (!matchMode) return false;
      const matchStatus = filters.status.length === 0 || filters.status.includes(display.key);

      const matchFreq = filters.frequencia === "todos" ||
        (filters.frequencia === "livre" ? s.frequencia_semanal === 5 : s.frequencia_semanal === parseInt(filters.frequencia));

      const hasBase = c && Object.keys(c.plano).length > 0;
      const matchSP = filters.servicosPlano === "todos" ||
        (filters.servicosPlano === "com" ? hasBase : !hasBase);

      const hasPurch = c && Object.keys(c.servico).length > 0;
      const matchSC = filters.servicosContratados === "todos" ||
        (filters.servicosContratados === "com" ? hasPurch : !hasPurch);

      const matchProf = filters.professor.length === 0 || (s.responsavel_id && filters.professor.includes(s.responsavel_id));

      const matchTipoPlano = filters.tipoPlano.length === 0 || (s.planTipo && filters.tipoPlano.includes(s.planTipo));

      const matchVip = filters.vip === "todos" ||
        (filters.vip === "sim" ? (s.planTipo || "").toLowerCase() === "vip" : (s.planTipo || "").toLowerCase() !== "vip");

      let matchAvalFunc = true;
      if (filters.ultimaAvaliacaoFuncional.length > 0) {
        const date = lastFuncionalMap?.[s.id] ?? null;
        let key: string;
        if (date === null) {
          key = "nunca_realizada";
        } else {
          const sev = severityForLastFuncional(date);
          const keyMap: Record<string, string> = { "status-active": "em_dia", "status-warning": "pendente", "status-urgent": "atrasada" };
          key = keyMap[sev.className] ?? "";
        }
        matchAvalFunc = (filters.ultimaAvaliacaoFuncional as string[]).includes(key);
      }

      let matchServDisp = true;
      if (filters.servicoPlanoDisponivel.length > 0) {
        const keyForFilter: Record<string, string> = {
          avaliacao_funcional: "Avaliação Funcional",
          nutricao: "Consultas Nutrição",
          reabilitacao: "Consultas Reabilitação",
        };
        matchServDisp = filters.servicoPlanoDisponivel.some((sel) => {
          const agg = c?.plano?.[keyForFilter[sel]];
          return !!agg && (agg.ilimitado || agg.total - agg.usado > 0);
        });
      }



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

      let matchDateStart = true;
      if (filters.dataInicioDe && s.planStart) {
        matchDateStart = matchDateStart && !isBefore(s.planStart, startOfDay(filters.dataInicioDe));
      }
      if (filters.dataInicioAte && s.planStart) {
        matchDateStart = matchDateStart && !isAfter(s.planStart, startOfDay(filters.dataInicioAte));
      }
      if ((filters.dataInicioDe || filters.dataInicioAte) && !s.planStart) {
        matchDateStart = false;
      }

      const d = filters.dadosCadastrais;
      const checkPresenca = (mode: "todos" | "com" | "sem", has: boolean) =>
        mode === "todos" ? true : mode === "com" ? has : !has;
      const matchDados =
        checkPresenca(d.email, !!(s as any).email) &&
        checkPresenca(d.cpf, !!(s as any).cpf) &&
        checkPresenca(d.telefone, !!(s as any).telefone) &&
        checkPresenca(d.rg, !!(s as any).rg) &&
        checkPresenca(d.dataNascimento, !!(s as any).data_nascimento) &&
        checkPresenca(d.endereco, !!((s as any).cep || (s as any).logradouro || (s as any).cidade)) &&
        checkPresenca(d.foto, !!(s as any).foto_url);

      const matches = matchSearch && matchStatus && matchFreq && matchSP && matchSC && matchProf && matchTipoPlano && matchVip && matchAvalFunc && matchServDisp && matchDate && matchDateStart && matchDados;
      if (!matches) {
        if (!matchMode) droppedReasons["modo"] = (droppedReasons["modo"] || 0) + 1;
        else if (!matchSearch) droppedReasons["search"] = (droppedReasons["search"] || 0) + 1;
        else if (!matchStatus) droppedReasons["status"] = (droppedReasons["status"] || 0) + 1;
        else if (!matchFreq) droppedReasons["freq"] = (droppedReasons["freq"] || 0) + 1;
        else if (!matchSP) droppedReasons["servicosPlano"] = (droppedReasons["servicosPlano"] || 0) + 1;
        else if (!matchSC) droppedReasons["servicosContratados"] = (droppedReasons["servicosContratados"] || 0) + 1;
        else if (!matchProf) droppedReasons["professor"] = (droppedReasons["professor"] || 0) + 1;
        else if (!matchTipoPlano) droppedReasons["tipoPlano"] = (droppedReasons["tipoPlano"] || 0) + 1;
        else if (!matchVip) droppedReasons["vip"] = (droppedReasons["vip"] || 0) + 1;
        else if (!matchAvalFunc) droppedReasons["avalFunc"] = (droppedReasons["avalFunc"] || 0) + 1;
        else if (!matchServDisp) droppedReasons["servDisp"] = (droppedReasons["servDisp"] || 0) + 1;
        else if (!matchDate || !matchDateStart) droppedReasons["data"] = (droppedReasons["data"] || 0) + 1;
        else if (!matchDados) droppedReasons["dadosCadastrais"] = (droppedReasons["dadosCadastrais"] || 0) + 1;
      }
      return matches;
    });
    console.log("[StudentList] Filtrado:", result.length, "Motivos de descarte:", droppedReasons);
    return result;
  }, [alunos, debouncedSearch, filters.status, filters.frequencia, filters.servicosPlano, filters.servicosContratados, filters.professor, filters.tipoPlano, filters.vip, filters.ultimaAvaliacaoFuncional, filters.servicoPlanoDisponivel, filters.dataInicioDe, filters.dataInicioAte, filters.dataFinalDe, filters.dataFinalAte, filters.dadosCadastrais, isInativos, lastFuncionalMap]);


  const filteredIds = useMemo(() => filtered.map((s: any) => s.id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const someSelected = filteredIds.some((id) => selectedIds.has(id));

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) filteredIds.forEach((id) => next.add(id));
      else filteredIds.forEach((id) => next.delete(id));
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("alunos").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} cadastro${ids.length !== 1 ? "s" : ""} excluído${ids.length !== 1 ? "s" : ""}.`);
      clearSelection();
      setConfirmDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["alunos_with_plans"] });
      await queryClient.invalidateQueries({ queryKey: ["pipeline-alunos"] });
      refetch();
    } catch (e: any) {
      const msg = e?.message || "Erro ao excluir cadastros";
      if (/foreign key|violates/i.test(msg)) {
        toast.error("Não foi possível excluir: há registros vinculados (planos, pagamentos, agenda). Considere encerrar o cadastro.");
      } else {
        toast.error(msg);
      }
    } finally {
      setDeleting(false);
    }
  }


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
          const color = agg.ilimitado || restante > 0 ? "text-success" : "text-destructive";
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

  const showLoading = isLoading && !forceReady;

  if (error && !forceReady) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-heading font-bold text-foreground">{pageTitle}</h1>
        <div className="glass-card rounded-lg p-8 text-center space-y-3">
          <p className="text-destructive font-medium">Erro ao carregar alunos</p>
          <p className="text-sm text-muted-foreground">
            {(error as any)?.message || "Tente recarregar a página"}
          </p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} aluno{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={recalcularStatus} disabled={recalculando} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${recalculando ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{recalculando ? "Recalculando..." : "Recalcular status"}</span>
          </Button>
          {isCoordAdmin && (
            <>
              <ImportStudentsCSVDialog
                status={isInativos ? "encerrado" : "ativo"}
                onImported={() => refetch()}
              />
              <AddStudentDialog onStudentAdded={() => refetch()} />
            </>
          )}
        </div>
      </div>

      <StudentListFilters filters={filters} onChange={setFilters} professors={professors} />

      {selectedIds.size > 0 && (
        <div className="glass-card rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in border border-primary/40">
          <div className="flex items-center gap-3">
            <Badge variant="default" className="text-xs">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</Badge>
            <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1 text-xs">
              <X className="w-3 h-3" /> Limpar seleção
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {isCoordAdmin && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteOpen(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" /> Excluir selecionados
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="glass-card rounded-lg overflow-hidden overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Status</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Frequência</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Professor</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Início Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Final Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Última Aval. Funcional</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Serviços do Plano</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Serviços Contratados</th>

            </tr>
          </thead>
          <tbody>
            {showLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-4 w-10"><Skeleton className="h-4 w-4" /></td>
                  <td className="p-4"><Skeleton className="h-5 w-40" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-16" /></td>
                  <td className="p-4 hidden md:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-20" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-24" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-32" /></td>
                  <td className="p-4 hidden lg:table-cell"><Skeleton className="h-5 w-32" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">
                  Nenhum aluno encontrado.
                </td>

              </tr>
            ) : (
              filtered.map((student) => {
                const c = student.credits;
                const professorName = student.responsavel_id ? profileMap[student.responsavel_id] : null;

                const planEndStr = student.planEnd
                  ? format(student.planEnd, "dd/MM/yyyy")
                  : null;

                const isPlanExpired = student.planEnd && isBefore(student.planEnd, new Date());

                const lastFunc = lastFuncionalMap?.[student.id] ?? null;
                const lastFuncSev = severityForLastFuncional(lastFunc);
                const lastFuncStr = lastFunc ? format(lastFunc, "dd/MM/yyyy") : "—";
                const lastFuncColor =
                  !lastFunc
                    ? "text-muted-foreground"
                    : lastFuncSev.className === "status-urgent"
                      ? "text-destructive font-medium"
                      : lastFuncSev.className === "status-warning"
                        ? "text-warning font-medium"
                        : "text-foreground";

                return (
                  <tr
                    key={student.id}
                    onClick={(e) => {
                      if (e.defaultPrevented) return;
                      if (e.ctrlKey || e.metaKey || e.shiftKey || (e as any).button === 1) return;
                      navigate(`/alunos/${student.id}`);
                    }}
                    className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <td className="p-4 w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(student.id)}
                        onCheckedChange={(v) => toggleOne(student.id, !!v)}
                        aria-label={`Selecionar ${student.nome}`}
                      />
                    </td>
                    <td className="p-4">
                      <Link
                        to={`/alunos/${student.id}`}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/alunos/${student.id}`);
                        }}
                        className="block hover:underline"
                      >
                        <p className="text-sm font-medium text-foreground">{student.nome}</p>
                        <p className="text-xs text-muted-foreground">{student.email || "—"}</p>
                      </Link>
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
                        {student.frequencia_semanal === 5 ? "Livre" : `${student.frequencia_semanal}x/semana`}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <span className="text-sm text-muted-foreground">{professorName || "—"}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      {student.planStart ? (
                        <span className="text-sm text-muted-foreground">{format(student.planStart, "dd/MM/yyyy")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

                    <td className="p-4 hidden lg:table-cell">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`text-sm ${lastFuncColor}`}>{lastFuncStr}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{lastFuncSev.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <CreditsCell map={c?.plano ?? {}} originLabel="Plano" />
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <CreditsCell map={c?.servico ?? {}} originLabel="Contratado" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {showLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-lg p-4 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-lg p-8 text-center text-muted-foreground">
            Nenhum aluno encontrado.
          </div>
        ) : (
          filtered.map((student) => {
            const c = student.credits;
            const professorName = student.responsavel_id ? profileMap[student.responsavel_id] : null;
            const planEndStr = student.planEnd ? format(student.planEnd, "dd/MM/yyyy") : null;
            const isPlanExpired = student.planEnd && isBefore(student.planEnd, new Date());
            const lastFunc = lastFuncionalMap?.[student.id] ?? null;
            const lastFuncSev = severityForLastFuncional(lastFunc);
            const lastFuncStr = lastFunc ? format(lastFunc, "dd/MM/yyyy") : "—";
            const lastFuncColor =
              !lastFunc
                ? "text-muted-foreground"
                : lastFuncSev.className === "status-urgent"
                  ? "text-destructive font-medium"
                  : lastFuncSev.className === "status-warning"
                    ? "text-warning font-medium"
                    : "text-foreground";
            const statusDisplay = getDisplayStatus(student.status, student.planEnd, student.licencas, student.planTipo);
            const hasPlanoServ = c && Object.keys(c.plano).length > 0;
            const hasContrServ = c && Object.keys(c.servico).length > 0;

            return (
              <div
                key={student.id}
                onClick={() => navigate(`/alunos/${student.id}`)}
                className="glass-card rounded-lg p-4 space-y-3 cursor-pointer hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
                    <Checkbox
                      checked={selectedIds.has(student.id)}
                      onCheckedChange={(v) => toggleOne(student.id, !!v)}
                      aria-label={`Selecionar ${student.nome}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground break-words">{student.nome}</p>
                    {student.email && (
                      <p className="text-xs text-muted-foreground break-all">{student.email}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${statusDisplay.className}`}>
                    {statusDisplay.label}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Plano</p>
                    <p className="text-foreground">{student.planTipo || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frequência</p>
                    <p className="text-foreground">
                      {student.frequencia_semanal === 5 ? "Livre" : `${student.frequencia_semanal}x/sem`}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Professor</p>
                    <p className="text-foreground break-words">{professorName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Início Plano</p>
                    <p className="text-foreground">
                      {student.planStart ? format(student.planStart, "dd/MM/yyyy") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Final Plano</p>
                    <p className={isPlanExpired ? "text-destructive font-medium" : "text-foreground"}>
                      {planEndStr || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Última Aval. Funcional</p>
                    <p className={lastFuncColor}>{lastFuncStr}</p>
                  </div>
                </div>

                {(hasPlanoServ || hasContrServ) && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    {hasPlanoServ && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Serviços do Plano</p>
                        <CreditsCell map={c!.plano} originLabel="Plano" />
                      </div>
                    )}
                    {hasContrServ && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Serviços Contratados</p>
                        <CreditsCell map={c!.servico} originLabel="Contratado" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>


      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cadastros selecionados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente {selectedIds.size} cadastro{selectedIds.size !== 1 ? "s" : ""}.
              Cadastros com planos, pagamentos ou agenda vinculados não poderão ser excluídos —
              nesses casos, considere encerrar o cadastro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleBulkDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
