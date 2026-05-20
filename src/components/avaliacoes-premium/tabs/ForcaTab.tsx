import { FORCA_EXERCICIO_LABEL } from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import type { FuncionalSnapshot } from "../useAlunoAvaliacoesConsolidadas";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { useMemo } from "react";
import { format, parseISO } from "date-fns";

interface Props {
  latest: FuncionalSnapshot | null;
  history: FuncionalSnapshot[];
}

function classFromDiff(diff: number): { label: string; cls: string } {
  if (diff < 10) return { label: "BAIXO", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (diff < 20) return { label: "ATENÇÃO", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  return { label: "ALTO", cls: "text-rose-300 bg-rose-500/10 border-rose-500/30" };
}

export function ForcaTab({ latest, history }: Props) {
  const exercicios = latest?.forca ?? [];

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

  if (exercicios.length === 0) {
    return (
      <div className="bio-card p-8 text-center text-white/55 text-sm">
        Nenhuma dinamometria importada. Use o módulo Avaliações para fazer upload do laudo Kinology.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bio-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="bio-heading text-base">Principais Assimetrias de Força</h3>
          <span className="bio-label">Dinamometria · {format(parseISO(latest!.data), "dd/MM/yyyy")}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/55">
              <th className="text-left p-3 font-medium text-xs">Exercício</th>
              <th className="text-center p-3 font-medium text-xs w-24">Direito</th>
              <th className="text-center p-3 font-medium text-xs w-24">Esquerdo</th>
              <th className="text-center p-3 font-medium text-xs w-28">Assimetria</th>
              <th className="text-center p-3 font-medium text-xs w-24">Risco</th>
            </tr>
          </thead>
          <tbody>
            {exercicios.map((ex) => {
              const max = Math.max(ex.direito_kg, ex.esquerdo_kg);
              const diff = max > 0 ? (Math.abs(ex.direito_kg - ex.esquerdo_kg) / max) * 100 : 0;
              const c = classFromDiff(diff);
              return (
                <tr key={ex.nome} className="border-t border-white/5">
                  <td className="p-3 text-white/85">{FORCA_EXERCICIO_LABEL[ex.nome] ?? ex.nome}</td>
                  <td className="p-3 text-center text-white/80">{ex.direito_kg.toFixed(1)} kg</td>
                  <td className="p-3 text-center text-white/80">{ex.esquerdo_kg.toFixed(1)} kg</td>
                  <td className="p-3 text-center font-semibold">
                    <span className={diff >= 20 ? "text-rose-300" : diff >= 10 ? "text-amber-300" : "text-emerald-300"}>
                      {diff.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.cls}`}>
                      {c.label}
                    </span>
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="data" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
