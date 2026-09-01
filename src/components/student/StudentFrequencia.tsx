import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CalendarCheck, Loader2, Pencil, Plus } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  montarLinhasFrequencia, registrarSessao, removerSessao, nomeVariacao,
  type AgendamentoFrequencia, type LinhaFrequencia, type SessaoFrequencia,
} from "@/lib/frequenciaTreino";

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Último ano" },
  { value: "tudo", label: "Tudo" },
];

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "realizado":
      return "bg-success/15 text-success border-success/30";
    case "cancelado":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "confirmado":
      return "bg-primary/15 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function StudentFrequencia({ student }: { student: Tables<"alunos"> }) {
  const qc = useQueryClient();
  const { data: roles } = useUserRoles();
  const podeEditar = !!roles && (roles.isAdmin || roles.isCoordAdmin || !roles.isNutriFisioOnly);

  const [periodo, setPeriodo] = useState("90");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [editando, setEditando] = useState<LinhaFrequencia | null>(null);
  const [salvando, setSalvando] = useState(false);

  const desde = periodo === "tudo" ? null : format(subDays(new Date(), Number(periodo)), "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["student-frequencia", student.id, periodo],
    queryFn: async () => {
      let agQuery = supabase
        .from("treino_agendamentos")
        .select("id, data, horario_inicio, horario_fim, status")
        .eq("aluno_id", student.id)
        .order("data", { ascending: false })
        .limit(500);
      if (desde) agQuery = agQuery.gte("data", desde);

      let sesQuery = (supabase as any)
        .from("treino_sessoes")
        .select("id, aluno_id, treino_id, agendamento_id, variacao, variacao_original, foi_troca, data, concluido_em, observacoes")
        .eq("aluno_id", student.id)
        .order("data", { ascending: true })
        .limit(500);
      if (desde) sesQuery = sesQuery.gte("data", desde);

      const [{ data: ags }, { data: ses }, { data: treinos }] = await Promise.all([
        agQuery,
        sesQuery,
        supabase
          .from("treinos")
          .select("id, descricao, template_fase, conteudo, status, created_at")
          .eq("aluno_id", student.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      return {
        agendamentos: (ags ?? []) as AgendamentoFrequencia[],
        sessoes: (ses ?? []) as SessaoFrequencia[],
        treinos: treinos ?? [],
      };
    },
  });

  const treinoAtual = useMemo(
    () => data?.treinos?.find((t: any) => t.status === "atual") ?? data?.treinos?.[0] ?? null,
    [data],
  );

  const numVariacoes = useMemo(() => {
    const arr = (treinoAtual?.conteudo as any)?.treinos;
    return Array.isArray(arr) && arr.length > 0 ? arr.length : 4;
  }, [treinoAtual]);

  const treinoPorId = useMemo(() => {
    const m = new Map<string, any>();
    (data?.treinos ?? []).forEach((t: any) => m.set(t.id, t));
    return m;
  }, [data]);

  const linhas = useMemo(() => {
    if (!data) return [];
    const todas = montarLinhasFrequencia({
      agendamentos: data.agendamentos,
      sessoes: data.sessoes,
      numVariacoes,
    });
    return statusFiltro === "todos" ? todas : todas.filter((l) => l.status === statusFiltro);
  }, [data, numVariacoes, statusFiltro]);

  const resumo = useMemo(() => {
    const base = data
      ? montarLinhasFrequencia({ agendamentos: data.agendamentos, sessoes: data.sessoes, numVariacoes })
      : [];
    const total = base.length;
    const realizados = base.filter((l) => l.status === "realizado").length;
    const cancelados = base.filter((l) => l.status === "cancelado").length;
    const trocas = base.filter((l) => l.foiTroca).length;
    const elegiveis = total - cancelados;
    const taxa = elegiveis > 0 ? Math.round((realizados / elegiveis) * 100) : 0;
    return { total, realizados, cancelados, trocas, taxa };
  }, [data, numVariacoes]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["student-frequencia", student.id] });
    qc.invalidateQueries({ queryKey: ["portal-treino-sessoes"] });
  }

  async function salvarVariacao(variacao: string) {
    if (!editando) return;
    const treinoId = editando.sessao?.treino_id ?? treinoAtual?.id;
    if (!treinoId) {
      toast.error("O aluno não possui treino prescrito para registrar a frequência.");
      return;
    }
    setSalvando(true);
    try {
      const proposto = editando.propostoVariacao;
      const foiTroca = !!proposto && proposto !== variacao;
      await registrarSessao({
        alunoId: student.id,
        treinoId,
        variacao,
        variacaoOriginal: foiTroca ? proposto : null,
        foiTroca,
        agendamentoId: editando.agendamentoId,
        data: editando.data,
        sessaoExistenteId: editando.sessao?.id ?? null,
        registradoPelaEquipe: true,
      });
      invalidar();
      setEditando(null);
      toast.success(`${variacao} registrado em ${format(parseISO(editando.data + "T12:00:00"), "dd/MM/yyyy")}.`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar o treino.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirRegistro() {
    if (!editando?.sessao) return;
    setSalvando(true);
    try {
      await removerSessao(editando.sessao);
      invalidar();
      setEditando(null);
      toast.success("Registro removido.");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover o registro.");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando frequência...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Agendamentos", valor: resumo.total },
          { label: "Realizados", valor: resumo.realizados },
          { label: "Cancelados", valor: resumo.cancelados },
          { label: "Comparecimento", valor: `${resumo.taxa}%` },
          { label: "Trocas", valor: resumo.trocas },
        ].map((c) => (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-xl font-semibold">{c.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {linhas.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarCheck className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Nenhum registro de frequência no período.</p>
            <p className="text-xs mt-1">A frequência é gerada a partir da Agenda de Treinos.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Data</th>
                  <th className="text-left font-medium px-3 py-2">Situação</th>
                  <th className="text-left font-medium px-3 py-2">Proposto</th>
                  <th className="text-left font-medium px-3 py-2">Realizado</th>
                  <th className="text-left font-medium px-3 py-2">Programa</th>
                  <th className="text-right font-medium px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const treino = l.sessao ? treinoPorId.get(l.sessao.treino_id) : null;
                  return (
                    <tr key={l.key} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {format(parseISO(l.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                        {l.horarioInicio && (
                          <span className="text-muted-foreground ml-1">{l.horarioInicio.slice(0, 5)}</span>
                        )}
                        {l.semAgendamento && (
                          <Badge variant="outline" className="ml-2 text-[10px]">sem agendamento</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={statusBadgeClass(l.status)}>
                          {STATUS_LABEL[l.status] ?? l.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{l.propostoVariacao ?? "—"}</td>
                      <td className="px-3 py-2">
                        {l.realizadoVariacao ? (
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{l.realizadoVariacao}</span>
                            {l.foiTroca && (
                              <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/30">
                                Trocado
                              </Badge>
                            )}
                            {l.registradoPelaEquipe && (
                              <Badge variant="outline" className="text-[10px]">Registrado pela equipe</Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {treino?.template_fase ?? treino?.descricao ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {podeEditar && l.status !== "cancelado" && (
                          <Button size="sm" variant="ghost" onClick={() => setEditando(l)}>
                            {l.sessao ? (<><Pencil className="w-3.5 h-3.5 mr-1" />Alterar</>)
                              : (<><Plus className="w-3.5 h-3.5 mr-1" />Registrar treino</>)}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editando?.sessao ? "Alterar treino realizado" : "Registrar treino realizado"}
            </DialogTitle>
            <DialogDescription>
              {editando && (
                <>
                  {format(parseISO(editando.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  {editando.propostoVariacao ? ` · proposto: ${editando.propostoVariacao}` : ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: numVariacoes }, (_, i) => nomeVariacao(i)).map((v) => (
              <Button
                key={v}
                variant={editando?.realizadoVariacao === v ? "default" : "outline"}
                disabled={salvando}
                onClick={() => salvarVariacao(v)}
              >
                {v}
              </Button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editando?.sessao ? (
              <Button variant="destructive" disabled={salvando} onClick={excluirRegistro}>
                Remover registro
              </Button>
            ) : <span />}
            <Button variant="outline" disabled={salvando} onClick={() => setEditando(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
