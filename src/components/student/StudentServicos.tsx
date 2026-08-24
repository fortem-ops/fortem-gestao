import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingBag, Infinity as InfinityIcon, History } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const ATIVIDADES = [
  "Treino",
  "Avaliação Funcional",
  "Avaliação Física",
  "Nutrição",
  "Reabilitação",
];

interface Props {
  student: Tables<"alunos">;
  isCoordAdmin: boolean;
}

interface FormState {
  atividade: string;
  quantidade_inicial: number;
  ilimitado: boolean;
  data_validade: string;
}

const defaultForm = (): FormState => ({
  atividade: "",
  quantidade_inicial: 1,
  ilimitado: false,
  data_validade: "",
});

export function StudentServicos({ student, isCoordAdmin }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [historicoId, setHistoricoId] = useState<string | null>(null);

  const { data: creditos = [], isLoading } = useQuery({
    queryKey: ["creditos_aluno_lista", student.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos_aluno")
        .select("*")
        .eq("aluno_id", student.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(defaultForm());
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.atividade) throw new Error("Selecione a atividade");
      const { data: credito, error } = await supabase
        .from("creditos_aluno")
        .insert({
          aluno_id: student.id,
          origem_tipo: "servico",
          atividade: form.atividade,
          quantidade_inicial: form.ilimitado ? 0 : form.quantidade_inicial,
          ilimitado: form.ilimitado,
          data_validade: form.data_validade || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("creditos_movimentos").insert({
        credito_id: credito.id,
        tipo: "compra",
        quantidade: form.ilimitado ? 0 : form.quantidade_inicial,
        registrado_por: user?.id,
        observacao: "Lançamento manual",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos_aluno_lista", student.id] });
      toast.success("Crédito adicionado");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("creditos_aluno")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creditos_aluno_lista", student.id] });
      toast.success("Crédito desativado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" /> Serviços e Créditos Contratados
        </h3>
        {isCoordAdmin && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar Crédito
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Inclui créditos do Plano ativo, Serviços avulsos contratados e lançamentos manuais. O consumo é automático ao agendar.
      </p>

      {isLoading ? (
        <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
      ) : creditos.length === 0 ? (
        <div className="glass-card rounded-lg p-5">
          <p className="text-sm text-muted-foreground">Nenhum crédito ativo. Créditos do plano, serviços avulsos vendidos e lançamentos manuais aparecem aqui.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atividade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-center">Inicial</TableHead>
                <TableHead className="text-center">Usado</TableHead>
                <TableHead className="text-center">Restante</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="w-[60px] text-center">Uso</TableHead>
                {isCoordAdmin && <TableHead className="w-[60px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditos.map((c: any) => {
                const restante = c.ilimitado ? Infinity : (c.quantidade_inicial - c.quantidade_usada);
                const esgotado = !c.ilimitado && restante <= 0;
                const rowClass = esgotado
                  ? "bg-destructive/15 hover:bg-destructive/20 border-l-4 border-destructive"
                  : "bg-success/15 hover:bg-success/20 border-l-4 border-success";
                const origemLabel = c.origem_tipo === "plano" ? "Plano" : "Serviço";
                const origemClass = c.origem_tipo === "plano"
                  ? "border-primary/40 text-primary"
                  : "border-info/40 text-info";
                const aberto = historicoId === c.id;
                return (
                  <Fragment key={c.id}>
                  <TableRow className={rowClass}>
                    <TableCell>
                      <span className="font-medium">{c.atividade}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={origemClass}>{origemLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {c.ilimitado ? <InfinityIcon className="h-4 w-4 inline" /> : c.quantidade_inicial}
                    </TableCell>
                    <TableCell className="text-center text-sm">{c.quantidade_usada}</TableCell>
                    <TableCell className="text-center text-sm font-medium">
                      {c.ilimitado ? <InfinityIcon className="h-4 w-4 inline" /> : restante}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.data_validade
                        ? new Date(c.data_validade + "T12:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={aberto ? "text-primary" : "text-muted-foreground"}
                        title="Histórico de utilização"
                        onClick={() => setHistoricoId(aberto ? null : c.id)}
                      >
                        <History className="w-4 h-4" />
                      </Button>
                    </TableCell>
                    {isCoordAdmin && (
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Desativar este crédito?")) deleteMutation.mutate(c.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {aberto && (
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableCell colSpan={isCoordAdmin ? 8 : 7} className="p-0">
                        <CreditoHistorico creditoId={c.id} />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Crédito Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Atividade</Label>
              <Select value={form.atividade} onValueChange={(v) => setForm({ ...form, atividade: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione a atividade" /></SelectTrigger>
                <SelectContent>
                  {ATIVIDADES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  disabled={form.ilimitado}
                  value={form.quantidade_inicial}
                  onChange={(e) => setForm({ ...form, quantidade_inicial: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Validade (opcional)</Label>
                <Input
                  type="date"
                  value={form.data_validade}
                  onChange={(e) => setForm({ ...form, data_validade: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ilimitado}
                onChange={(e) => setForm({ ...form, ilimitado: e.target.checked })}
              />
              Crédito ilimitado
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              disabled={saveMutation.isPending || !form.atividade}
              onClick={() => saveMutation.mutate()}
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TIPO_LABEL: Record<string, string> = {
  compra: "Compra",
  consumo: "Consumo",
  estorno: "Estorno",
  ajuste: "Ajuste",
};

function CreditoHistorico({ creditoId }: { creditoId: string }) {
  const { data: movimentos = [], isLoading } = useQuery({
    queryKey: ["creditos_movimentos", creditoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos_movimentos")
        .select("*")
        .eq("credito_id", creditoId)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const agendaIds = Array.from(
    new Set((movimentos as any[]).map((m) => m.agenda_id).filter(Boolean))
  ) as string[];

  const { data: agendaMap = {} } = useQuery({
    queryKey: ["creditos_movimentos_agendas", creditoId, agendaIds.join(",")],
    enabled: agendaIds.length > 0,
    queryFn: async () => {
      const [ag, pres] = await Promise.all([
        supabase
          .from("agenda_servicos")
          .select("id, data_especifica, horario_inicio, atividade, local")
          .in("id", agendaIds),
        supabase
          .from("agenda_presencas")
          .select("agenda_id, data, comparecimento")
          .in("agenda_id", agendaIds),
      ]);

      const presMap: Record<string, string> = {};
      (pres.data || []).forEach((p: any) => {
        if (!p.comparecimento) return;
        if (!presMap[p.agenda_id] || p.data > presMap[p.agenda_id]) {
          presMap[p.agenda_id] = p.data;
        }
      });

      const map: Record<string, { dataSessao: string | null; horario: string | null; presente: boolean }> = {};
      (ag.data || []).forEach((a: any) => {
        map[a.id] = {
          dataSessao: presMap[a.id] || a.data_especifica || null,
          horario: a.horario_inicio ? String(a.horario_inicio).slice(0, 5) : null,
          presente: !!presMap[a.id],
        };
      });
      return map;
    },
  });

  const linhas = (movimentos as any[])
    .map((m) => {
      const info = m.agenda_id ? (agendaMap as any)[m.agenda_id] : undefined;
      const dataSessao: string | null = info?.dataSessao ?? null;
      return {
        ...m,
        dataSessao,
        horario: info?.horario ?? null,
        presente: !!info?.presente,
        dataEfetiva: dataSessao ? new Date(dataSessao + "T12:00:00") : new Date(m.data),
      };
    })
    .sort((a, b) => b.dataEfetiva.getTime() - a.dataEfetiva.getTime());

  return (
    <div className="px-4 py-3 space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">Histórico de utilização</p>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : linhas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum movimento registrado.</p>
      ) : (
        linhas.map((m: any) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border/30 last:border-0"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-foreground">
                {m.dataEfetiva.toLocaleDateString("pt-BR")}
                {m.dataSessao && m.horario ? ` ${m.horario}` : ""}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  m.tipo === "consumo"
                    ? "border-destructive/40 text-destructive"
                    : m.tipo === "compra"
                      ? "border-success/40 text-success"
                      : "border-border text-muted-foreground"
                }`}
              >
                {TIPO_LABEL[m.tipo] ?? m.tipo}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {m.agenda_id ? "Agenda" : "Manual"}
              </Badge>
              {m.presente && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/40 text-success">
                  Presente
                </Badge>
              )}
              {m.observacao && <span className="text-muted-foreground">{m.observacao}</span>}
              {m.dataSessao && (
                <span className="text-[10px] text-muted-foreground/70">
                  lançado em {new Date(m.data).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <span className="text-foreground font-medium whitespace-nowrap">
              {m.tipo === "consumo" ? "-" : "+"}
              {m.quantidade}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

