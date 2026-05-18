import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Pencil, KanbanSquare, CalendarPlus, ListTodo, ClipboardPlus, UserCheck } from "lucide-react";
import { EditLeadDialog } from "@/components/leads/EditLeadDialog";
import { ConvertToAlunoDialog } from "@/components/pipeline/ConvertToAlunoDialog";
import { VendaDialog } from "@/components/student/venda/VendaDialog";
import { ORIGEM_LEAD_OPTIONS } from "@/lib/leads";
import { waMeLink, formatDaysAgo } from "@/lib/pipeline";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadProspectFilters, defaultLeadProspectFilters, type LeadProspectFiltersState } from "@/components/leads/LeadProspectFilters";

const PROSPECT_STAGE_NAMES = ["Prospect", "Treino experimental agendado"];

export default function Prospects() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editId, setEditId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadProspectFiltersState>(defaultLeadProspectFilters);

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
        .select("id,nome,telefone,created_at,current_pipeline_stage_id")
        .in("current_pipeline_stage_id", stageIds)
        .order("created_at", { ascending: false });
      if (!alunos?.length) return [];
      const ids = alunos.map((a) => a.id);
      const [{ data: meta }, { data: agenda }] = await Promise.all([
        supabase.from("pipeline_metadata").select("aluno_id,origem_lead").in("aluno_id", ids),
        supabase.from("agenda_servicos").select("aluno_id").in("aluno_id", ids),
      ]);
      const metaMap: Record<string, string> = {};
      (meta || []).forEach((m: any) => { if (m.origem_lead) metaMap[m.aluno_id] = m.origem_lead; });
      const agendaSet = new Set((agenda || []).map((a: any) => a.aluno_id));
      return alunos.map((a) => ({
        ...a,
        origem: metaMap[a.id] || "—",
        tem_agenda: agendaSet.has(a.id),
      }));
    },
    enabled: stageIds.length > 0,
  });

  const { data: conversionRate = 0 } = useQuery({
    queryKey: ["prospects-conversion-rate"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data: stagesAll } = await supabase.from("pipeline_stages").select("id,name").in("name", ["Novo lead", "Prospect"]);
      const novoLeadId = stagesAll?.find((s) => s.name === "Novo lead")?.id;
      const prospectId = stagesAll?.find((s) => s.name === "Prospect")?.id;
      if (!novoLeadId || !prospectId) return 0;
      const { data: leadsCreated } = await supabase
        .from("pipeline_movements").select("id").eq("to_stage_id", novoLeadId).gte("moved_at", since);
      const { data: converted } = await supabase
        .from("pipeline_movements").select("id").eq("from_stage_id", novoLeadId).eq("to_stage_id", prospectId).gte("moved_at", since);
      const total = leadsCreated?.length || 0;
      const conv = converted?.length || 0;
      return total > 0 ? Math.round((conv / total) * 100) : 0;
    },
  });

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} prospect{filtered.length !== 1 ? "s" : ""} · meio do funil
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Total de prospects</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{prospectsPeriodo.length}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Conversão Lead → Prospect (30d)</p>
          <p className="text-3xl font-bold mt-1 text-primary">{conversionRate}%</p>
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

      <LeadProspectFilters
        mode="prospects"
        filters={filters}
        onChange={setFilters}
        primaryLabel="Todas etapas"
        primaryOptions={stages.map((s: any) => ({ value: s.id, label: s.name }))}
        mesesDisponiveis={mesesDisponiveis}
        searchPlaceholder="Buscar prospect por nome..."
      />

      <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
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
                  <td className="p-4 hidden lg:table-cell"><Badge className="text-xs">{stageNameMap[p.current_pipeline_stage_id] || "—"}</Badge></td>
                  <td className="p-4 hidden lg:table-cell">
                    {p.tem_agenda ? <Badge variant="secondary" className="text-xs">Agendado</Badge> : <span className="text-muted-foreground text-xs">—</span>}
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
                      <Button size="icon" variant="ghost" onClick={() => setEditId(p.id)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate("/agenda")} title="Agendar">
                        <CalendarPlus className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => navigate("/tarefas")} title="Nova tarefa">
                        <ListTodo className="w-4 h-4" />
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
    </div>
  );
}
