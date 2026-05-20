import { useMemo } from "react";
import type { ConsolidadoAluno } from "../useAlunoAvaliacoesConsolidadas";
import { computePremiumScores } from "../scoringPremium";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format, parseISO } from "date-fns";

interface Props {
  data: ConsolidadoAluno;
}

export function EvolucaoTab({ data }: Props) {
  // Combina funcional + composição mais próximas por data e calcula Índice Fortem ao longo do tempo
  const series = useMemo(() => {
    const dates = new Set<string>();
    data.funcional.history.forEach((f) => dates.add(f.data));
    data.composicao.history.forEach((c) => dates.add(c.data));
    return Array.from(dates).sort().map((dt) => {
      const f = data.funcional.history.find((x) => x.data === dt) ?? null;
      const c = data.composicao.history.find((x) => x.data === dt) ?? null;
      const s = computePremiumScores(f, c);
      return {
        data: format(parseISO(dt), "dd/MM/yy"),
        indice: s.indiceFortem,
        mobilidade: s.mobilidade,
        forca: s.forca,
        composicao: s.composicao,
      };
    });
  }, [data]);

  if (series.length < 2) {
    return (
      <div className="bio-card p-8 text-center text-white/55 text-sm">
        Necessário pelo menos 2 avaliações para visualizar a evolução histórica.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bio-card p-5">
        <h3 className="bio-heading text-base mb-3">Evolução do Índice Funcional FORTEM</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
            <XAxis dataKey="data" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
            <YAxis stroke="hsl(0 0% 100% / 0.4)" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="indice" name="Índice Fortem" stroke="hsl(0 84% 60%)" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="mobilidade" name="Mobilidade" stroke="hsl(var(--sev-medium))" strokeWidth={2} />
            <Line type="monotone" dataKey="forca" name="Força" stroke="hsl(var(--sev-good))" strokeWidth={2} />
            <Line type="monotone" dataKey="composicao" name="Composição" stroke="hsl(var(--sev-attention))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bio-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h3 className="bio-heading text-base">Timeline de Avaliações</h3>
        </div>
        <ul className="divide-y divide-white/5">
          {data.raw.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="text-white/85 capitalize">{r.tipo.replace(/_/g, " ")}</p>
                {r.observacoes && <p className="text-[11px] text-white/45 line-clamp-1">{r.observacoes}</p>}
              </div>
              <span className="text-xs text-white/55">
                {format(parseISO(r.data), "dd/MM/yyyy")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
