import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDown, ArrowUp, ArrowUpDown, Bell } from "lucide-react";
import {
  stageColor, formatCurrencyBRL, formatDaysAgo, formatNextAction,
  computeTemperature, TEMP_DOT_CLASS, TEMP_DOT_LABEL, ATIVIDADE_CONFIG,
  filterPipelineAlunos, usePipelineFunnels, type TipoAtividade,
} from "@/lib/pipeline";
import { PipelineLeadDrawer } from "./PipelineLeadDrawer";
import type { PipelineCardData } from "./PipelineCard";
import type { PipelineFiltersValue } from "./PipelineFilters";
import { cn } from "@/lib/utils";

interface Stage {
  id: string;
  name: string;
  position: number;
  color: string;
  funnel_id: string;
  probabilidade: number | null;
}

interface Props {
  funnelId: string;
  funnelSlug: string;
  filters: PipelineFiltersValue;
}

type SortKey = "nome" | "stage" | "responsavel" | "valor" | "temperatura" | "last" | "next";
type SortDir = "asc" | "desc";

const TEMP_RANK: Record<string, number> = { quente: 0, morno: 1, parado: 2 };

export function PipelineListView({ funnelId, funnelSlug, filters }: Props) {
  const { user } = useAuth();
  const [sortKey, setSortKey] = useState<SortKey>("last");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStudent, setDrawerStudent] = useState<PipelineCardData | null>(null);

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages", funnelId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pipeline_stages")
        .select("id,name,position,color,funnel_id,probabilidade")
        .eq("is_active", true)
        .eq("funnel_id", funnelId)
        .order("position") as any);
      if (error) throw error;
      return (data || []) as Stage[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: allStages = [] } = useQuery<Stage[]>({
    queryKey: ["pipeline-stages-all"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pipeline_stages")
        .select("id,name,position,color,funnel_id,probabilidade")
        .eq("is_active", true)
        .order("position") as any);
      if (error) throw error;
      return (data || []) as Stage[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: funnels = [] } = usePipelineFunnels({ includeInactive: true });
  const funnelSlugById = useMemo(() => {
    const m: Record<string, string> = {};
    funnels.forEach((f) => { m[f.id] = f.slug; });
    return m;
  }, [funnels]);

  const { data: alunos = [], isLoading } = useQuery({
    queryKey: ["pipeline-alunos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alunos")
        .select("id,nome,foto_url,responsavel_id,current_pipeline_stage_id,motivo_perda,telefone,email")
        .not("current_pipeline_stage_id", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metadata = [] } = useQuery({
    queryKey: ["pipeline-metadata"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_metadata")
        .select("aluno_id,temperatura_lead,valor_estimado_plano,origem_lead,plano_interesse,last_contact_at,updated_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["pipeline-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,full_name");
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { map[p.user_id] = p.full_name; });
      return map;
    },
    staleTime: 10 * 60_000,
  });

  const { data: lastMovesMap = {} } = useQuery({
    queryKey: ["pipeline-last-moves"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_movements")
        .select("aluno_id,moved_at")
        .order("moved_at", { ascending: false })
        .limit(2000);
      const map: Record<string, string> = {};
      (data || []).forEach((m) => { if (!map[m.aluno_id]) map[m.aluno_id] = m.moved_at; });
      return map;
    },
  });

  const { data: nextTasksMap = {} } = useQuery({
    queryKey: ["pipeline-next-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tarefas")
        .select("id,aluno_id,titulo,data_limite,tipo_atividade")
        .eq("status", "pendente")
        .not("aluno_id", "is", null)
        .order("data_limite", { ascending: true, nullsFirst: false })
        .limit(2000);
      const map: Record<string, { id: string; titulo: string; data_limite: string | null; tipo_atividade: string | null }> = {};
      (data || []).forEach((t: any) => {
        if (!map[t.aluno_id]) map[t.aluno_id] = { id: t.id, titulo: t.titulo, data_limite: t.data_limite, tipo_atividade: t.tipo_atividade };
      });
      return map;
    },
  });

  const metaMap = useMemo(() => {
    const m: Record<string, any> = {};
    metadata.forEach((x: any) => { m[x.aluno_id] = x; });
    return m;
  }, [metadata]);

  const stageById = useMemo(() => {
    const m: Record<string, Stage> = {};
    stages.forEach((s) => { m[s.id] = s; });
    return m;
  }, [stages]);

  const rows: PipelineCardData[] = useMemo(() => {
    const stageIds = new Set(stages.map((s) => s.id));
    const inFunnel = (alunos as any[]).filter((a) => a.current_pipeline_stage_id && stageIds.has(a.current_pipeline_stage_id));
    const filtered = filterPipelineAlunos(inFunnel, filters, metaMap, lastMovesMap, user?.id);
    return filtered.map((a: any) => {
      const stage = stageById[a.current_pipeline_stage_id];
      return {
        id: a.id,
        nome: a.nome,
        foto_url: a.foto_url,
        responsavel_id: a.responsavel_id,
        responsavel_nome: a.responsavel_id ? profilesMap[a.responsavel_id] : null,
        motivo_perda: a.motivo_perda,
        current_stage_name: stage?.name,
        current_stage_probabilidade: stage?.probabilidade ?? null,
        current_funnel: stage ? (funnelSlugById[stage.funnel_id] || funnelSlug) : funnelSlug,
        meta: metaMap[a.id],
        last_moved_at: lastMovesMap[a.id],
        next_task: nextTasksMap[a.id] || null,
      };
    });
  }, [alunos, stages, stageById, filters, metaMap, lastMovesMap, profilesMap, nextTasksMap, funnelSlugById, funnelSlug, user]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const getTemp = (r: PipelineCardData) => {
      const cands = [r.meta?.last_contact_at, r.meta?.updated_at, r.last_moved_at].filter(Boolean) as string[];
      const last = cands.length ? new Date(Math.max(...cands.map((d) => new Date(d).getTime()))).toISOString() : null;
      return computeTemperature(last);
    };
    const val = (r: PipelineCardData): string | number => {
      switch (sortKey) {
        case "nome": return r.nome.toLowerCase();
        case "stage": return (r.current_stage_name || "").toLowerCase();
        case "responsavel": return (r.responsavel_nome || "").toLowerCase();
        case "valor": return Number(r.meta?.valor_estimado_plano || 0);
        case "temperatura": return TEMP_RANK[getTemp(r)] ?? 99;
        case "last": return r.last_moved_at ? new Date(r.last_moved_at).getTime() : 0;
        case "next": return r.next_task?.data_limite ? new Date(r.next_task.data_limite).getTime() : Number.MAX_SAFE_INTEGER;
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a); const vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "nome" || k === "stage" || k === "responsavel" ? "asc" : "desc"); }
  }

  function SortHead({ k, label, className }: { k: SortKey; label: string; className?: string }) {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className={cn("cursor-pointer select-none", className)} onClick={() => toggleSort(k)}>
        <span className={cn("inline-flex items-center gap-1", active && "text-foreground")}>
          {label}
          <Icon className="w-3 h-3 opacity-70" />
        </span>
      </TableHead>
    );
  }

  if (isLoading || stages.length === 0) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10" />
              <SortHead k="nome" label="Nome" />
              <SortHead k="stage" label="Etapa" />
              <SortHead k="responsavel" label="Responsável" />
              <SortHead k="valor" label="Valor/mês" className="text-right" />
              <SortHead k="temperatura" label="Temp." className="text-center w-16" />
              <SortHead k="last" label="Última atividade" />
              <SortHead k="next" label="Próxima tarefa" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8 italic">
                  Nenhum lead encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : sorted.map((r) => {
              const initials = r.nome.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();
              const colors = r.current_stage_name ? stageColor(stageById[stages.find((s) => s.name === r.current_stage_name)?.id || ""]?.color || "blue") : stageColor("blue");
              const valor = Number(r.meta?.valor_estimado_plano || 0);
              const cands = [r.meta?.last_contact_at, r.meta?.updated_at, r.last_moved_at].filter(Boolean) as string[];
              const last = cands.length ? new Date(Math.max(...cands.map((d) => new Date(d).getTime()))).toISOString() : null;
              const temp = computeTemperature(last);
              const tipo = (r.next_task?.tipo_atividade as TipoAtividade) || "tarefa";
              const NextIcon = r.next_task ? (ATIVIDADE_CONFIG[tipo]?.icon || Bell) : null;
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => { setDrawerStudent(r); setDrawerOpen(true); }}
                >
                  <TableCell>
                    <Avatar className="h-7 w-7">
                      {r.foto_url && <AvatarImage src={r.foto_url} alt={r.nome} />}
                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{r.nome}</TableCell>
                  <TableCell>
                    {r.current_stage_name && (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", colors.bg, colors.border, colors.text)}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                        {r.current_stage_name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.responsavel_nome || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-300">
                    {valor > 0 ? formatCurrencyBRL(valor) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={cn("inline-block w-2.5 h-2.5 rounded-full", TEMP_DOT_CLASS[temp])} />
                        </TooltipTrigger>
                        <TooltipContent>{TEMP_DOT_LABEL[temp]}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.last_moved_at ? formatDaysAgo(r.last_moved_at) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.next_task && NextIcon ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <NextIcon className="w-3.5 h-3.5 text-primary" />
                        <span className="text-foreground/90">{formatNextAction(r.next_task.titulo, r.next_task.data_limite)}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PipelineLeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        student={drawerStudent}
        stages={allStages}
      />
    </>
  );
}
