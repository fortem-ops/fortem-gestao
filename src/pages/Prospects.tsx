import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageCircle, Pencil, KanbanSquare, CalendarPlus, ListTodo, ClipboardPlus, UserCheck, UserX, FileText, Eye, Trash2 } from "lucide-react";
import { EditLeadDialog } from "@/components/leads/EditLeadDialog";
import { ConvertToAlunoDialog } from "@/components/pipeline/ConvertToAlunoDialog";
import { NaoConversaoDialog } from "@/components/prospects/NaoConversaoDialog";
import { VendaDialog } from "@/components/student/venda/VendaDialog";
import { AssessmentViewerDialog } from "@/components/student/assessment/AssessmentViewerDialog";
import { toast } from "sonner";
import { ORIGEM_LEAD_OPTIONS } from "@/lib/leads";
import { waMeLink, formatDaysAgo } from "@/lib/pipeline";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadProspectFilters, defaultLeadProspectFilters, type LeadProspectFiltersState } from "@/components/leads/LeadProspectFilters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import ImportStudentsCSVDialog from "@/components/student/ImportStudentsCSVDialog";

const PROSPECT_STAGE_NAMES = ["Prospect", "Treino experimental agendado"];


export default function Prospects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<{ id: string; nome: string } | null>(null);
  const [naoConvTarget, setNaoConvTarget] = useState<{ id: string; nome: string } | null>(null);
  const [vendaTarget, setVendaTarget] = useState<{ id: string; nome: string } | null>(null);
  const [viewerTarget, setViewerTarget] = useState<{ avaliacao: Tables<"avaliacoes">; student: Tables<"alunos"> } | null>(null);

  const [filters, setFilters] = useState<LeadProspectFiltersState>(defaultLeadProspectFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleOne = (id: string) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = (ids: string[], checked: boolean) => setSelected((s) => {
    const n = new Set(s);
    if (checked) ids.forEach((i) => n.add(i)); else ids.forEach((i) => n.delete(i));
    return n;
  });
  async function handleBulkDelete() {
    if (!selected.size) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("alunos").delete().in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} prospect${ids.length !== 1 ? "s" : ""} excluído${ids.length !== 1 ? "s" : ""}.`);
      setSelected(new Set());
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["prospects-list"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }


  useEffect(() => {
    const id = searchParams.get("edit");
    if (id) {
      setEditId(id);
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: stages = [] } = useQuery({
    queryKey: ["prospect-stages"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("id,name").in("name", PROSPECT_STAGE_NAMES);
      return data || [];
    },
  });

  const stageIds = stages.map((s) => s.id);
  const stageNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    stages.forEach((s: any) => { m[s.id] = s.name; });
    return m;
  }, [stages]);

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ["prospects-list", stageIds.join(",")],
    queryFn: async () => {
      if (!stageIds.length) return [];
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id,nome,telefone,created_at,current_pipeline_stage_id,motivo_perda")
        .in("current_pipeline_stage_id", stageIds)
        .order("created_at", { ascending: false });
      if (!alunos?.length) return [];
      const ids = alunos.map((a) => a.id);
      const [{ data: meta }, { data: agenda }, { data: avals }] = await Promise.all([
        supabase.from("pipeline_metadata").select("aluno_id,origem_lead").in("aluno_id", ids),
        supabase.from("agenda_servicos").select("id,aluno_id,data_especifica,dia_semana,tipo,atividade,horario_inicio").in("aluno_id", ids).ilike("atividade", "Treino Experimental%"),
        supabase.from("avaliacoes").select("id,aluno_id,created_at").eq("tipo", "experimental").in("aluno_id", ids).order("created_at", { ascending: false }),
      ]);
      const agendaIds = (agenda || []).map((a: any) => a.id);
      const { data: presencas } = agendaIds.length
        ? await supabase.from("agenda_presencas").select("agenda_id,data,comparecimento").in("agenda_id", agendaIds)
        : { data: [] as any[] };
      const presMap: Record<string, boolean> = {};
      (presencas || []).forEach((p: any) => { presMap[`${p.agenda_id}|${p.data}`] = p.comparecimento; });

      const metaMap: Record<string, string> = {};
      (meta || []).forEach((m: any) => { if (m.origem_lead) metaMap[m.aluno_id] = m.origem_lead; });

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const agendaByAluno: Record<string, any[]> = {};
      (agenda || []).forEach((a: any) => {
        (agendaByAluno[a.aluno_id] = agendaByAluno[a.aluno_id] || []).push(a);
      });

      const avalMap: Record<string, string> = {};
      (avals || []).forEach((a: any) => { if (!avalMap[a.aluno_id]) avalMap[a.aluno_id] = a.id; });

      return alunos.map((a) => {
        const list = agendaByAluno[a.id] || [];
        let agendaStatus: "realizado" | "agendado" | null = null;
        for (const ag of list) {
          if (ag.tipo === "avulso" && ag.data_especifica) {
            const key = `${ag.id}|${ag.data_especifica}`;
            if (presMap[key] === true) { agendaStatus = "realizado"; break; }
            const d = new Date(ag.data_especifica + "T12:00:00");
            if (d >= today) agendaStatus = agendaStatus || "agendado";
          } else if (ag.tipo === "fixo") {
            agendaStatus = agendaStatus || "agendado";
          }
        }
        return {
          ...a,
          origem: metaMap[a.id] || "—",
          agenda_status: agendaStatus,
          tem_agenda: list.length > 0,
          avaliacao_experimental_id: avalMap[a.id] || null,
        };
      });
    },
    enabled: stageIds.length > 0,
  });



  // % Conversão Prospect → Aluno no mês atual
  const { data: conversionRate = 0 } = useQuery({
    queryKey: ["prospect-aluno-conversion-rate-month"],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString();
      const fimMes = endOfMonth(new Date()).toISOString();
      const { data: stagesAll } = await supabase
        .from("pipeline_stages")
        .select("id,name,funnel");
      const alunoAtivoId = stagesAll?.find((s: any) => s.name === "Aluno ativo")?.id;
      const prospectFunnelIds = (stagesAll || []).filter((s: any) => s.funnel === "prospects").map((s: any) => s.id);
      if (!alunoAtivoId || !prospectFunnelIds.length) return 0;
      const { data: movs } = await supabase
        .from("pipeline_movements")
        .select("from_stage_id,to_stage_id,moved_at")
        .gte("moved_at", inicioMes)
        .lte("moved_at", fimMes);
      const convertidos = (movs || []).filter((m: any) => m.to_stage_id === alunoAtivoId && prospectFunnelIds.includes(m.from_stage_id)).length;
      // Base: prospects que existiam ou entraram no funil no mês (entradas em qualquer stage de prospects no mês + convertidos)
      const entradasProspects = (movs || []).filter((m: any) => prospectFunnelIds.includes(m.to_stage_id)).length;
      const base = entradasProspects + convertidos;
      return base > 0 ? Math.round((convertidos / base) * 100) : 0;
    },
  });

  // Conversões Prospect → Aluno por mês (últimos 12 meses)
  const { data: conversoesMensais = [] } = useQuery({
    queryKey: ["prospect-aluno-conversions-12m"],
    queryFn: async () => {
      const since = startOfMonth(subMonths(new Date(), 11)).toISOString();
      const { data: stagesAll } = await supabase
        .from("pipeline_stages")
        .select("id,name,funnel");
      const alunoAtivoId = stagesAll?.find((s: any) => s.name === "Aluno ativo")?.id;
      const prospectFunnelIds = (stagesAll || []).filter((s: any) => s.funnel === "prospects").map((s: any) => s.id);
      if (!alunoAtivoId) return [];
      const { data: movs } = await supabase
        .from("pipeline_movements")
        .select("moved_at,from_stage_id,to_stage_id")
        .eq("to_stage_id", alunoAtivoId)
        .gte("moved_at", since);
      const filtered = (movs || []).filter((m: any) => prospectFunnelIds.includes(m.from_stage_id));
      const map: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const key = format(d, "yyyy-MM");
        map[key] = 0;
      }
      filtered.forEach((m: any) => {
        const key = format(new Date(m.moved_at), "yyyy-MM");
        if (map[key] !== undefined) map[key]++;
      });
      return Object.entries(map).map(([key, total]) => {
        const [y, mo] = key.split("-").map(Number);
        return { key, mes: format(new Date(y, mo - 1, 1), "MMM/yy", { locale: ptBR }), total };
      });
    },
  });

  const conversoesMesAtual = useMemo(() => {
    if (!conversoesMensais.length) return 0;
    return conversoesMensais[conversoesMensais.length - 1]?.total || 0;
  }, [conversoesMensais]);

  // Histórico de origem dos prospects CONVERTIDOS em aluno (últimos 6 meses)
  const { data: origemHistorico = [] } = useQuery({
    queryKey: ["prospects-origem-conversao-6m"],
    queryFn: async () => {
      const since = startOfMonth(subMonths(new Date(), 5));
      const { data: stagesAll } = await supabase
        .from("pipeline_stages")
        .select("id,name,funnel");
      const alunoAtivoId = stagesAll?.find((s: any) => s.name === "Aluno ativo")?.id;
      const prospectFunnelIds = (stagesAll || []).filter((s: any) => s.funnel === "prospects").map((s: any) => s.id);
      if (!alunoAtivoId || !prospectFunnelIds.length) return [];
      const { data: movs } = await supabase
        .from("pipeline_movements")
        .select("aluno_id,from_stage_id,to_stage_id,moved_at")
        .eq("to_stage_id", alunoAtivoId)
        .gte("moved_at", since.toISOString());
      const convertidos = (movs || []).filter((m: any) => prospectFunnelIds.includes(m.from_stage_id));
      if (!convertidos.length) return [];
      const alunoIds = Array.from(new Set(convertidos.map((m: any) => m.aluno_id)));
      const { data: metas } = await supabase
        .from("pipeline_metadata")
        .select("aluno_id,origem_lead")
        .in("aluno_id", alunoIds);
      const metaMap: Record<string, string> = {};
      (metas || []).forEach((m: any) => { if (m.origem_lead) metaMap[m.aluno_id] = m.origem_lead; });
      const rows: Record<string, Record<string, number>> = {};
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        rows[format(d, "yyyy-MM")] = {};
      }
      convertidos.forEach((m: any) => {
        const origem = metaMap[m.aluno_id];
        if (!origem) return;
        const key = format(new Date(m.moved_at), "yyyy-MM");
        if (!rows[key]) return;
        rows[key][origem] = (rows[key][origem] || 0) + 1;
      });
      const origens = Array.from(new Set(Object.values(rows).flatMap((r) => Object.keys(r))));
      return Object.entries(rows).map(([key, vals]) => {
        const [y, mo] = key.split("-").map(Number);
        const row: any = { key, mes: format(new Date(y, mo - 1, 1), "MMM/yy", { locale: ptBR }) };
        origens.forEach((o) => { row[o] = vals[o] || 0; });
        return row;
      });
    },
  });

  const origensHistorico = useMemo(() => {
    const set = new Set<string>();
    origemHistorico.forEach((r: any) => Object.keys(r).forEach((k) => {
      if (!["key", "mes", "__origens"].includes(k)) set.add(k);
    }));
    return Array.from(set);
  }, [origemHistorico]);

  const ORIGEM_COLORS = ["hsl(var(--primary))", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#10b981", "#ef4444", "#06b6d4"];



  const mesesDisponiveis = useMemo(() => {
    if (!prospects.length) return [] as { value: string; label: string }[];
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const set = new Set<string>();
    prospects.forEach((p: any) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key < currentKey) set.add(key);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1)).map((key) => {
      const [y, m] = key.split("-").map(Number);
      return { value: key, label: format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }) };
    });
  }, [prospects]);

  const prospectsPeriodo = useMemo(() => {
    if (filters.periodo === "sempre") return prospects;
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    if (filters.periodo === "mes_atual") { from = startOfMonth(now); to = endOfMonth(now); }
    else if (filters.periodo === "mes_passado") { const m = subMonths(now, 1); from = startOfMonth(m); to = endOfMonth(m); }
    else if (filters.periodo === "meses_passados") {
      if (!filters.mesPassado) return prospects.filter(() => false);
      const [y, m] = filters.mesPassado.split("-").map(Number);
      const ref = new Date(y, m - 1, 1);
      from = startOfMonth(ref); to = endOfMonth(ref);
    } else if (filters.periodo === "custom") {
      if (filters.customDe) from = startOfDay(filters.customDe);
      if (filters.customAte) to = endOfDay(filters.customAte);
    }
    return prospects.filter((p: any) => {
      const d = new Date(p.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [prospects, filters.periodo, filters.customDe, filters.customAte, filters.mesPassado]);

  const porOrigem = useMemo(() => {
    const m: Record<string, number> = {};
    ORIGEM_LEAD_OPTIONS.forEach((o) => (m[o] = 0));
    prospectsPeriodo.forEach((p: any) => { if (m[p.origem] !== undefined) m[p.origem]++; });
    return m;
  }, [prospectsPeriodo]);
  const maxOrigem = Math.max(1, ...Object.values(porOrigem));

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return prospectsPeriodo.filter((p: any) => {
      if (term && !p.nome.toLowerCase().includes(term)) return false;
      if (filters.primary !== "all" && p.current_pipeline_stage_id !== filters.primary) return false;
      if (filters.agenda === "sim" && !p.tem_agenda) return false;
      if (filters.agenda === "nao" && p.tem_agenda) return false;
      return true;
    });
  }, [prospectsPeriodo, filters.search, filters.primary, filters.agenda]);

  async function openExperimentalViewer(alunoId: string) {
    try {
      const [{ data: avaliacao, error: e1 }, { data: student, error: e2 }] = await Promise.all([
        supabase.from("avaliacoes").select("*").eq("aluno_id", alunoId).eq("tipo", "experimental").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("alunos").select("*").eq("id", alunoId).single(),
      ]);
      if (e1 || e2) throw e1 || e2;
      if (!avaliacao || !student) { toast.error("Avaliação experimental não encontrada."); return; }
      setViewerTarget({ avaliacao: avaliacao as Tables<"avaliacoes">, student: student as Tables<"alunos"> });
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar avaliação.");
    }
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} prospect{filtered.length !== 1 ? "s" : ""} · meio do funil
          </p>
        </div>
        <ImportStudentsCSVDialog
          status="lead"
          onImported={() => queryClient.invalidateQueries({ queryKey: ["prospects-list"] })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Total de prospects</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{prospectsPeriodo.length}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Conversão Prospect → Aluno (mês)</p>
          <p className="text-3xl font-bold mt-1 text-primary">{conversionRate}%</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Conversão Prospect → Aluno (mês)</p>
          <p className="text-3xl font-bold mt-1 text-primary">{conversoesMesAtual}</p>
          <p className="text-[11px] text-muted-foreground mt-1">novos alunos no mês atual</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground mb-2">Origem dos prospects</p>
          <div className="space-y-1">
            {Object.entries(porOrigem).map(([o, n]) => (
              <div key={o} className="flex items-center gap-2 text-xs">
                <span className="w-28 truncate text-muted-foreground">{o}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(n / maxOrigem) * 100}%` }} />
                </div>
                <span className="w-5 text-right tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground mb-3">Conversão Prospect → Aluno por mês (12m)</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={conversoesMensais} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis type="category" dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} width={56} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground mb-3">Histórico da origem de conversão dos prospects (6m)</p>
          {origensHistorico.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Sem dados de origem no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={origemHistorico} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} width={56} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {origensHistorico.map((o, i) => (
                  <Bar key={o} dataKey={o} stackId="origem" fill={ORIGEM_COLORS[i % ORIGEM_COLORS.length]} radius={i === origensHistorico.length - 1 ? [0, 4, 4, 0] : 0} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>


      <LeadProspectFilters
        mode="prospects"
        filters={filters}
        onChange={setFilters}
        primaryLabel="Todas etapas"
        primaryOptions={stages.map((s: any) => ({ value: s.id, label: s.name }))}
        mesesDisponiveis={mesesDisponiveis}
        searchPlaceholder="Buscar prospect por nome..."
      />

      {selected.size > 0 && (
        <div className="glass-card rounded-lg p-3 flex items-center justify-between animate-fade-in">
          <p className="text-sm text-foreground">
            {selected.size} prospect{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} className="gap-2">
              <Trash2 className="w-4 h-4" /> Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 w-10">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((p: any) => selected.has(p.id))}
                  onCheckedChange={(v) => toggleAll(filtered.map((p: any) => p.id), !!v)}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Telefone</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Origem</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Etapa</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Agenda</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden xl:table-cell">Criado</th>
              <th className="text-right text-xs font-medium text-muted-foreground p-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum prospect encontrado.</td></tr>
            )}
            {filtered.map((p: any) => {
              const wa = waMeLink(p.telefone, `Olá ${p.nome.split(" ")[0]}! Vamos agendar sua aula experimental?`);
              return (
                <tr
                  key={p.id}
                  onClick={() => setEditId(p.id)}
                  className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <p className="text-sm font-medium text-foreground">{p.nome}</p>
                  </td>
                  <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">{p.telefone || "—"}</td>
                  <td className="p-4 hidden md:table-cell"><Badge variant="outline" className="text-xs">{p.origem}</Badge></td>
                  <td className="p-4 hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      {p.motivo_perda ? (
                        <Badge variant="destructive" className="text-xs w-fit" title={p.motivo_perda}>
                          Não convertido · {p.motivo_perda}
                        </Badge>
                      ) : (() => {
                        const stageName = stageNameMap[p.current_pipeline_stage_id] || "—";
                        const cls = stageName === "Prospect"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
                          : stageName === "Treino experimental agendado"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/20"
                          : "";
                        return <Badge variant="outline" className={`text-xs w-fit ${cls}`}>{stageName}</Badge>;
                      })()}
                    </div>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    {p.agenda_status === "realizado" ? (
                      <Badge variant="outline" className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/40">Realizado</Badge>
                    ) : p.agenda_status === "agendado" ? (
                      <Badge variant="outline" className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/40">Agendado</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>

                  <td className="p-4 hidden xl:table-cell text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM/yyyy")} · {formatDaysAgo(p.created_at)}
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {wa && (
                        <Button size="icon" variant="ghost" asChild title="WhatsApp">
                          <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4" /></a>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/alunos/${p.id}`)} title="Visualizar perfil">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditId(p.id)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate("/agenda")} title="Agendar">
                        <CalendarPlus className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate("/tarefas")} title="Nova tarefa">
                        <ListTodo className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/avaliacoes?aluno=${p.id}&new=1`)} title="Nova avaliação">
                        <ClipboardPlus className="w-4 h-4" />
                      </Button>
                      {p.avaliacao_experimental_id && (
                        <Button size="icon" variant="ghost" onClick={() => openExperimentalViewer(p.id)} title="Ver avaliação experimental">
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}

                      <Button size="icon" variant="ghost" onClick={() => setConvertTarget({ id: p.id, nome: p.nome })} title="Converter em aluno">
                        <UserCheck className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setNaoConvTarget({ id: p.id, nome: p.nome })} title="Não conversão">
                        <UserX className="w-4 h-4 text-destructive" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate("/pipeline")} title="Pipeline">
                        <KanbanSquare className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <EditLeadDialog alunoId={editId} open={!!editId} onOpenChange={(v) => !v && setEditId(null)} />

      {convertTarget && (
        <ConvertToAlunoDialog
          open={!!convertTarget}
          onOpenChange={(v) => !v && setConvertTarget(null)}
          alunoId={convertTarget.id}
          alunoNome={convertTarget.nome}
          onConverted={() => setVendaTarget(convertTarget)}
        />
      )}

      {naoConvTarget && (
        <NaoConversaoDialog
          open={!!naoConvTarget}
          onOpenChange={(v) => !v && setNaoConvTarget(null)}
          alunoId={naoConvTarget.id}
          alunoNome={naoConvTarget.nome}
        />
      )}

      {vendaTarget && (
        <VendaDialog
          alunoId={vendaTarget.id}
          alunoNome={vendaTarget.nome}
          open={!!vendaTarget}
          onOpenChange={(v) => !v && setVendaTarget(null)}
        />
      )}
      {viewerTarget && (
        <AssessmentViewerDialog
          open={!!viewerTarget}
          onOpenChange={(v) => !v && setViewerTarget(null)}
          avaliacao={viewerTarget.avaliacao}
          student={viewerTarget.student}
        />
      )}
    </div>
  );
}

