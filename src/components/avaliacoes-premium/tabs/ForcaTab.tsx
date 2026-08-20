import { FORCA_EXERCICIO_LABEL } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { FuncionalSnapshot } from "../useAlunoAvaliacoesConsolidadas";
import { PremiumKinologyImport } from "../PremiumKinologyImport";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useMemo } from "react";
import { format, parseISO, differenceInYears } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Movimentos com % Referência Kinology temporariamente suprimido: a tabela de
// referência da Kinology para joelho está sistematicamente ~2-2.7x abaixo da
// média real medida na base Fortem (amostra n>180 por lado), indicando possível
// diferença de protocolo de teste. Suprimido até confirmação com a Kinology.
const KINOLOGY_PCT_SUPRIMIDO = new Set(["extensao_joelho", "flexao_joelho"]);

interface Props {
  alunoId: string;
  latest: FuncionalSnapshot | null;
  history: FuncionalSnapshot[];
  aluno?: { sexo: string | null; data_nascimento: string | null } | null;
}

function classFromDiff(diff: number): { label: string; cls: string } {
  if (diff < 10) return { label: "BAIXO", cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" };
  if (diff < 20) return { label: "ATENÇÃO", cls: "text-amber-600 bg-amber-500/10 border-amber-500/30" };
  return { label: "ALTO", cls: "text-rose-600 bg-rose-500/10 border-rose-500/30" };
}

export function ForcaTab({ alunoId, latest, history, aluno }: Props) {
  const exercicios = latest?.forca ?? [];

  const sexoRpc: "M" | "F" | null =
    aluno?.sexo?.toLowerCase().startsWith("m") ? "M" :
    aluno?.sexo?.toLowerCase().startsWith("f") ? "F" : null;
  const idadeRpc: number | null = aluno?.data_nascimento
    ? differenceInYears(new Date(), parseISO(aluno.data_nascimento))
    : null;

  const { data: comparativos } = useQuery({
    queryKey: ["forca-comparativo", latest?.data, sexoRpc, idadeRpc, exercicios.map((e) => e.nome).join(",")],
    enabled: !!sexoRpc && idadeRpc !== null && exercicios.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        exercicios.map(async (ex) => {
          const valorMedio = (ex.direito_kg + ex.esquerdo_kg) / 2;
          const { data, error } = await supabase.rpc("fn_forca_comparativo", {
            p_movimento: ex.nome,
            p_sexo: sexoRpc,
            p_idade: idadeRpc,
            p_valor_kgf: valorMedio,
          });
          if (error) {
            console.error("fn_forca_comparativo error", ex.nome, error);
            return [ex.nome, null] as const;
          }
          return [ex.nome, data?.[0] ?? null] as const;
        }),
      );
      return Object.fromEntries(results) as Record<
        string,
        { kinology_media_kgf: number | null; kinology_pct: number | null; fortem_percentil: number | null; fortem_n: number; fortem_disponivel: boolean } | null
      >;
    },
  });

  // Histórico de assimetria por exercício
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    [...history].reverse().forEach((snap) => {
      const k = snap.data;
      const row: Record<string, number | string> = { data: format(parseISO(k), "dd/MM/yy") };
      snap.forca.forEach((ex) => {
        const max = Math.max(ex.direito_kg, ex.esquerdo_kg);
        if (max > 0) {
          const diff = (Math.abs(ex.direito_kg - ex.esquerdo_kg) / max) * 100;
          row[FORCA_EXERCICIO_LABEL[ex.nome] ?? ex.nome] = Number(diff.toFixed(1));
        }
      });
      byDate.set(k, row);
    });
    return Array.from(byDate.values());
  }, [history]);

  const series = useMemo(() => {
    const names = new Set<string>();
    history.forEach((s) => s.forca.forEach((ex) => names.add(FORCA_EXERCICIO_LABEL[ex.nome] ?? ex.nome)));
    return Array.from(names);
  }, [history]);

  const palette = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#06b6d4", "#84cc16"];

  return (
    <div className="space-y-4">
      <PremiumKinologyImport alunoId={alunoId} />

      <AvaliacaoDeleteList alunoId={alunoId} mode="forca" />

      {exercicios.length === 0 ? (
        <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
          Nenhuma dinamometria importada ainda. Use o botão acima para importar o laudo Kinology.
        </div>
      ) : (
      <>
      <div className="bio-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--bio-line))] flex items-center justify-between">
          <h3 className="bio-heading text-base">Principais Assimetrias de Força</h3>
          <span className="bio-label">Dinamometria · {format(parseISO(latest!.data), "dd/MM/yyyy")}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[hsl(var(--bio-ink-muted))]">
              <th className="text-left p-3 font-medium text-xs">Exercício</th>
              <th className="text-center p-3 font-medium text-xs w-24">Direito</th>
              <th className="text-center p-3 font-medium text-xs w-24">Esquerdo</th>
              <th className="text-center p-3 font-medium text-xs w-28">Assimetria</th>
              <th className="text-center p-3 font-medium text-xs w-24">Risco</th>
              <th className="text-center p-3 font-medium text-xs w-32">% Referência</th>
              <th className="text-center p-3 font-medium text-xs w-32">Percentil Fortem</th>
            </tr>
          </thead>
          <tbody>
            {exercicios.map((ex) => {
              const max = Math.max(ex.direito_kg, ex.esquerdo_kg);
              const diff = max > 0 ? (Math.abs(ex.direito_kg - ex.esquerdo_kg) / max) * 100 : 0;
              const c = classFromDiff(diff);
              return (
                <tr key={ex.nome} className="border-t border-[hsl(var(--bio-line))]">
                  <td className="p-3 text-[hsl(var(--bio-ink))]">{FORCA_EXERCICIO_LABEL[ex.nome] ?? ex.nome}</td>
                  <td className="p-3 text-center text-[hsl(var(--bio-ink))]">{ex.direito_kg.toFixed(1)} kg</td>
                  <td className="p-3 text-center text-[hsl(var(--bio-ink))]">{ex.esquerdo_kg.toFixed(1)} kg</td>
                  <td className="p-3 text-center font-semibold">
                    <span className={diff >= 20 ? "text-rose-600" : diff >= 10 ? "text-amber-600" : "text-emerald-600"}>
                      {diff.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.cls}`}>
                      {c.label}
                    </span>
                  </td>
                  <td className="p-3 text-center text-[hsl(var(--bio-ink-muted))]">
                    {KINOLOGY_PCT_SUPRIMIDO.has(ex.nome) ? (
                      <span title="Protocolo em validação com a Kinology">—</span>
                    ) : comparativos?.[ex.nome]?.kinology_pct != null ? (
                      `${comparativos[ex.nome]!.kinology_pct}%`
                    ) : (
                      "Sem referência"
                    )}
                  </td>
                  <td className="p-3 text-center text-[hsl(var(--bio-ink-muted))]">
                    {comparativos?.[ex.nome]?.fortem_disponivel ? (
                      `Percentil ${comparativos[ex.nome]!.fortem_percentil}`
                    ) : (
                      `Base insuficiente (n=${comparativos?.[ex.nome]?.fortem_n ?? 0})`
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {chartData.length >= 2 && (
        <div className="bio-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="bio-heading text-base">Evolução da Assimetria</h3>
            <span className="bio-label">% por exercício</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 86%)" />
              <XAxis dataKey="data" stroke="hsl(220 12% 45%)" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(220 12% 45%)" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 14% 86%)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      </>
      )}
    </div>
  );
}
