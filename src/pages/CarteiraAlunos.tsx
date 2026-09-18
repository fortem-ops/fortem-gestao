import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import { Users, ArrowRightLeft, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { fetchLastFuncionalDateBatch, severityForLastFuncional } from "@/lib/avaliacaoFuncional";
import { carregarTodasAsPaginas } from "@/lib/supabasePaginado";
import { StatusPill, type PillStatus } from "@/components/carteira/StatusPills";
import type { ReschedTask } from "@/components/tasks/RescheduleDialog";

const TIPOS_FICHA = ["atualizar_treino"];
const TIPOS_RELATORIO = ["relatorio_tecnico_forca", "relatorio_tecnico_corrida"];

interface TarefaCarteira extends ReschedTask {
  aluno_id: string | null;
  tipo_auto: string | null;
}

/** Entre tarefas abertas do mesmo grupo, vale a mais crítica (prazo mais antigo). */
function maisCritica(a: TarefaCarteira | null, b: TarefaCarteira): TarefaCarteira {
  if (!a) return b;
  const da = a.data_limite ?? "9999-12-31";
  const db = b.data_limite ?? "9999-12-31";
  return db < da ? b : a;
}

export default function CarteiraAlunos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterProfessor, setFilterProfessor] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetProfessor, setTargetProfessor] = useState("");

  // Check if current user is coord/admin
  const { data: isCoordAdmin } = useQuery({
    queryKey: ["isCoordAdmin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  // Fetch professionals (RPC bypasses user_roles RLS), merged with any responsavel_id already in use
  const { data: professors = [] } = useQuery({
    queryKey: ["professors-carteira"],
    queryFn: async () => {
      const { data: equipe } = await supabase.rpc("fn_listar_profissionais");
      const lista: { user_id: string; full_name: string }[] = (equipe || []).map((e: any) => ({
        user_id: e.user_id as string,
        full_name: (e.full_name as string) || "",
      }));
      const conhecidos = new Set(lista.map((p) => p.user_id));

      const { data: alunos } = await supabase
        .from("alunos")
        .select("responsavel_id")
        .not("responsavel_id", "is", null);
      const faltantes = [
        ...new Set((alunos || []).map((a) => a.responsavel_id).filter((id): id is string => !!id && !conhecidos.has(id))),
      ];
      if (faltantes.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", faltantes);
        (profiles || []).forEach((p) => lista.push({ user_id: p.user_id, full_name: p.full_name || "" }));
      }

      return lista.sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });


  // Fetch active students (those with active plans) + last functional assessment
  const { data: studentsWithPlans = [], isLoading } = useQuery({
    queryKey: ["carteira-alunos"],
    queryFn: async () => {
      const { data: activePlans } = await supabase
        .from("planos")
        .select("aluno_id")
        .eq("ativo", true);
      if (!activePlans?.length) return [];

      const alunoIds = [...new Set(activePlans.map((p) => p.aluno_id))];
      const { data: alunos } = await supabase
        .from("alunos")
        .select("id, nome, email, status, responsavel_id, frequencia_semanal")
        .in("id", alunoIds)
        .eq("is_equipe", false)
        .eq("status", "ativo")
        .order("nome");
      if (!alunos?.length) return [];

      const lastByAluno = await fetchLastFuncionalDateBatch(alunos.map((a) => a.id));

      return alunos.map((a) => ({ ...a, ultima_aval_funcional: lastByAluno[a.id] ?? null }));
    },
  });

  // Tarefas abertas de troca de ficha e relatório técnico
  const { data: tarefasAbertas = [] } = useQuery({
    queryKey: ["carteira-tarefas-abertas"],
    queryFn: async () =>
      carregarTodasAsPaginas<TarefaCarteira>({
        tabela: "tarefas",
        colunas: "id, descricao, data_limite, aluno_id, tipo_auto",
        ordenarPor: [{ coluna: "id", ascending: true }],
        filtros: (q: any) =>
          q.neq("status", "concluida").in("tipo_auto", [...TIPOS_FICHA, ...TIPOS_RELATORIO]),
      }),
  });

  const tarefasPorAluno = useMemo(() => {
    const m: Record<string, { ficha: TarefaCarteira | null; relatorio: TarefaCarteira | null }> = {};
    tarefasAbertas.forEach((t) => {
      if (!t.aluno_id) return;
      if (!m[t.aluno_id]) m[t.aluno_id] = { ficha: null, relatorio: null };
      if (TIPOS_FICHA.includes(t.tipo_auto || "")) {
        m[t.aluno_id].ficha = maisCritica(m[t.aluno_id].ficha, t);
      } else if (TIPOS_RELATORIO.includes(t.tipo_auto || "")) {
        m[t.aluno_id].relatorio = maisCritica(m[t.aluno_id].relatorio, t);
      }
    });
    return m;
  }, [tarefasAbertas]);

  const profMap = useMemo(() => {
    const m: Record<string, string> = {};
    professors.forEach((p) => { m[p.user_id] = p.full_name; });
    return m;
  }, [professors]);

  const filtered = useMemo(() => {
    return studentsWithPlans.filter((a) => {
      if (search && !a.nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterProfessor !== "all" && a.responsavel_id !== filterProfessor) return false;
      return true;
    });
  }, [studentsWithPlans, search, filterProfessor]);

  // Group by professor, logged-in user first
  const grouped = useMemo(() => {
    const g: Record<string, typeof filtered> = {};
    filtered.forEach((a) => {
      const key = a.responsavel_id || "sem-professor";
      if (!g[key]) g[key] = [];
      g[key].push(a);
    });
    // Sort: current user's group first
    const entries = Object.entries(g);
    entries.sort(([a], [b]) => {
      if (a === user?.id) return -1;
      if (b === user?.id) return 1;
      if (a === "sem-professor") return 1;
      if (b === "sem-professor") return -1;
      return 0;
    });
    return entries;
  }, [filtered, user?.id]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((a) => a.id)));
    }
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from("alunos")
        .update({ responsavel_id: targetProfessor })
        .in("id", ids);
      if (error) throw error;

      // Register in history for each student
      const userId = user!.id;
      const profName = profMap[targetProfessor] || "Desconhecido";
      const histEntries = ids.map((aluno_id) => ({
        aluno_id,
        autor_id: userId,
        categoria: "transferencia",
        descricao: `Aluno transferido para o professor ${profName}`,
      }));
      await supabase.from("historico_profissional").insert(histEntries);
    },
    onSuccess: () => {
      toast.success(`${selected.size} aluno(s) transferido(s) com sucesso`);
      setSelected(new Set());
      setTransferOpen(false);
      setTargetProfessor("");
      queryClient.invalidateQueries({ queryKey: ["carteira-alunos"] });
    },
    onError: () => toast.error("Erro ao transferir alunos"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-heading font-bold text-foreground">Carteira de Alunos</h1>
          <p className="text-sm text-muted-foreground">Alunos com planos ativos e seus professores responsáveis</p>
        </div>
        {isCoordAdmin && selected.size > 0 && (
          <Button size="sm" onClick={() => setTransferOpen(true)} className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Transferir</span> {selected.size}
          </Button>
        )}
      </div>

      {/* Filters */}
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
        <Select value={filterProfessor} onValueChange={setFilterProfessor}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrar por professor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os professores</SelectItem>
            {professors.map((p) => (
              <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
            ))}
            <SelectItem value="sem-professor">Sem professor</SelectItem>
          </SelectContent>
        </Select>
        {isCoordAdmin && (
          <Button variant="outline" size="sm" onClick={selectAll}>
            {selected.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
        )}
      </div>


      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total com plano ativo</p>
            <p className="text-2xl font-bold text-foreground">{studentsWithPlans.length}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Professores</p>
            <p className="text-2xl font-bold text-foreground">
              {new Set(studentsWithPlans.filter((a) => a.responsavel_id).map((a) => a.responsavel_id)).size}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Sem professor</p>
            <p className="text-2xl font-bold text-warning">
              {studentsWithPlans.filter((a) => !a.responsavel_id).length}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Selecionados</p>
            <p className="text-2xl font-bold text-primary">{selected.size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped list */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : grouped.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">Nenhum aluno com plano ativo encontrado</p>
      ) : (
        grouped.map(([profId, alunos]) => (
          <Card key={profId} className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {profId === "sem-professor" ? "Sem professor atribuído" : profMap[profId] || "Professor desconhecido"}
                {profId === user?.id && <Badge variant="default" className="text-xs">Você</Badge>}
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
                    <TableHead className="whitespace-nowrap">Ficha</TableHead>
                    <TableHead className="whitespace-nowrap">Relatório</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alunos.map((aluno: any) => {
                    const last = aluno.ultima_aval_funcional as Date | null;
                    const sev = severityForLastFuncional(last);
                    const statusAF: PillStatus =
                      sev.className === "status-active"
                        ? "em_dia"
                        : sev.className === "status-warning"
                          ? "pendente"
                          : "atrasada";
                    const lastLabel = last ? last.toLocaleDateString("pt-BR") : "Nunca avaliado";
                    const hojeStr = new Date().toISOString().split("T")[0];
                    const tarefas = tarefasPorAluno[aluno.id];
                    const tFicha = tarefas?.ficha ?? null;
                    const tRel = tarefas?.relatorio ?? null;
                    const venc = (t: TarefaCarteira | null) =>
                      !!t?.data_limite && t.data_limite < hojeStr;
                    const prazo = (t: TarefaCarteira | null) =>
                      t?.data_limite
                        ? `prazo ${new Date(t.data_limite + "T00:00:00").toLocaleDateString("pt-BR")}`
                        : t
                          ? "sem prazo"
                          : "sem pendência";
                    return (
                      <TableRow
                        key={aluno.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/alunos/${aluno.id}`)}
                      >
                        {isCoordAdmin && (
                          <TableCell
                            className="w-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selected.has(aluno.id)}
                              onCheckedChange={(e) => { e && e !== true; toggleSelect(aluno.id); }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{aluno.nome}</p>
                            <p className="text-xs text-muted-foreground">{aluno.email || "Sem email"} · {aluno.frequencia_semanal === 5 ? "Livre" : `${aluno.frequencia_semanal || 0}x/semana`}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            label="AF"
                            titulo="Avaliação Funcional"
                            status={statusAF}
                            detalhe={`última em ${lastLabel}`}
                            acaoLabel="Agendar/registrar avaliação"
                            acaoHref={`/alunos/${aluno.id}?tab=avaliacoes`}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            label="Ficha"
                            titulo="Troca de Ficha"
                            status={venc(tFicha) ? "atrasada" : "em_dia"}
                            detalhe={prazo(tFicha)}
                            acaoLabel="Completar troca de ficha"
                            acaoHref={`/alunos/${aluno.id}?tab=treinos`}
                            tarefa={tFicha}
                            onReagendado={() => queryClient.invalidateQueries({ queryKey: ["carteira-tarefas-abertas"] })}
                          />
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            label="Relatório"
                            titulo="Relatório"
                            status={venc(tRel) ? "atrasada" : "em_dia"}
                            detalhe={prazo(tRel)}
                            acaoLabel="Completar relatório"
                            acaoHref={`/alunos/${aluno.id}?tab=registros&sub=relatorios`}
                            tarefa={tRel}
                            onReagendado={() => queryClient.invalidateQueries({ queryKey: ["carteira-tarefas-abertas"] })}
                          />
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

      {/* Transfer dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Alunos</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transferir <strong>{selected.size}</strong> aluno(s) para outro professor.
          </p>
          <Select value={targetProfessor} onValueChange={setTargetProfessor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o professor destino" />
            </SelectTrigger>
            <SelectContent>
              {professors.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={!targetProfessor || transferMutation.isPending}
            >
              {transferMutation.isPending ? "Transferindo..." : "Confirmar Transferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}