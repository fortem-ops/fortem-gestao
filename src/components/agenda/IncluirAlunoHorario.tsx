import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseMutation } from "@/hooks/useSupabaseMutation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toastError, toastSuccess } from "@/lib/toast-helpers";
import { AddAgendaDialog } from "@/components/agenda/AddAgendaDialog";

export type SaldoCreditosTreino = {
  ok: boolean;
  erro?: string;
  tipo?: "creditos" | "livre" | "agregadora" | "prospect";
  origem?: "ciclo" | "legado" | "nenhum";
  saldo?: number | null;
  total?: number | null;
  usados?: number | null;
  plano_nome?: string | null;
};

export type AlunoAgendavelEquipe = {
  id: string;
  nome: string;
  status: string;
  responsavel_id: string | null;
};

export function podeGerenciarAlunosHorario(roles?: { isAdmin?: boolean; isCoordAdmin?: boolean } | null): boolean {
  return Boolean(roles?.isAdmin || roles?.isCoordAdmin);
}

export function formatarSaldoCreditosTreino(info: SaldoCreditosTreino | null | undefined): {
  texto: string;
  alertaSemSaldo: boolean;
} {
  if (!info || !info.ok) {
    return { texto: "Não foi possível consultar os créditos", alertaSemSaldo: false };
  }
  if (info.tipo === "prospect") {
    return { texto: "Prospect · Treino Experimental", alertaSemSaldo: false };
  }
  if (info.tipo === "livre") {
    return { texto: "Plano Livre (não consome créditos)", alertaSemSaldo: false };
  }
  if (info.tipo === "agregadora") {
    return { texto: `Agregadora (${info.plano_nome || "Wellhub / TotalPass"})`, alertaSemSaldo: false };
  }
  const saldo = info.saldo ?? 0;
  const total = info.total ?? 0;
  if (total === 0 && saldo === 0) {
    return { texto: "0 créditos restantes (sem ciclo ativo)", alertaSemSaldo: true };
  }
  const sufixo = Math.abs(saldo) === 1 ? "crédito restante" : "créditos restantes";
  const planoSufixo = info.plano_nome ? ` · ${info.plano_nome}` : "";
  return {
    texto: `${saldo} ${sufixo}${total > 0 ? ` de ${total}` : ""}${planoSufixo}`,
    alertaSemSaldo: saldo <= 0,
  };
}

const ERROS_AGENDAMENTO: Record<string, string> = {
  sem_permissao: "Apenas Admin e Coordenador podem incluir alunos neste horário.",
  aluno_invalido: "Aluno inativo ou da equipe não pode ser agendado.",
  experimental_obrigatorio: "Para incluir um prospect, agende o Treino Experimental na Agenda de Serviços.",
  slot_invalido: "Horário inválido ou inativo.",
  dia_invalido: "Data não corresponde ao dia da semana deste horário.",
  ja_agendado_neste_horario: "Este aluno já está agendado neste horário.",
  sem_vagas: "Horário sem vagas disponíveis.",
};

interface Props {
  slotId: string;
  dataStr: string;
  horarioInicio: string;
  horarioFim: string;
  instrutorId?: string | null;
  lotado: boolean;
  alunosJaNoHorario: string[];
  onIncluded: () => void;
}

function parseHoraMinuto(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 8, minute: Number.isFinite(m) ? m : 0 };
}

