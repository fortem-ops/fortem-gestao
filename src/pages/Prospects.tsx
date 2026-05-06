import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Pencil, KanbanSquare, Search, CalendarPlus, ListTodo } from "lucide-react";
import { EditLeadDialog } from "@/components/leads/EditLeadDialog";
import { ORIGEM_LEAD_OPTIONS } from "@/lib/leads";
import { waMeLink, formatDaysAgo } from "@/lib/pipeline";
import { format, subDays } from "date-fns";

const PROSPECT_STAGE_NAMES = ["Prospect", "Treino experimental agendado"];

export default function Prospects() {
  const navigate = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [agendaFilter, setAgendaFilter] = useState<string>("all");

  const { data: stages = [] } = useQuery({
    queryKey: ["prospect-stages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id,name")
        .in("name", PROSPECT_STAGE_NAMES);
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

  // Conversion rate (last 30 days)
  const { data: conversionRate = 0 } = useQuery({
    queryKey: ["prospects-conversion-rate"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data: stagesAll } = await supabase.from("pipeline_stages").select("id,name").in("name", ["Novo lead", "Prospect"]);
      const novoLeadId = stagesAll?.find((s) => s.name === "Novo lead")?.id;
      const prospectId = stagesAll?.find((s) => s.name === "Prospect")?.id;
      if (!novoLeadId || !prospectId) return 0;
      const { data: leadsCreated } = await supabase
        .from("pipeline_movements")
        .select("id")
        .eq("to_stage_id", novoLeadId)
        .gte("moved_at", since);
      const { data: converted } = await supabase
        .from("pipeline_movements")
        .select("id")
        .eq("from_stage_id", novoLeadId)
        .eq("to_stage_id", prospectId)
        .gte("moved_at", since);
      const total = leadsCreated?.length || 0;
      const conv = converted?.length || 0;
      return total > 0 ? Math.round((conv / total) * 100) : 0;
    },
  });

  const porOrigem = useMemo(() => {
    const m: Record<string, number> = {};
    ORIGEM_LEAD_OPTIONS.forEach((o) => (m[o] = 0));
    prospects.forEach((p: any) => { if (m[p.origem] !== undefined) m[p.origem]++; });
    return m;
  }, [prospects]);
  const maxOrigem = Math.max(1, ...Object.values(porOrigem));

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return prospects.filter((p: any) => {
      if (term && !p.nome.toLowerCase().includes(term)) return false;
      if (stageFilter !== "all" && p.current_pipeline_stage_id !== stageFilter) return false;
      if (agendaFilter === "sim" && !p.tem_agenda) return false;
      if (agendaFilter === "nao" && p.tem_agenda) return false;
      return true;
    });
  }, [prospects, search, stageFilter, agendaFilter]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Prospects</h1>
          <p className="text-sm text-muted-foreground mt-1">Leads qualificados — meio de funil</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Total de prospects</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{prospects.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Conversão Lead → Prospect (30d)</p>
          <p className="text-3xl font-bold mt-1 text-primary">{conversionRate}%</p>
        </Card>
        <Card className="p-4">
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
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar prospect..." className="pl-8" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas etapas</SelectItem>
            {stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={agendaFilter} onValueChange={setAgendaFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sim">Com agendamento</SelectItem>
            <SelectItem value="nao">Sem agendamento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Agenda</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum prospect encontrado.</TableCell></TableRow>
            )}
            {filtered.map((p: any) => {
              const wa = waMeLink(p.telefone, `Olá ${p.nome.split(" ")[0]}! Vamos agendar sua aula experimental?`);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{p.telefone || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{p.origem}</Badge></TableCell>
                  <TableCell><Badge>{stageNameMap[p.current_pipeline_stage_id] || "—"}</Badge></TableCell>
                  <TableCell>
                    {p.tem_agenda ? <Badge variant="secondary">Agendado</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(p.created_at), "dd/MM/yyyy")} · {formatDaysAgo(p.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <EditLeadDialog alunoId={editId} open={!!editId} onOpenChange={(v) => !v && setEditId(null)} />
    </div>
  );
}
