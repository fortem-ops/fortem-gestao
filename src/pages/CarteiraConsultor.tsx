import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Briefcase, ArrowRightLeft, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchLastFuncionalDateBatch } from "@/lib/avaliacaoFuncional";
import { getDisplayStatus, ACTIVE_STATUS_KEYS } from "@/lib/studentStatus";
import { selecionarPlanoExibicao, planoDataFim } from "@/lib/planoPrincipal";
import {
  classificarAvaliacaoFuncional,
  classificarFrequencia,
  LABEL_AF,
  LABEL_FREQ,
  type StatusAvaliacaoFuncional,
  type StatusFrequencia,
} from "@/lib/carteiraConsultor";

const SEM_CONSULTOR = "sem-consultor";

function BadgeAF({ status }: { status: StatusAvaliacaoFuncional }) {
  const variant = status === "em_dia" ? "status-active" : status === "pendente" ? "status-warning" : "status-danger";
  return <span className={`text-xs px-2 py-1 rounded-md ${variant}`}>{LABEL_AF[status]}</span>;
}

function BadgeFreq({ status }: { status: StatusFrequencia }) {
  const variant =
    status === "assiduo" ? "status-active" : status === "irregular" ? "status-warning" : "text-muted-foreground";
  return <span className={`text-xs px-2 py-1 rounded-md ${variant}`}>{LABEL_FREQ[status]}</span>;
}