export function IncluirAlunoHorario({
  slotId,
  dataStr,
  horarioInicio,
  horarioFim,
  instrutorId,
  lotado,
  alunosJaNoHorario,
  onIncluded,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [comboAberto, setComboAberto] = useState(false);
  const [alunoId, setAlunoId] = useState<string>("");
  const [experimentalAberto, setExperimentalAberto] = useState(false);

  const { data: alunosAtivos = [] } = useQuery({
    queryKey: ["alunos-ativos-agenda-treinos"],
    enabled: aberto,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_alunos_agendaveis_equipe");
      if (error) throw error;
      return (data ?? []) as AlunoAgendavelEquipe[];
    },
  });

  const alunosDisponiveis = useMemo(() => {
    const ja = new Set(alunosJaNoHorario);
    return alunosAtivos.filter((a) => !ja.has(a.id));
  }, [alunosAtivos, alunosJaNoHorario]);

  const grupoAlunos = useMemo(
    () => alunosDisponiveis.filter((a) => a.status === "ativo"),
    [alunosDisponiveis],
  );
  const grupoProspects = useMemo(
    () => alunosDisponiveis.filter((a) => a.status === "prospect"),
    [alunosDisponiveis],
  );

  const alunoSelecionado = useMemo(
    () => alunosDisponiveis.find((a) => a.id === alunoId) ?? null,
    [alunosDisponiveis, alunoId],
  );
  const ehProspect = alunoSelecionado?.status === "prospect";

  const { data: saldoInfo, isFetching: carregandoSaldo } = useQuery({
    queryKey: ["saldo-creditos-treino-aluno", alunoId],
    enabled: aberto && Boolean(alunoId) && !ehProspect,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_saldo_creditos_treino_aluno", {
        p_aluno_id: alunoId,
      });
      if (error) throw error;
      return data as SaldoCreditosTreino;
    },
  });

  const incluir = useSupabaseMutation({
    mutationFn: async (agendaServicoId?: string) => {
      const { data, error } = await supabase.rpc("fn_agendar_treino_equipe", {
        p_slot_id: slotId,
        p_data: dataStr,
        p_aluno_id: alunoId,
        p_ignorar_capacidade: true,
        ...(agendaServicoId ? { p_agenda_servico_id: agendaServicoId } : {}),
      });
      if (error) throw error;
      const res = data as { ok: boolean; erro?: string; credito_debitado?: boolean; creditos_restantes?: number | null };
      if (!res.ok) throw new Error(ERROS_AGENDAMENTO[res.erro ?? ""] || res.erro || "Falha ao incluir aluno");
      return res;
    },
    onSuccess: (res) => {
      const detalhe =
        res.credito_debitado && typeof res.creditos_restantes === "number"
          ? ` (${res.creditos_restantes} restante${Math.abs(res.creditos_restantes) === 1 ? "" : "s"})`
          : "";
      toastSuccess(`Aluno incluído no horário${detalhe}`);
      setAlunoId("");
      setAberto(false);
      onIncluded();
    },
    onError: (e: Error) => toastError(e.message),
  });

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" onClick={() => setAberto(true)}>
        <UserPlus className="w-3.5 h-3.5 mr-1" /> Incluir aluno
      </Button>
    );
  }

  const saldoResumo = ehProspect
    ? formatarSaldoCreditosTreino({ ok: true, tipo: "prospect" })
    : formatarSaldoCreditosTreino(saldoInfo);

  const inicioParsed = parseHoraMinuto(horarioInicio);
  const fimParsed = parseHoraMinuto(horarioFim);
  const experimentalPrefill = alunoSelecionado
    ? {
        date: new Date(`${dataStr}T12:00:00`),
        hour: inicioParsed.hour,
        minute: inicioParsed.minute,
        endHour: fimParsed.hour,
        endMinute: fimParsed.minute,
        atividade: "Treino Experimental",
        local: "Sala de Treinamento",
        alunoId: alunoSelecionado.id,
        profissionalId: alunoSelecionado.responsavel_id || instrutorId || undefined,
      }
    : null;

  return (
    <div className="w-full rounded-lg border bg-muted/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">Incluir aluno neste horário</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setAberto(false); setAlunoId(""); }}>
          Cancelar
        </Button>
      </div>

      <Popover open={comboAberto} onOpenChange={setComboAberto}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={comboAberto} className="w-full justify-between font-normal">
            <span className="truncate">{alunoSelecionado ? alunoSelecionado.nome : "Buscar aluno ou prospect..."}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Digite o nome do aluno ou prospect..." />
            <CommandList>
              <CommandEmpty>Nenhum aluno ou prospect encontrado.</CommandEmpty>
              {grupoAlunos.length > 0 && (
                <CommandGroup heading="Alunos">
                  {grupoAlunos.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={a.nome}
                      onSelect={() => {
                        setAlunoId(a.id);
                        setComboAberto(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", alunoId === a.id ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{a.nome}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {grupoProspects.length > 0 && (
                <CommandGroup heading="Prospects">
                  {grupoProspects.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={a.nome}
                      onSelect={() => {
                        setAlunoId(a.id);
                        setComboAberto(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", alunoId === a.id ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{a.nome}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {alunoId && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">{ehProspect ? "Tipo:" : "Créditos de treino:"}</span>
          {!ehProspect && carregandoSaldo ? (
            <span className="text-muted-foreground">Consultando...</span>
          ) : (
            <Badge variant={saldoResumo.alertaSemSaldo ? "destructive" : "secondary"} className="text-[11px]">
              {saldoResumo.texto}
            </Badge>
          )}
        </div>
      )}

      {lotado && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Horário lotado — a inclusão vai ultrapassar a capacidade.</span>
        </div>
      )}

      {alunoId && !carregandoSaldo && saldoResumo.alertaSemSaldo && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Aluno sem saldo positivo — você pode incluir mesmo assim.</span>
        </div>
      )}

      <Button
        size="sm"
        className="w-full"
        disabled={!alunoId || incluir.isPending}
        onClick={() => {
          if (ehProspect) {
            setExperimentalAberto(true);
          } else {
            incluir.mutate(undefined);
          }
        }}
      >
        {incluir.isPending
          ? "Incluindo..."
          : ehProspect
            ? "Agendar Treino Experimental"
            : "Confirmar inclusão"}
      </Button>

      {ehProspect && (
        <AddAgendaDialog
          open={experimentalAberto}
          onOpenChange={setExperimentalAberto}
          prefill={experimentalPrefill}
          onSaved={(inserted) => {
            incluir.mutate(inserted.id);
          }}
        />
      )}
    </div>
  );
}