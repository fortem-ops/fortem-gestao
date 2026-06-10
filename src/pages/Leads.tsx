import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { UserPlus, MessageCircle, ArrowRightCircle, Pencil, KanbanSquare, Settings2, Trash2 } from "lucide-react";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { EditLeadDialog } from "@/components/leads/EditLeadDialog";
import { ConvertToProspectDialog } from "@/components/leads/ConvertToProspectDialog";
import { ManageOrigensDialog } from "@/components/leads/ManageOrigensDialog";
import { useLeadOrigens } from "@/hooks/useLeadOrigens";
import { waMeLink, formatDaysAgo } from "@/lib/pipeline";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LeadProspectFilters, defaultLeadProspectFilters, type LeadProspectFiltersState } from "@/components/leads/LeadProspectFilters";

export default function Leads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openNew, setOpenNew] = useState(false);
  const [openManageOrigens, setOpenManageOrigens] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [filters, setFilters] = useState<LeadProspectFiltersState>(defaultLeadProspectFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data: origensList = [] } = useLeadOrigens(true);
  const origensAtivas = useMemo(() => origensList.filter((o) => o.ativo), [origensList]);

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
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} excluído${ids.length !== 1 ? "s" : ""}.`);
      setSelected(new Set());
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey: ["leads-list"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }



  // Abrir edit via ?edit=id (busca global)
  useEffect(() => {
    const id = searchParams.get("edit");
    if (id) {
      setEditId(id);
      searchParams.delete("edit");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: leadStage } = useQuery({
    queryKey: ["stage-novo-lead"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_stages").select("id").eq("name", "Novo lead").maybeSingle();
      return data?.id as string | undefined;
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-list", leadStage],
    queryFn: async () => {
      if (!leadStage) return [];
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id,nome,telefone,responsavel_id,created_at,current_pipeline_stage_id")
        .eq("current_pipeline_stage_id", leadStage)
        .order("created_at", { ascending: false });
      if (!alunos?.length) return [];
      const ids = alunos.map((a) => a.id);
      const { data: meta } = await supabase
        .from("pipeline_metadata")
        .select("aluno_id,origem_lead")
        .in("aluno_id", ids);
      const metaMap: Record<string, string> = {};
      (meta || []).forEach((m: any) => { if (m.origem_lead) metaMap[m.aluno_id] = m.origem_lead; });
      return alunos.map((a) => ({ ...a, origem: metaMap[a.id] || "—" }));
    },
    enabled: !!leadStage,
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["leads-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id,full_name");
      const m: Record<string, string> = {};
      (data || []).forEach((p) => { m[p.user_id] = p.full_name; });
      return m;
    },
    staleTime: 5 * 60_000,
  });

  // Conversão Lead → Prospect (30d)
  const { data: conversionRate = 0 } = useQuery({
    queryKey: ["leads-conversion-rate"],
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

  const responsaveisList = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l: any) => l.responsavel_id && set.add(l.responsavel_id));
    return Array.from(set).map((id) => ({ id, nome: profilesMap[id] || "—" }));
  }, [leads, profilesMap]);

  const mesesDisponiveis = useMemo(() => {
    if (!leads.length) return [] as { value: string; label: string }[];
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const set = new Set<string>();
    leads.forEach((l: any) => {
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key < currentKey) set.add(key);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1)).map((key) => {
      const [y, m] = key.split("-").map(Number);
      return { value: key, label: format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }) };
    });
  }, [leads]);

  const leadsPeriodo = useMemo(() => {
    if (filters.periodo === "sempre") return leads;
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    if (filters.periodo === "mes_atual") { from = startOfMonth(now); to = endOfMonth(now); }
    else if (filters.periodo === "mes_passado") { const m = subMonths(now, 1); from = startOfMonth(m); to = endOfMonth(m); }
    else if (filters.periodo === "meses_passados") {
      if (!filters.mesPassado) return leads.filter(() => false);
      const [y, m] = filters.mesPassado.split("-").map(Number);
      const ref = new Date(y, m - 1, 1);
      from = startOfMonth(ref); to = endOfMonth(ref);
    } else if (filters.periodo === "custom") {
      if (filters.customDe) from = startOfDay(filters.customDe);
      if (filters.customAte) to = endOfDay(filters.customAte);
    }
    return leads.filter((l: any) => {
      const d = new Date(l.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [leads, filters.periodo, filters.customDe, filters.customAte, filters.mesPassado]);

  const filtered = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return leadsPeriodo.filter((l: any) => {
      if (term && !l.nome.toLowerCase().includes(term)) return false;
      if (filters.primary !== "all" && l.origem !== filters.primary) return false;
      if (filters.responsavel !== "all" && l.responsavel_id !== filters.responsavel) return false;
      return true;
    });
  }, [leadsPeriodo, filters.search, filters.primary, filters.responsavel]);

  const totalLeads = leadsPeriodo.length;
  const porOrigem = useMemo(() => {
    const m: Record<string, number> = {};
    origensAtivas.forEach((o) => (m[o.nome] = 0));
    leadsPeriodo.forEach((l: any) => { if (l.origem && l.origem !== "—" && m[l.origem] === undefined) m[l.origem] = 0; });
    leadsPeriodo.forEach((l: any) => { if (m[l.origem] !== undefined) m[l.origem]++; });
    return m;
  }, [leadsPeriodo, origensAtivas]);
  const maxOrigem = Math.max(1, ...Object.values(porOrigem));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""} · captura inicial — topo do funil
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setOpenManageOrigens(true)} className="gap-2">
            <Settings2 className="w-4 h-4" /> Gerenciar Origens
          </Button>
          <Button onClick={() => setOpenNew(true)} className="gap-2">
            <UserPlus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Total de leads</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{totalLeads}</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground">Conversão Lead → Prospect (30d)</p>
          <p className="text-3xl font-bold mt-1 text-primary">{conversionRate}%</p>
        </div>
        <div className="glass-card rounded-lg p-4">
          <p className="text-xs uppercase text-muted-foreground mb-2">Leads por origem</p>
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
        mode="leads"
        filters={filters}
        onChange={setFilters}
        primaryLabel="Todas origens"
        primaryOptions={origensAtivas.map((o) => ({ value: o.nome, label: o.nome }))}
        responsaveis={responsaveisList}
        mesesDisponiveis={mesesDisponiveis}
        searchPlaceholder="Buscar lead por nome..."
      />

      <div className="glass-card rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground p-4">Nome</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Telefone</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden md:table-cell">Origem</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Responsável</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-4 hidden lg:table-cell">Criado</th>
              <th className="text-right text-xs font-medium text-muted-foreground p-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum lead encontrado.</td></tr>
            )}
            {filtered.map((l: any) => {
              const wa = waMeLink(l.telefone, `Olá ${l.nome.split(" ")[0]}! Sou da Fortem 💪`);
              return (
                <tr
                  key={l.id}
                  onClick={() => setEditId(l.id)}
                  className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                >
                  <td className="p-4">
                    <p className="text-sm font-medium text-foreground">{l.nome}</p>
                  </td>
                  <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">{l.telefone || "—"}</td>
                  <td className="p-4 hidden md:table-cell"><Badge variant="outline" className="text-xs">{l.origem}</Badge></td>
                  <td className="p-4 hidden lg:table-cell text-sm text-muted-foreground">{profilesMap[l.responsavel_id] || "—"}</td>
                  <td className="p-4 hidden lg:table-cell text-xs text-muted-foreground">
                    {format(new Date(l.created_at), "dd/MM/yyyy")} · {formatDaysAgo(l.created_at)}
                  </td>
                  <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {wa && (
                        <Button size="icon" variant="ghost" asChild title="WhatsApp">
                          <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="w-4 h-4" /></a>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => setEditId(l.id)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConvertId(l.id)} className="gap-1">
                        <ArrowRightCircle className="w-4 h-4" /> Converter
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

      <NewLeadDialog open={openNew} onOpenChange={setOpenNew} />
      <EditLeadDialog alunoId={editId} open={!!editId} onOpenChange={(v) => !v && setEditId(null)} />
      <ConvertToProspectDialog alunoId={convertId} open={!!convertId} onOpenChange={(v) => !v && setConvertId(null)} />
      <ManageOrigensDialog open={openManageOrigens} onOpenChange={setOpenManageOrigens} />
    </div>
  );
}
