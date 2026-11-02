// Clube sem níveis (lote 3): plano do aluno, marco de recompensa e semanas cumpridas.
// Multiplicadores vêm do banco (clube_config via fn_clube_meu_plano); nada fixo aqui.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChavePlanoClube = "start" | "power" | "pro" | "consultoria" | "agregador";

export interface MeuPlanoClube {
  chave: ChavePlanoClube;
  plano: string;
  multiplicador: number;
  agregador: boolean;
  meta_semanal: number;
  semanas_seguidas: number;
  tem_plano: boolean;
  multiplicadores?: Record<string, number>;
  clima_multiplicador?: number | null;
}

export function useMeuPlanoClube(enabled: boolean) {
  return useQuery({
    queryKey: ["portal-clube-meu-plano"],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("fn_clube_meu_plano");
      if (error) throw error;
      return (data ?? null) as MeuPlanoClube | null;
    },
  });
}

/** Selo só para Start, Power e Pro (VIP já chega como Pro). */
export function seloDoPlano(chave?: string | null): "start" | "power" | "pro" | null {
  return chave === "start" || chave === "power" || chave === "pro" ? chave : null;
}

interface RecompensaCusto { custo_pontos: number; custo_start?: number | null; custo_agregador?: number | null }

/** Custo igual para Start, Power e Pro; agregador paga 30% a mais (mesma regra de fn_clube_resgatar). */
export function custoRecompensa(r: RecompensaCusto, agregador: boolean): number {
  const base = r.custo_start ?? r.custo_pontos;
  return agregador ? (r.custo_agregador ?? Math.round(base * 1.3)) : base;
}

/** Recompensa ativa mais barata ainda não alcançada pelo saldo. */
export function proximoMarco<T extends RecompensaCusto>(saldo: number, recompensas: T[], agregador: boolean) {
  const ordenadas = recompensas
    .map((r) => ({ r, custo: custoRecompensa(r, agregador) }))
    .filter((x) => x.custo > saldo)
    .sort((a, b) => a.custo - b.custo);
  const alvo = ordenadas[0];
  if (!alvo) return null;
  return { recompensa: alvo.r, custo: alvo.custo, faltam: alvo.custo - saldo, progresso: Math.max(0, Math.min(100, Math.round((saldo / alvo.custo) * 100))) };
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Segunda-feira da semana de uma data (aaaa-mm-dd). */
export function segundaDaSemana(dataIso: string): string {
  const [y, m, d] = dataIso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dia = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dia);
  return isoLocal(dt);
}

/** Últimas `n` semanas fechadas (antes da semana atual), da mais antiga à mais recente. */
export function ultimasSemanas(datasRealizadas: string[], meta: number, hojeIso: string, n = 12) {
  const contagem = new Map<string, number>();
  for (const d of datasRealizadas) {
    const s = segundaDaSemana(d);
    contagem.set(s, (contagem.get(s) ?? 0) + 1);
  }
  const atual = segundaDaSemana(hojeIso);
  const [y, m, d] = atual.split("-").map(Number);
  const out: { inicio: string; treinos: number; cumprida: boolean }[] = [];
  for (let i = n; i >= 1; i--) {
    const dt = new Date(y, m - 1, d - 7 * i);
    const inicio = isoLocal(dt);
    const treinos = contagem.get(inicio) ?? 0;
    out.push({ inicio, treinos, cumprida: treinos >= Math.max(1, meta) });
  }
  return out;
}

export const EXPLICACAO_BADGE: Record<string, string> = {
  "Primeiro Passo": "Concedida ao concluir seu primeiro treino na Fortem.",
  "Mês Completo": "Concedida ao treinar nas 4 semanas seguidas de um mesmo mês.",
  "8 Semanas Seguidas": "Concedida ao cumprir a frequência semanal do seu plano por 8 semanas seguidas.",
  "Veterano": "Concedida ao completar 1 ano de Fortem.",
  "Lenda FORTEM": "Concedida ao completar 2 anos de Fortem.",
  "Embaixador FORTEM": "Concedida ao indicar 3 pessoas que se tornaram alunos.",
  "Evolução Real": "Concedida quando o resultado de uma reavaliação melhora em relação à anterior.",
  "Guerreiro da Chuva": "Concedida ao treinar em um dia de chuva forte, frio ou calor extremo.",
};
