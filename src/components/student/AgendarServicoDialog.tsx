import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryPlanoPrincipalAtivo } from "@/lib/planoPrincipal";
import { saldoTotalPorAtividade, SERVICOS_PLANO } from "@/lib/creditosServicos";
import { horariosLivresNoDia, podeSelecionarMais, saldoRestante, type HorarioGrade } from "@/lib/horariosLivresServico";
import { X } from "lucide-react";

const ERROS: Record<string, string> = {
  sem_creditos: "O aluno não tem créditos disponíveis para este serviço.",
  sem_vaga: "Esse horário acabou de ser reservado. Escolha outro.",
  horario_passado: "Esse horário já passou. Escolha outro.",
  horario_invalido: "Horário indisponível.",
  nao_autorizado: "Você não tem permissão para agendar pelo perfil do aluno.",
  aluno_nao_encontrado: "Aluno não encontrado.",
};

const DIAS = 21;

export function AgendarServicoDialog({ alunoId, open, onOpenChange }: { alunoId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [servico, setServico] = useState<string>("");
  const [dia, setDia] = useState<string>("");
  const [selecionados, setSelecionados] = useState<{ dia: string; horarioId: string; h: HorarioGrade }[]>([]);

  const dias = useMemo(() => Array.from({ length: DIAS }, (_, i) => addDays(new Date(), i)), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const inicio = format(dias[0], "yyyy-MM-dd");
  const fim = format(dias[dias.length - 1], "yyyy-MM-dd");

  const { data: saldos = {} } = useQuery({
    queryKey: ["equipe-agendar-saldos", alunoId, open],
    enabled: open,
    queryFn: async () => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const [{ data: plano }, { data: creditos }] = await Promise.all([
        queryPlanoPrincipalAtivo(alunoId, "id, servicos"),
        supabase.from("creditos_aluno").select("atividade, quantidade_inicial, quantidade_usada, ilimitado, data_validade, origem_tipo")
          .eq("aluno_id", alunoId).eq("ativo", true).neq("atividade", "Treino"),
      ]);
      const p = plano as any;
      let consumos: any[] = [];
      if (p?.id) {
        const { data } = await supabase.from("consumo_servicos").select("tipo_servico, tipo_registro, quantidade, agenda_id")
          .eq("aluno_id", alunoId).eq("plano_id", p.id);
        consumos = data || [];
      }
      const cred = ((creditos as any[]) || []).filter((c) => !c.data_validade || c.data_validade >= hoje);
      return saldoTotalPorAtividade(p?.servicos ?? [], consumos, cred);
    },
  });

  const opcoes = useMemo(() => {
    const set = new Set<string>([...SERVICOS_PLANO.map((s) => s.label), ...Object.keys(saldos)]);
    return Array.from(set).map((a) => ({ atividade: a, ...(saldos[a] ?? { saldo: 0, ilimitado: false }) }))
      .filter((o) => o.ilimitado || o.saldo > 0);
  }, [saldos]);

  const { data: grade = [] } = useQuery({
    queryKey: ["equipe-agendar-grade", servico],
    enabled: open && !!servico,
    queryFn: async () => {
      const { data } = await supabase.from("agenda_servicos")
        .select("id, horario_inicio, horario_fim, dia_semana, data_especifica, profissional_id, local")
        .eq("atividade", servico).is("aluno_id", null);
      return (data || []) as HorarioGrade[];
    },
  });

  const profIds = useMemo(() => Array.from(new Set(grade.map((g) => g.profissional_id).filter(Boolean))) as string[], [grade]);

  const { data: extras } = useQuery({
    queryKey: ["equipe-agendar-ocupacao", servico, profIds, inicio, fim],
    enabled: open && profIds.length > 0,
    queryFn: async () => {
      const [res, exc, profs] = await Promise.all([
        supabase.from("agenda_servicos").select("profissional_id, data_especifica, horario_inicio")
          .not("aluno_id", "is", null).in("profissional_id", profIds).gte("data_especifica", inicio).lte("data_especifica", fim),
        supabase.from("agenda_servicos_excecoes").select("agenda_id, data_excecao")
          .in("agenda_id", grade.map((g) => g.id)).gte("data_excecao", inicio).lte("data_excecao", fim),
        supabase.from("profiles").select("user_id, full_name").in("user_id", profIds),
      ]);
      const nomes: Record<string, string> = {};
      for (const p of (profs.data as any[]) || []) nomes[p.user_id] = p.full_name;
      return { reservas: (res.data as any[]) || [], excecoes: (exc.data as any[]) || [], nomes };
    },
  });

  const porDia = useMemo(() => {
    const m: Record<string, HorarioGrade[]> = {};
    for (const d of dias) m[format(d, "yyyy-MM-dd")] = horariosLivresNoDia(d, grade, extras?.reservas ?? [], extras?.excecoes ?? []);
    return m;
  }, [dias, grade, extras]);

  const saldoSel = servico ? saldos[servico] : undefined;
  const ilim = !!saldoSel?.ilimitado;
  const saldoNum = saldoSel?.saldo ?? 0;
  const restante = saldoRestante(saldoNum, ilim, selecionados.length);
  const isSel = (d: string, id: string) => selecionados.some((s) => s.dia === d && s.horarioId === id);
  const toggle = (d: string, h: HorarioGrade) => {
    if (isSel(d, h.id)) setSelecionados((s) => s.filter((x) => !(x.dia === d && x.horarioId === h.id)));
    else if (podeSelecionarMais(saldoNum, ilim, selecionados.length)) setSelecionados((s) => [...s, { dia: d, horarioId: h.id, h }]);
  };

  const agendar = useMutation({
    mutationFn: async () => {
      const ordenados = [...selecionados].sort((a, b) => (a.dia + a.h.horario_inicio).localeCompare(b.dia + b.h.horario_inicio));
      const ok: string[] = [];
      const falhas: string[] = [];
      for (const s of ordenados) {
        const rotulo = `${format(new Date(s.dia + "T12:00:00"), "dd/MM")} ${s.h.horario_inicio.slice(0, 5)}`;
        try {
          const { data, error } = await supabase.rpc("fn_agendar_servico_equipe", {
            p_aluno_id: alunoId, p_agenda_servico_id: s.horarioId, p_data: s.dia,
          });
          if (error) throw error;
          const r = data as any;
          if (!r?.ok) throw new Error(r?.erro || "erro");
          ok.push(r.id);
        } catch (e: any) {
          falhas.push(`${rotulo} — ${ERROS[e.message] || "erro ao agendar"}`);
        }
      }
      return { ok, falhas };
    },
    onSuccess: ({ ok, falhas }) => {
      for (const id of ok) {
        supabase.functions.invoke("whatsapp-disparo-agenda", { body: { evento: "agendamento_criado", agenda_id: id } })
          .then(({ error }) => { if (error) toast.warning("Agendado, mas um WhatsApp ao profissional não foi enviado."); })
          .catch(() => toast.warning("Agendado, mas um WhatsApp ao profissional não foi enviado."));
      }
      qc.invalidateQueries();
      if (falhas.length === 0) {
        toast.success(`${ok.length} agendamento(s) feito(s)`, { description: `${ok.length} crédito(s) debitado(s).` });
        setSelecionados([]); setDia(""); setServico("");
        onOpenChange(false);
      } else {
        toast.error(`${ok.length} agendado(s), ${falhas.length} não agendado(s)`, { description: falhas.join("\n"), duration: 12000 });
        setSelecionados([]);
      }
    },
    onError: () => toast.error("Não foi possível agendar. Tente novamente."),
  });

  const diasComVaga = dias.filter((d) => (porDia[format(d, "yyyy-MM-dd")]?.length ?? 0) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar serviço</DialogTitle>
          <DialogDescription>Marque um ou mais horários livres nos próximos {DIAS} dias e confirme uma vez.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Select value={servico} onValueChange={(v) => { setServico(v); setDia(""); setSelecionados([]); }}>
              <SelectTrigger><SelectValue placeholder={opcoes.length ? "Escolha o serviço" : "Sem créditos de serviço"} /></SelectTrigger>
              <SelectContent>
                {opcoes.map((o) => (
                  <SelectItem key={o.atividade} value={o.atividade}>
                    {o.atividade} — {o.ilimitado ? "ilimitado" : `${o.saldo} crédito(s)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {servico && (
            <div className="space-y-1.5">
              <Label>Dia</Label>
              {diasComVaga.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário livre para {servico} nos próximos {DIAS} dias.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {diasComVaga.map((d) => {
                    const k = format(d, "yyyy-MM-dd");
                    const n = selecionados.filter((s) => s.dia === k).length;
                    return (
                      <Button key={k} type="button" size="sm" variant={dia === k ? "default" : "outline"} onClick={() => setDia(k)}>
                        {format(d, "EEE dd/MM", { locale: ptBR })}{n > 0 ? ` (${n})` : ""}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {dia && (
            <div className="space-y-1.5">
              <Label>Horários</Label>
              <div className="grid gap-2">
                {(porDia[dia] ?? []).map((h) => {
                  const sel = isSel(dia, h.id);
                  const bloq = !sel && !podeSelecionarMais(saldoNum, ilim, selecionados.length);
                  return (
                    <Button key={h.id} type="button" variant={sel ? "default" : "outline"} className="justify-between"
                      disabled={bloq} onClick={() => toggle(dia, h)}>
                      <span>{h.horario_inicio.slice(0, 5)}–{h.horario_fim.slice(0, 5)}</span>
                      <span className="text-xs opacity-80">{extras?.nomes[h.profissional_id ?? ""] ?? "Profissional"}{h.local ? ` · ${h.local}` : ""}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {selecionados.length > 0 && (
            <div className="space-y-1.5">
              <Label>Selecionados ({selecionados.length})</Label>
              <ul className="space-y-1">
                {[...selecionados].sort((a, b) => (a.dia + a.h.horario_inicio).localeCompare(b.dia + b.h.horario_inicio)).map((s) => (
                  <li key={s.dia + s.horarioId} className="flex items-center justify-between rounded border border-border px-2 py-1 text-sm">
                    <span>{format(new Date(s.dia + "T12:00:00"), "EEE dd/MM", { locale: ptBR })} · {s.h.horario_inicio.slice(0, 5)} · {extras?.nomes[s.h.profissional_id ?? ""] ?? "Profissional"}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label="Remover"
                      onClick={() => toggle(s.dia, s.h)}><X className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {saldoSel && (
            <p className="text-xs text-muted-foreground">
              Saldo de {servico}: {ilim ? "ilimitado" : `${saldoNum} crédito(s) → restam ${restante} após confirmar`}.
              {!ilim && restante === 0 && selecionados.length > 0 ? " Saldo esgotado nesta seleção." : ""}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={selecionados.length === 0 || agendar.isPending} onClick={() => agendar.mutate()}>
            {agendar.isPending ? "Agendando..." : `Confirmar ${selecionados.length || ""} agendamento${selecionados.length > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
