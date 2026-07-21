import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Pin, Plus, Trash2, Pause, Play, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PLANOS_PERMITIDOS_ALUNO = ["Power", "Pro", "Max"];
const PLANOS_PERMITIDOS_STAFF = ["Power", "Pro", "Max", "Start", "Start+"];

interface Props {
  alunoId: string;
  planoTipo: string;
  frequenciaSemanal: number;
  isStaff?: boolean;
}

export function HorarioFixoManager({ alunoId, planoTipo, frequenciaSemanal, isStaff = false }: Props) {
  const qc = useQueryClient();
  const [adicionando, setAdicionando] = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState<string>("");
  const [diaSelecionado, setDiaSelecionado] = useState<number>(1);

  const podeGerenciar = isStaff
    ? PLANOS_PERMITIDOS_STAFF.includes(planoTipo)
    : PLANOS_PERMITIDOS_ALUNO.includes(planoTipo);

  const { data: horariosFixos = [], isLoading } = useQuery({
    queryKey: ["horarios-fixos", alunoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_horarios_fixos")
        .select("*, treino_slots(horario_inicio, horario_fim, capacidade_maxima)")
        .eq("aluno_id", alunoId)
        .eq("ativo", true)
        .order("dia_semana");
      return data || [];
    },
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["slots-dia-hf", diaSelecionado],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("treino_slots")
        .select("*")
        .eq("dia_semana", diaSelecionado)
        .eq("ativo", true)
        .order("horario_inicio");
      return data || [];
    },
  });

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!slotSelecionado) throw new Error("Selecione um horário");
      const slot = slots.find((s: any) => s.id === slotSelecionado);
      if (!slot) throw new Error("Slot inválido");

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("treino_horarios_fixos").insert({
        aluno_id: alunoId,
        slot_id: slotSelecionado,
        dia_semana: diaSelecionado,
        horario_inicio: slot.horario_inicio,
        horario_fim: slot.horario_fim,
        criado_por: isStaff ? "staff" : "aluno",
        created_by: user?.id,
      });
      if (error) throw error;
      await supabase.rpc("fn_processar_horarios_fixos");
    },
    onSuccess: () => {
      toast.success("Horário fixo configurado! Agendamentos criados para as próximas semanas.");
      qc.invalidateQueries({ queryKey: ["horarios-fixos"] });
      setAdicionando(false);
      setSlotSelecionado("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("treino_horarios_fixos")
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Horário fixo removido."); qc.invalidateQueries({ queryKey: ["horarios-fixos"] }); },
  });

  const pausar = useMutation({
    mutationFn: async ({ id, pausadoAte }: { id: string; pausadoAte: string | null }) => {
      const { error } = await (supabase as any)
        .from("treino_horarios_fixos")
        .update({ pausado_ate: pausadoAte, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Horário atualizado."); qc.invalidateQueries({ queryKey: ["horarios-fixos"] }); },
  });

  const limiteAtingido = horariosFixos.length >= frequenciaSemanal;

  if (!podeGerenciar && !isStaff) {
    return (
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="font-semibold text-sm">Horário Fixo</p>
          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">Exclusivo Power, Pro e Max</span>
        </div>
        <p className="text-xs text-muted-foreground">
          A partir do plano <strong>Power</strong>, o número de horários fixos segue sua frequência semanal contratada.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">Horário Fixo</p>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {horariosFixos.length}/{frequenciaSemanal} slots
          </span>
        </div>
        {!limiteAtingido && (
          <button
            onClick={() => setAdicionando(!adicionando)}
            className="flex items-center gap-1 text-xs font-semibold text-primary"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        )}
      </div>

      {adicionando && (
        <div className="border border-primary/20 rounded-xl p-3 space-y-3 bg-primary/5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Novo horário fixo</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Dia da semana</p>
              <select
                value={diaSelecionado}
                onChange={e => { setDiaSelecionado(parseInt(e.target.value)); setSlotSelecionado(""); }}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
              >
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Horário</p>
              <select
                value={slotSelecionado}
                onChange={e => setSlotSelecionado(e.target.value)}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
              >
                <option value="">Selecione...</option>
                {slots.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.horario_inicio.slice(0, 5)} → {s.horario_fim.slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAdicionando(false); setSlotSelecionado(""); }} className="flex-1 text-xs py-1.5 rounded-lg bg-muted text-foreground font-semibold">Cancelar</button>
            <button
              onClick={() => adicionar.mutate()}
              disabled={!slotSelecionado || adicionar.isPending}
              className="flex-1 text-xs py-1.5 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-50"
            >
              {adicionar.isPending ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Confirmar"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : horariosFixos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum horário fixo configurado.</p>
      ) : (
        <div className="space-y-2">
          {horariosFixos.map((hf: any) => {
            const pausado = hf.pausado_ate && new Date(hf.pausado_ate) >= new Date();
            return (
              <div key={hf.id} className={`flex items-center gap-3 p-3 rounded-xl border ${pausado ? "border-border bg-muted/20 opacity-60" : "border-border bg-card"}`}>
                <div className="text-center min-w-[36px]">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">{DIAS[hf.dia_semana]}</p>
                  <Pin className={`w-3.5 h-3.5 mx-auto mt-0.5 ${pausado ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {hf.horario_inicio?.slice(0, 5)} → {hf.horario_fim?.slice(0, 5)}
                  </p>
                  {pausado && (
                    <p className="text-[10px] text-warning">Pausado até {format(new Date(hf.pausado_ate), "dd/MM/yyyy")}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => pausar.mutate({
                      id: hf.id,
                      pausadoAte: pausado ? null : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
                    })}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"
                    title={pausado ? "Reativar" : "Pausar 30 dias"}
                  >
                    {pausado ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-warning" />}
                  </button>
                  <button
                    onClick={() => { if (confirm("Remover este horário fixo?")) remover.mutate(hf.id); }}
                    className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Horários fixos são reservados automaticamente toda semana dentro da janela de 30 dias.
      </p>
    </div>
  );
}