export default function CarteiraConsultor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterConsultor, setFilterConsultor] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetConsultor, setTargetConsultor] = useState("");
  const tarefasGeradas = useRef(false);

  const { data: isCoordAdmin } = useQuery({
    queryKey: ["isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-carteira-consultor"],
    queryFn: async () => {
      const { data } = await supabase.rpc("fn_listar_profissionais");
      return ((data || []) as any[])
        .map((e) => ({ user_id: e.user_id as string, full_name: (e.full_name as string) || "" }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const nomePorId = useMemo(() => {
    const m: Record<string, string> = {};
    profissionais.forEach((p) => { m[p.user_id] = p.full_name; });
    return m;
  }, [profissionais]);

  const { data: alunosCarteira = [], isLoading } = useQuery({
    queryKey: ["carteira-consultor"],
    queryFn: async () => {
      const { data: activePlans } = await supabase
        .from("planos")
        .select("id, aluno_id, tipo, atividade, data_inicio, data_fim, duracao_meses, ativo, created_at")
        .eq("ativo", true);
      if (!activePlans?.length) return [];

      const alunoIds = [...new Set(activePlans.map((p) => p.aluno_id))];
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, email, status, responsavel_id, consultor_id, frequencia_semanal, current_pipeline_stage_id")
        .in("id", alunoIds)
        .eq("is_equipe", false)
        .order("nome");
      if (!alunos?.length) return [];

      const { data: licencas } = await supabase
        .from("aluno_licencas")
        .select("aluno_id, tipo, data_inicio, data_fim, dias, motivo")
        .in("aluno_id", alunos.map((a) => a.id));
      const licencasMap: Record<string, any[]> = {};
      (licencas || []).forEach((l: any) => { (licencasMap[l.aluno_id] ||= []).push(l); });

      const planosPorAluno: Record<string, any[]> = {};
      activePlans.forEach((p: any) => { (planosPorAluno[p.aluno_id] ||= []).push(p); });

      const ativos = alunos.filter((a) => {
        const selecao = selecionarPlanoExibicao(planosPorAluno[a.id] ?? []);
        const plano = selecao.plano as any;
        const display = getDisplayStatus(
          a.status,
          planoDataFim(plano),
          licencasMap[a.id] || [],
          plano?.tipo ?? null,
          { corridaOnly: selecao.corridaOnly },
        );
        return (ACTIVE_STATUS_KEYS as string[]).includes(display.key);
      });
      if (!ativos.length) return [];

      const ids = ativos.map((a) => a.id);
      const desde = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const [lastByAluno, sessoesRes, agendaRes, stagesRes] = await Promise.all([
        fetchLastFuncionalDateBatch(ids),
        supabase.from("treino_sessoes").select("aluno_id").in("aluno_id", ids).gte("data", desde),
        supabase.from("treino_agendamentos").select("aluno_id").in("aluno_id", ids).gte("data", desde),
        supabase.from("pipeline_stages").select("id, name, color"),
      ]);

      const sessoesPorAluno: Record<string, number> = {};
      ((sessoesRes.data || []) as any[]).forEach((s) => { sessoesPorAluno[s.aluno_id] = (sessoesPorAluno[s.aluno_id] || 0) + 1; });
      const agendaPorAluno: Record<string, number> = {};
      ((agendaRes.data || []) as any[]).forEach((a) => { agendaPorAluno[a.aluno_id] = (agendaPorAluno[a.aluno_id] || 0) + 1; });
      const stageMap: Record<string, { name: string; color: string | null }> = {};
      ((stagesRes.data || []) as any[]).forEach((s) => { stageMap[s.id] = { name: s.name, color: s.color }; });

      return ativos.map((a) => {
        const ultima = lastByAluno[a.id] ?? null;
        const stage = a.current_pipeline_stage_id ? stageMap[a.current_pipeline_stage_id] : null;
        return {
          ...a,
          ultima_aval_funcional: ultima,
          statusAF: classificarAvaliacaoFuncional(ultima),
          statusFreq: classificarFrequencia({
            sessoes4Semanas: sessoesPorAluno[a.id] || 0,
            frequenciaSemanal: a.frequencia_semanal,
            temAgendamentos: (agendaPorAluno[a.id] || 0) > 0,
          }),
          etapa: stage?.name ?? null,
          etapaCor: stage?.color ?? null,
        };
      });
    },
  });

  // Cria tarefa de reavaliação para quem está pendente/atrasada (a função no banco não duplica).
  useEffect(() => {
    if (tarefasGeradas.current || !user || !alunosCarteira.length) return;
    tarefasGeradas.current = true;
    const alvos = alunosCarteira.filter((a: any) => a.statusAF !== "em_dia");
    if (!alvos.length) return;
    (async () => {
      for (const a of alvos) {
        const ultima = a.ultima_aval_funcional as Date | null;
        const { error } = await supabase.rpc("fn_criar_tarefa_reavaliacao_app", {
          _aluno_id: a.id,
          _data_ultima: ultima ? ultima.toISOString().slice(0, 10) : null,
        } as any);
        if (error) {
          console.error("Falha ao criar tarefa de reavaliação:", error.message);
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    })();
  }, [alunosCarteira, user, queryClient]);

  const filtered = useMemo(() => {
    return alunosCarteira.filter((a: any) => {
      if (search && !a.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterConsultor === SEM_CONSULTOR) return !a.consultor_id;
      if (filterConsultor !== "all" && a.consultor_id !== filterConsultor) return false;
      return true;
    });
  }, [alunosCarteira, search, filterConsultor]);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    filtered.forEach((a: any) => {
      const key = a.consultor_id || SEM_CONSULTOR;
      (g[key] ||= []).push(a);
    });
    const entries = Object.entries(g);
    entries.sort(([a], [b]) => {
      if (a === user?.id) return -1;
      if (b === user?.id) return 1;
      if (a === SEM_CONSULTOR) return 1;
      if (b === SEM_CONSULTOR) return -1;
      return (nomePorId[a] || "").localeCompare(nomePorId[b] || "");
    });
    return entries;
  }, [filtered, user?.id, nomePorId]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((a: any) => a.id)));
  };

  const atribuirMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase.from("alunos").update({ consultor_id: targetConsultor }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selected.size} aluno(s) atribuído(s) ao consultor`);
      setSelected(new Set());
      setTransferOpen(false);
      setTargetConsultor("");
      queryClient.invalidateQueries({ queryKey: ["carteira-consultor"] });
    },
    onError: () => toast.error("Erro ao atribuir consultor"),
  });

  const semConsultor = alunosCarteira.filter((a: any) => !a.consultor_id).length;
  const pendentesAF = alunosCarteira.filter((a: any) => a.statusAF !== "em_dia").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground">Carteira Consultor</h1>
          <p className="text-sm text-muted-foreground">
            Alunos ativos por consultor responsável, com avaliação funcional, frequência e situação no funil
          </p>
        </div>
        {isCoordAdmin && selected.size > 0 && (
          <Button size="sm" onClick={() => setTransferOpen(true)} className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Atribuir consultor</span> {selected.size}
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
        <Select value={filterConsultor} onValueChange={setFilterConsultor}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os consultores</SelectItem>
            {profissionais.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
            ))}
            <SelectItem value={SEM_CONSULTOR}>Sem consultor</SelectItem>
          </SelectContent>
        </Select>
        {isCoordAdmin && (
          <Button variant="outline" size="sm" onClick={selectAll}>
            {selected.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total com plano ativo</p>
            <p className="text-2xl font-bold text-foreground">{alunosCarteira.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Consultores</p>
            <p className="text-2xl font-bold text-foreground">
              {new Set(alunosCarteira.filter((a: any) => a.consultor_id).map((a: any) => a.consultor_id)).size}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sem consultor</p>
            <p className="text-2xl font-bold text-warning">{semConsultor}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avaliação pendente/atrasada</p>
            <p className="text-2xl font-bold text-primary">{pendentesAF}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : grouped.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">Nenhum aluno com plano ativo encontrado</p>
      ) : (
        grouped.map(([consultorId, alunos]) => (
          <Card key={consultorId} className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                {consultorId === SEM_CONSULTOR ? "Sem consultor atribuído" : nomePorId[consultorId] || "Consultor desconhecido"}
                {consultorId === user?.id && <Badge variant="default" className="text-xs">Você</Badge>}
                <Badge variant="secondary" className="ml-auto">{alunos.length} aluno(s)</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {isCoordAdmin && <TableHead className="w-10" />}
                    <TableHead>Aluno</TableHead>
                    <TableHead className="whitespace-nowrap">Avaliação Funcional</TableHead>
                    <TableHead className="whitespace-nowrap">Frequência</TableHead>
                    <TableHead className="whitespace-nowrap">Situação no funil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alunos.map((aluno: any) => {
                    const ultima = aluno.ultima_aval_funcional as Date | null;
                    return (
                      <TableRow key={aluno.id} className="cursor-pointer" onClick={() => navigate(`/alunos/${aluno.id}`)}>
                        {isCoordAdmin && (
                          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(aluno.id)}
                              onCheckedChange={() => toggleSelect(aluno.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{aluno.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Professor: {aluno.responsavel_id ? nomePorId[aluno.responsavel_id] || "—" : "—"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <BadgeAF status={aluno.statusAF} />
                            <span className="text-xs text-muted-foreground">
                              {ultima ? `última em ${ultima.toLocaleDateString("pt-BR")}` : "nunca avaliado"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell><BadgeFreq status={aluno.statusFreq} /></TableCell>
                        <TableCell>
                          {aluno.etapa ? (
                            <Badge
                              variant="outline"
                              style={aluno.etapaCor ? { borderColor: aluno.etapaCor, color: aluno.etapaCor } : undefined}
                            >
                              {aluno.etapa}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Fora do funil</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Consultor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Definir o consultor responsável de <strong>{selected.size}</strong> aluno(s).
          </p>
          <Select value={targetConsultor} onValueChange={setTargetConsultor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o consultor" />
            </SelectTrigger>
            <SelectContent>
              {profissionais.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button onClick={() => atribuirMutation.mutate()} disabled={!targetConsultor || atribuirMutation.isPending}>
              {atribuirMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
