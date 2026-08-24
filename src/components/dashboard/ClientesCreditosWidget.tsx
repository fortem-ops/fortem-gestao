import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { creditoAtivo, creditoDisponivel } from "@/lib/creditos-calc";
import { saldoDetalhadoPorAtividade, type ConsumoServico, type CreditoAlunoRow } from "@/lib/creditosServicos";

interface Props {
  /** Atividades de crédito a exibir. Vazio/omitido = todas. */
  atividades?: string[];
}

interface Linha {
  id: string;
  alunoId: string;
  nome: string;
  atividade: string;
  restante: number;
  ilimitado: boolean;
  origem: "Plano" | "Avulso";
}

const chunk = <T,>(arr: T[], size = 300): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export function ClientesCreditosWidget({ atividades }: Props) {
  const navigate = useNavigate();
  const filtro = atividades && atividades.length ? atividades : null;

  const { data = [] } = useQuery({
    queryKey: ["dashboard-clientes-creditos", filtro?.join(",") ?? "todas"],
    queryFn: async (): Promise<Linha[]> => {
      // 1) Créditos avulsos/manuais (ledger)
      const { data: credRows, error: credErr } = await supabase
        .from("creditos_aluno")
        .select(
          "id, aluno_id, atividade, quantidade_inicial, quantidade_usada, ilimitado, data_validade, ativo, alunos(nome)",
        )
        .eq("ativo", true);
      if (credErr) throw credErr;

      const creditosValidos = ((credRows || []) as any[]).filter((c) => creditoAtivo(c));

      const nomes: Record<string, string> = {};
      const ledgerPorAluno: Record<string, CreditoAlunoRow[]> = {};
      for (const c of creditosValidos) {
        if (c.alunos?.nome) nomes[c.aluno_id] = c.alunos.nome;
        (ledgerPorAluno[c.aluno_id] ||= []).push(c as CreditoAlunoRow);
      }

      // 2) Serviços inclusos em planos ativos
      const { data: planoRows, error: planoErr } = await supabase
        .from("planos")
        .select("id, aluno_id, servicos, alunos(nome)")
        .eq("ativo", true);
      if (planoErr) throw planoErr;

      const planos = (planoRows || []) as any[];
      for (const p of planos) if (p.alunos?.nome) nomes[p.aluno_id] = p.alunos.nome;

      const planoIds = planos.map((p) => p.id as string);
      const consumos: ConsumoServico[] = [];
      await Promise.all(
        chunk(planoIds).map(async (part) => {
          if (!part.length) return;
          const { data, error } = await supabase
            .from("consumo_servicos")
            .select("plano_id, tipo_servico, tipo_registro, quantidade, agenda_id")
            .in("plano_id", part);
          if (error) throw error;
          consumos.push(...((data || []) as any[]));
        }),
      );

      const consumosPorPlano: Record<string, ConsumoServico[]> = {};
      for (const c of consumos as any[]) (consumosPorPlano[c.plano_id] ||= []).push(c);

      const planoPorAluno: Record<string, any[]> = {};
      for (const p of planos) (planoPorAluno[p.aluno_id] ||= []).push(p);

      // 3) Consolidação por aluno (ledger tem prioridade sobre o cálculo do plano)
      const alunoIds = new Set<string>([
        ...Object.keys(ledgerPorAluno),
        ...Object.keys(planoPorAluno),
      ]);

      const linhas: Linha[] = [];
      for (const alunoId of alunoIds) {
        const planosDoAluno = planoPorAluno[alunoId] ?? [];
        const servicosPlano = planosDoAluno.flatMap((p) => (p.servicos as string[]) || []);
        const consumosDoAluno = planosDoAluno.flatMap((p) => consumosPorPlano[p.id] ?? []);
        const ledger = ledgerPorAluno[alunoId] ?? [];

        const mapa = saldoTotalPorAtividade(servicosPlano, consumosDoAluno, ledger);
        const temLedger = new Set(ledger.map((l) => l.atividade));

        for (const [atividade, info] of Object.entries(mapa)) {
          if (filtro && !filtro.includes(atividade)) continue;
          const ilimitado = info.ilimitado;
          const restante = Number.isFinite(info.saldo) ? info.saldo : 0;
          if (!ilimitado && restante <= 0) continue;
          linhas.push({
            id: `${alunoId}-${atividade}`,
            alunoId,
            nome: nomes[alunoId] || "Cliente",
            atividade,
            restante,
            ilimitado,
            origem: temLedger.has(atividade) ? "Avulso" : "Plano",
          });
        }
      }

      return linhas.sort((a, b) => a.nome.localeCompare(b.nome) || a.atividade.localeCompare(b.atividade));
    },
    staleTime: 60_000,
  });

  const totalClientes = new Set(data.map((l) => l.alunoId)).size;

  return (
    <div className="glass-card rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
          <Ticket className="w-4 h-4 text-primary" />
          Clientes com créditos disponíveis
        </h3>
        <span className="text-xs text-muted-foreground">{totalClientes} cliente(s)</span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente com crédito disponível</p>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
          {data.map((l) => (
            <button
              key={l.id}
              onClick={() => navigate(`/alunos/${l.alunoId}`)}
              className="w-full text-left flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/30 transition-colors"
            >
              <span className="min-w-0">
                <span className="block text-sm text-foreground truncate">{l.nome}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {l.atividade}
                  <span className="ml-1.5 rounded border border-border px-1 py-px text-[10px] uppercase tracking-wide">
                    {l.origem}
                  </span>
                </span>
              </span>
              <span className="text-sm font-semibold text-primary whitespace-nowrap">
                {l.ilimitado ? "ilimitado" : l.restante}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
