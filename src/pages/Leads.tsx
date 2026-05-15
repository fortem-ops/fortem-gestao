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
import { UserPlus, MessageCircle, ArrowRightCircle, Pencil, KanbanSquare, Search, Settings2, CalendarIcon } from "lucide-react";
import { NewLeadDialog } from "@/components/leads/NewLeadDialog";
import { EditLeadDialog } from "@/components/leads/EditLeadDialog";
import { ConvertToProspectDialog } from "@/components/leads/ConvertToProspectDialog";
import { ManageOrigensDialog } from "@/components/leads/ManageOrigensDialog";
import { useLeadOrigens } from "@/hooks/useLeadOrigens";
import { waMeLink, formatDaysAgo } from "@/lib/pipeline";
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Periodo = "sempre" | "mes_atual" | "mes_passado" | "meses_passados" | "custom";

export default function Leads() {
  const navigate = useNavigate();
  const [openNew, setOpenNew] = useState(false);
  const [openManageOrigens, setOpenManageOrigens] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [origem, setOrigem] = useState<string>("all");
  const [responsavel, setResponsavel] = useState<string>("all");
  const [periodo, setPeriodo] = useState<Periodo>("sempre");
  const [customDe, setCustomDe] = useState<Date | undefined>();
  const [customAte, setCustomAte] = useState<Date | undefined>();
  const { data: origensList = [] } = useLeadOrigens(true);
  const origensAtivas = useMemo(() => origensList.filter((o) => o.ativo), [origensList]);

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

  const responsaveisList = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l: any) => l.responsavel_id && set.add(l.responsavel_id));
    return Array.from(set).map((id) => ({ id, nome: profilesMap[id] || "—" }));
  }, [leads, profilesMap]);

  const leadsPeriodo = useMemo(() => {
    if (periodo === "sempre") return leads;
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    if (periodo === "mes_atual") { from = startOfMonth(now); to = endOfMonth(now); }
    else if (periodo === "mes_passado") {
      const m = subMonths(now, 1);
      from = startOfMonth(m); to = endOfMonth(m);
    } else if (periodo === "meses_passados") {
      to = endOfMonth(subMonths(now, 2));
    } else if (periodo === "custom") {
      if (customDe) from = startOfDay(customDe);
      if (customAte) to = endOfDay(customAte);
    }
    return leads.filter((l: any) => {
      const d = new Date(l.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [leads, periodo, customDe, customAte]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leadsPeriodo.filter((l: any) => {
      if (term && !l.nome.toLowerCase().includes(term)) return false;
      if (origem !== "all" && l.origem !== origem) return false;
      if (responsavel !== "all" && l.responsavel_id !== responsavel) return false;
      return true;
    });
  }, [leadsPeriodo, search, origem, responsavel]);

  // KPIs
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Captura inicial — topo do funil</p>
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
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground">Total de leads</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{totalLeads}</p>
        </Card>
        <Card className="p-4 md:col-span-2">
          <p className="text-xs uppercase text-muted-foreground mb-2">Leads por origem</p>
          <div className="space-y-1.5">
            {Object.entries(porOrigem).map(([o, n]) => (
              <div key={o} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-muted-foreground">{o}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(n / maxOrigem) * 100}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lead..." className="pl-8" />
        </div>
        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas origens</SelectItem>
            {origensAtivas.map((o) => <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sempre">Desde sempre</SelectItem>
            <SelectItem value="mes_atual">Mês atual</SelectItem>
            <SelectItem value="mes_passado">Mês passado</SelectItem>
            <SelectItem value="meses_passados">Meses passados</SelectItem>
            <SelectItem value="custom">Customizado</SelectItem>
          </SelectContent>
        </Select>
        {periodo === "custom" && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !customDe && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDe ? format(customDe, "dd/MM/yyyy") : "De"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={customDe} onSelect={setCustomDe} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !customAte && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customAte ? format(customAte, "dd/MM/yyyy") : "Até"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={customAte} onSelect={setCustomAte} initialFocus locale={ptBR} className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </>
        )}
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {responsaveisList.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
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
              <TableHead>Responsável</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lead encontrado.</TableCell></TableRow>
            )}
            {filtered.map((l: any) => {
              const wa = waMeLink(l.telefone, `Olá ${l.nome.split(" ")[0]}! Sou da Fortem 💪`);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-muted-foreground">{l.telefone || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{l.origem}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{profilesMap[l.responsavel_id] || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {format(new Date(l.created_at), "dd/MM/yyyy")} · {formatDaysAgo(l.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
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
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <NewLeadDialog open={openNew} onOpenChange={setOpenNew} />
      <EditLeadDialog alunoId={editId} open={!!editId} onOpenChange={(v) => !v && setEditId(null)} />
      <ConvertToProspectDialog alunoId={convertId} open={!!convertId} onOpenChange={(v) => !v && setConvertId(null)} />
      <ManageOrigensDialog open={openManageOrigens} onOpenChange={setOpenManageOrigens} />
    </div>
  );
}
