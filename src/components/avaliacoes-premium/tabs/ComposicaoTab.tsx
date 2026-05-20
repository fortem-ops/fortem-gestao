import { useMemo } from "react";
import type { ComposicaoSnapshot } from "../useAlunoAvaliacoesConsolidadas";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Bar, BarChart } from "recharts";
import { format, parseISO } from "date-fns";

interface Props {
  latest: ComposicaoSnapshot | null;
  history: ComposicaoSnapshot[];
}

export function ComposicaoTab({ latest, history }: Props) {
  const evol = useMemo(
    () =>
      [...history].reverse().map((c) => ({
        data: format(parseISO(c.data), "dd/MM/yy"),
        gordura: Number(c.bf.toFixed(1)),
        magra: c.massaMagra ? Number(c.massaMagra.toFixed(1)) : null,
        peso: c.peso,
      })),
    [history],
  );

  if (!latest) {
    return (
      <div className="bio-card p-8 text-center text-white/55 text-sm">
        Nenhuma composição corporal (Pollock) registrada.
      </div>
    );
  }

  const dobrasArr = Object.entries(latest.dobras).map(([k, v]) => ({
    name: k,
    valor: Number(v),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bio-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="bio-heading text-base">Composição Atual</h3>
          <span className="bio-label">{format(parseISO(latest.data), "dd/MM/yyyy")}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="% Gordura" value={`${latest.bf.toFixed(1)}%`} sub={latest.classificacao} tone="warn" />
          <Stat label="Massa Magra" value={latest.massaMagra ? `${latest.massaMagra.toFixed(1)} kg` : "—"} tone="good" />
          <Stat label="Massa Gorda" value={latest.massaGorda ? `${latest.massaGorda.toFixed(1)} kg` : "—"} tone="risk" />
          <Stat label="IMC" value={latest.imc ? latest.imc.toFixed(1) : "—"} />
          <Stat label="Peso" value={`${latest.peso} kg`} />
          <Stat label="Σ 7 Dobras" value={`${latest.sigma7.toFixed(1)} mm`} />
        </div>
      </div>

      <div className="bio-card p-5">
        <h3 className="bio-heading text-base mb-3">Distribuição das Dobras (mm)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dobrasArr}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
            <XAxis dataKey="name" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 10 }} />
            <YAxis stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
            <Bar dataKey="valor" fill="hsl(var(--sev-attention))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {evol.length >= 2 && (
        <div className="bio-card p-5 lg:col-span-2">
          <h3 className="bio-heading text-base mb-3">Evolução</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={evol}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 100% / 0.06)" />
              <XAxis dataKey="data" stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
              <YAxis stroke="hsl(0 0% 100% / 0.4)" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(220 18% 12%)", border: "1px solid hsl(0 0% 100% / 0.1)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="gordura" name="% Gordura" stroke="hsl(var(--sev-attention))" strokeWidth={2} />
              <Line type="monotone" dataKey="magra" name="Massa Magra (kg)" stroke="hsl(var(--sev-good))" strokeWidth={2} />
              <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="hsl(var(--sev-medium))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "risk" }) {
  const toneCls = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "risk" ? "text-rose-300" : "text-white/90";
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-3 text-center">
      <p className="bio-label">{label}</p>
      <p className={`text-lg bio-heading mt-1 ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/50 mt-0.5">{sub}</p>}
    </div>
  );
}
