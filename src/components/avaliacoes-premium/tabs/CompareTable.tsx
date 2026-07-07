import { ArrowDown, ArrowUp, Minus } from "lucide-react";

export interface CompareRow {
  label: string;
  a: number | string | null;
  b: number | string | null;
  /** true = maior é melhor (verde quando sobe); false = menor é melhor (verde quando desce). */
  higherIsBetter?: boolean;
  /** Se numérico, formatador para exibição. */
  format?: (v: number) => string;
  /** Sufixo simples (ex: "°", "kg", "%"). Ignorado se `format` for passado. */
  suffix?: string;
  /** Δ mínimo para considerar "estável" (não colore). Default: 0.5. */
  toleranciaEstavel?: number;
}

interface Props {
  titulo: string;
  labelA: string;
  labelB: string;
  rows: CompareRow[];
  emptyMessage?: string;
}

function fmt(v: CompareRow["a"], row: CompareRow): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") return v;
  if (row.format) return row.format(v);
  return `${Number(v).toFixed(1)}${row.suffix ?? ""}`;
}

export function CompareTable({ titulo, labelA, labelB, rows, emptyMessage }: Props) {
  const usable = rows.filter((r) => r.a !== null || r.b !== null);

  if (usable.length === 0) {
    return (
      <div className="bio-card p-5">
        <h3 className="bio-heading text-base mb-2">{titulo}</h3>
        <p className="text-sm text-white/55">
          {emptyMessage ?? "Sem dados suficientes para esta categoria."}
        </p>
      </div>
    );
  }

  return (
    <div className="bio-card overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <h3 className="bio-heading text-base">{titulo}</h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5 text-[11px] uppercase tracking-wide text-white/50">
            <th className="text-left p-3">Métrica</th>
            <th className="text-center p-3">{labelA}</th>
            <th className="text-center p-3">{labelB}</th>
            <th className="text-center p-3">Δ</th>
            <th className="text-center p-3 w-14">Tend.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const aNum = typeof r.a === "number" ? r.a : null;
            const bNum = typeof r.b === "number" ? r.b : null;
            const canDelta = aNum !== null && bNum !== null;
            const delta = canDelta ? bNum - aNum : null;
            const tol = r.toleranciaEstavel ?? 0.5;
            const higher = r.higherIsBetter ?? true;
            let tone: "good" | "bad" | "neutral" = "neutral";
            if (delta !== null) {
              if (Math.abs(delta) < tol) tone = "neutral";
              else if (delta > 0) tone = higher ? "good" : "bad";
              else tone = higher ? "bad" : "good";
            }
            const toneCls =
              tone === "good"
                ? "text-emerald-300"
                : tone === "bad"
                  ? "text-rose-300"
                  : "text-white/50";
            const Icon =
              tone === "neutral" || delta === null
                ? Minus
                : delta! > 0
                  ? ArrowUp
                  : ArrowDown;
            return (
              <tr key={r.label} className="border-b border-white/5">
                <td className="p-3 text-sm text-white/85">{r.label}</td>
                <td className="p-3 text-center text-sm text-white/80">{fmt(r.a, r)}</td>
                <td className="p-3 text-center text-sm text-white/80">{fmt(r.b, r)}</td>
                <td className={`p-3 text-center text-sm font-medium ${toneCls}`}>
                  {delta === null
                    ? "—"
                    : `${delta > 0 ? "+" : ""}${r.format ? r.format(delta) : `${delta.toFixed(1)}${r.suffix ?? ""}`}`}
                </td>
                <td className={`p-3 text-center ${toneCls}`}>
                  <Icon className="w-4 h-4 inline" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
