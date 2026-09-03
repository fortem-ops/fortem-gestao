import { useMemo, useState } from "react";
import type { ConsolidadoAluno } from "../useAlunoAvaliacoesConsolidadas";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import {
  METRIC_META,
  getMetricDisplayLabel,
  FORCA_EXERCICIO_LABEL,
  type ForcaExercicio,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { EvolucaoSeletor, type SeletorGrupo } from "./EvolucaoSeletor";

interface Props {
  data: ConsolidadoAluno;
}

const PALETTE = [
  "hsl(var(--sev-medium))",
  "hsl(var(--sev-weak))",
  "hsl(var(--sev-good))",
  "hsl(var(--sev-attention))",
  "hsl(var(--sev-excellent))",
  "hsl(262 60% 62%)",
  "hsl(24 70% 58%)",
];

const COMP_FIELDS = [
  { key: "bf", label: "% gordura" },
  { key: "peso", label: "Peso (kg)" },
  { key: "massaMagra", label: "Massa magra (kg)" },
  { key: "massaGorda", label: "Massa gorda (kg)" },
] as const;

const PLIO_FIELDS = [
  { key: "salto_vertical", label: "Salto vertical" },
  { key: "salto_horizontal", label: "Salto horizontal" },
  { key: "rsi", label: "RSI" },
  { key: "tempo_contato", label: "Tempo de contato" },
  { key: "potencia", label: "Potência" },
  { key: "stiffness", label: "Stiffness" },
] as const;

interface Serie {
  key: string;
  label: string;
  color: string;
  dashed: boolean;
}

export function EvolucaoTab({ data }: Props) {
  // ---- Catálogo de itens disponíveis (só o que o aluno tem lançado) ----
  const catalogo = useMemo(() => {
    const mob: { key: string; label: string; metric: string }[] = [];
    const flex: { key: string; label: string; metric: string }[] = [];
    const metricasVistas = new Set<string>();
    data.funcional.history.forEach((s) =>
      s.metricas.forEach((m) => {
        if (m.left === null && m.right === null) return;
        metricasVistas.add(m.metric);
      }),
    );
    metricasVistas.forEach((metric) => {
      const meta = METRIC_META[metric];
      if (!meta) return;
      const entry = { key: `${meta.layer}:${metric}`, label: getMetricDisplayLabel(metric), metric };
      if (meta.layer === "flexibility") flex.push(entry);
      else mob.push(entry);
    });
    mob.sort((a, b) => a.label.localeCompare(b.label));
    flex.sort((a, b) => a.label.localeCompare(b.label));

    const forcaVistas = new Set<string>();
    data.funcional.history.forEach((s) => s.forca.forEach((f) => forcaVistas.add(f.nome)));
    const forca = Array.from(forcaVistas)
      .map((nome) => ({
        key: `forca:${nome}`,
        label: FORCA_EXERCICIO_LABEL[nome as ForcaExercicio] ?? nome,
        nome,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const comp = COMP_FIELDS.filter((f) =>
      data.composicao.history.some((c) => typeof c[f.key] === "number" && c[f.key] !== null),
    ).map((f) => ({ key: `comp:${f.key}`, label: f.label, field: f.key }));

    const plio = PLIO_FIELDS.filter((f) =>
      data.pliometria.history.some((p) => typeof p[f.key] === "number" && p[f.key] !== null),
    ).map((f) => ({ key: `plio:${f.key}`, label: f.label, field: f.key }));

    return { mob, flex, forca, comp, plio };
  }, [data]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    data.funcional.history.forEach((s) => set.add(s.data));
    data.composicao.history.forEach((s) => set.add(s.data));
    data.pliometria.history.forEach((s) => set.add(s.data));
    return Array.from(set).sort();
  }, [data]);

  const [dateOverride, setDateOverride] = useState<string[] | null>(null);
  const selectedDates = dateOverride ?? dates;

  const [itemOverride, setItemOverride] = useState<Record<string, boolean> | null>(null);
  const defaultItems = useMemo(() => {
    const map: Record<string, boolean> = {};
    [...catalogo.mob, ...catalogo.flex].forEach((i) => (map[i.key] = true));
    return map;
  }, [catalogo]);
  const selectedItems = itemOverride ?? defaultItems;

  const grupos: SeletorGrupo[] = useMemo(
    () =>
      [
        { id: "mobility", titulo: "Mobilidade", itens: catalogo.mob },
        { id: "flexibility", titulo: "Flexibilidade", itens: catalogo.flex },
        { id: "forca", titulo: "Força", itens: catalogo.forca },
        { id: "comp", titulo: "Composição", itens: catalogo.comp },
        { id: "plio", titulo: "Pliometria", itens: catalogo.plio },
      ].filter((g) => g.itens.length > 0),
    [catalogo],
  );

  function toggleDate(d: string) {
    const next = selectedDates.includes(d) ? selectedDates.filter((x) => x !== d) : [...selectedDates, d];
    setDateOverride(next);
  }
  function toggleItem(key: string) {
    setItemOverride({ ...selectedItems, [key]: !selectedItems[key] });
  }
  function toggleGrupo(grupoId: string, checked: boolean) {
    const grupo = grupos.find((g) => g.id === grupoId);
    if (!grupo) return;
    const next = { ...selectedItems };
    grupo.itens.forEach((i) => (next[i.key] = checked));
    setItemOverride(next);
  }

  // ---- Montagem dos gráficos ----
  const charts = useMemo(() => {
    const orderedDates = [...selectedDates].sort();
    const base = orderedDates.map((d) => ({ data: format(parseISO(d), "dd/MM/yy"), _date: d }));
    const out: { id: string; titulo: string; series: Serie[]; rows: Record<string, unknown>[] }[] = [];

    const funcByDate = new Map<string, typeof data.funcional.history>();
    data.funcional.history.forEach((s) => {
      funcByDate.set(s.data, [...(funcByDate.get(s.data) ?? []), s]);
    });

    const buildMetricChart = (
      id: string,
      titulo: string,
      itens: { key: string; label: string; metric: string }[],
    ) => {
      const ativos = itens.filter((i) => selectedItems[i.key]);
      if (ativos.length === 0) return;
      const series: Serie[] = [];
      ativos.forEach((item, idx) => {
        const color = PALETTE[idx % PALETTE.length];
        series.push({ key: `${item.key}|E`, label: `${item.label} (E)`, color, dashed: false });
        series.push({ key: `${item.key}|D`, label: `${item.label} (D)`, color, dashed: true });
      });
      const rows = base.map((row) => {
        const out: Record<string, unknown> = { data: row.data };
        const snaps = funcByDate.get(row._date) ?? [];
        ativos.forEach((item) => {
          let m: { left: number | null; right: number | null } | undefined;
          for (const s of snaps) {
            const found = s.metricas.find((x) => x.metric === item.metric);
            if (found) {
              m = found;
              break;
            }
          }
          out[`${item.key}|E`] = m?.left ?? null;
          out[`${item.key}|D`] = m?.right ?? null;
        });
        return out;
      });
      out.push({ id, titulo, series, rows });
    };

    buildMetricChart("mobility", "Mobilidade (graus)", catalogo.mob);
    buildMetricChart("flexibility", "Flexibilidade (graus)", catalogo.flex);

    const forcaAtivos = catalogo.forca.filter((i) => selectedItems[i.key]);
    if (forcaAtivos.length > 0) {
      const series: Serie[] = [];
      forcaAtivos.forEach((item, idx) => {
        const color = PALETTE[idx % PALETTE.length];
        series.push({ key: `${item.key}|E`, label: `${item.label} (E)`, color, dashed: false });
        series.push({ key: `${item.key}|D`, label: `${item.label} (D)`, color, dashed: true });
      });
      const rows = base.map((row) => {
        const res: Record<string, unknown> = { data: row.data };
        const snaps = funcByDate.get(row._date) ?? [];
        forcaAtivos.forEach((item) => {
          let f: { esquerdo_kg: number; direito_kg: number } | undefined;
          for (const s of snaps) {
            const found = s.forca.find((x) => x.nome === item.nome);
            if (found) {
              f = found;
              break;
            }
          }
          res[`${item.key}|E`] = f?.esquerdo_kg ?? null;
          res[`${item.key}|D`] = f?.direito_kg ?? null;
        });
        return res;
      });
      out.push({ id: "forca", titulo: "Força (kg)", series, rows });
    }

    const compAtivos = catalogo.comp.filter((i) => selectedItems[i.key]);
    if (compAtivos.length > 0) {
      const series: Serie[] = compAtivos.map((item, idx) => ({
        key: item.key,
        label: item.label,
        color: PALETTE[idx % PALETTE.length],
        dashed: false,
      }));
      const rows = base.map((row) => {
        const res: Record<string, unknown> = { data: row.data };
        const snap = data.composicao.history.find((c) => c.data === row._date);
        compAtivos.forEach((item) => {
          const v = snap ? snap[item.field] : null;
          res[item.key] = typeof v === "number" ? v : null;
        });
        return res;
      });
      out.push({ id: "comp", titulo: "Composição corporal", series, rows });
    }

    const plioAtivos = catalogo.plio.filter((i) => selectedItems[i.key]);
    if (plioAtivos.length > 0) {
      const series: Serie[] = plioAtivos.map((item, idx) => ({
        key: item.key,
        label: item.label,
        color: PALETTE[idx % PALETTE.length],
        dashed: false,
      }));
      const rows = base.map((row) => {
        const res: Record<string, unknown> = { data: row.data };
        const snap = data.pliometria.history.find((p) => p.data === row._date);
        plioAtivos.forEach((item) => {
          const v = snap ? snap[item.field] : null;
          res[item.key] = typeof v === "number" ? v : null;
        });
        return res;
      });
      out.push({ id: "plio", titulo: "Pliometria", series, rows });
    }

    return out;
  }, [catalogo, selectedItems, selectedDates, data]);

  if (dates.length === 0) {
    return (
      <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
        Nenhuma avaliação lançada para este aluno.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EvolucaoSeletor
        dates={dates}
        selectedDates={selectedDates}
        onToggleDate={toggleDate}
        onAllDates={() => setDateOverride([...dates])}
        onClearDates={() => setDateOverride([])}
        grupos={grupos}
        selectedItems={selectedItems}
        onToggleItem={toggleItem}
        onToggleGrupo={toggleGrupo}
      />

      {(charts.length === 0 || selectedDates.length === 0) && (
        <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
          Selecione ao menos uma data e um dado para visualizar a evolução.
        </div>
      )}

      {selectedDates.length > 0 &&
        charts.map((chart) => (
          <div key={chart.id} className="bio-card p-5">
            <h3 className="bio-heading text-base mb-3">{chart.titulo}</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chart.rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bio-line))" />
                <XAxis dataKey="data" stroke="hsl(var(--bio-ink-muted))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--bio-ink-muted))" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--bio-surface-2))",
                    border: "1px solid hsl(var(--bio-line))",
                    borderRadius: 8,
                    color: "hsl(var(--bio-ink))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chart.series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}

      <div className="bio-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--bio-line))]">
          <h3 className="bio-heading text-base">Timeline de Avaliações</h3>
        </div>
        <ul className="divide-y divide-[hsl(var(--bio-line))]">
          {data.raw.map((r) => (
            <li key={r.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="text-[hsl(var(--bio-ink))] capitalize">{r.tipo.replace(/_/g, " ")}</p>
                {r.observacoes && <p className="text-[11px] text-[hsl(var(--bio-ink-faint))] line-clamp-1">{r.observacoes}</p>}
              </div>
              <span className="text-xs text-[hsl(var(--bio-ink-muted))]">
                {format(parseISO(r.data), "dd/MM/yyyy")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
