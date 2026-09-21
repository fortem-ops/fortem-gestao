import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ConsolidadoAluno } from "../useAlunoAvaliacoesConsolidadas";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  METRIC_META,
  getMetricDisplayLabel,
  FORCA_EXERCICIO_LABEL,
  type ForcaExercicio,
} from "@/components/student/assessment/funcionalV2/bodyMapLogic";
import { EvolucaoSeletor, type SeletorGrupo } from "./EvolucaoSeletor";
import { LadoLegendTraco } from "../LadoLegend";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  calcularStatsAssimetria,
  corAssimetria,
  limiaresAssimetria,
  montarResumoAssimetriaEvolucao,
  selecionarDatasTabela,
  valorAssimetria,
  type AssimetriaLado,
  type AssimetriaMedidaTipo,
  type AssimetriaPontoEvolucao,
  type AssimetriaResumoEvolucao,
  type TendenciaAssimetria,
} from "../assimetriaGrafico";

interface Props {
  data: ConsolidadoAluno;
}

const PALETTE = [
  "hsl(var(--sev-medium))",
  "hsl(var(--sev-weak))",
  "hsl(var(--sev-good))",
  "hsl(var(--sev-attention))",
  "hsl(var(--sev-excellent))",
  "hsl(var(--license))",
  "hsl(var(--info))",
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

const NIVEL_LABEL: Record<"nenhuma" | "moderada" | "severa", string> = {
  nenhuma: "Normal",
  moderada: "Moderada",
  severa: "Severa",
};

const TENDENCIA_LABEL: Record<TendenciaAssimetria, string> = {
  melhorou: "Melhorou",
  piorou: "Piorou",
  estavel: "Estável",
};

export function EvolucaoTab({ data }: Props) {
  const [tipoAssimetria, setTipoAssimetria] = useState<AssimetriaMedidaTipo>("mobilidade");
  const [somenteForaVerde, setSomenteForaVerde] = useState(false);
  const [valoresOpen, setValoresOpen] = useState(false);

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

  const functionalDates = useMemo(() => {
    const set = new Set<string>();
    data.funcional.history.forEach((s) => set.add(s.data));
    return set;
  }, [data]);

  const [dateOverride, setDateOverride] = useState<string[] | null>(null);
  const selectedDates = dateOverride ?? dates;
  const selectedFuncDates = useMemo(
    () => selectedDates.filter((date) => functionalDates.has(date)).sort(),
    [functionalDates, selectedDates],
  );

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

  const assimetrias = useMemo(
    () => montarResumoAssimetriaEvolucao(data.funcional.history, tipoAssimetria, selectedFuncDates),
    [data.funcional.history, tipoAssimetria, selectedFuncDates],
  );
  const assimetriasVisiveis = somenteForaVerde ? assimetrias.filter((item) => item.foraFaixaVerde) : assimetrias;
  const stats = useMemo(() => calcularStatsAssimetria(assimetrias), [assimetrias]);
  const datasTabela = useMemo(() => selecionarDatasTabela(selectedFuncDates), [selectedFuncDates]);
  const limiaresPadrao = limiaresAssimetria();
  const limiaresPsoas = limiaresAssimetria("Flexibilidade Psoas");

  // ---- Montagem dos gráficos de valores originais ----
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
        const itemRow: Record<string, unknown> = { data: row.data };
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
          itemRow[`${item.key}|E`] = m?.left ?? null;
          itemRow[`${item.key}|D`] = m?.right ?? null;
        });
        return itemRow;
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
    <div className="space-y-5">
      <div className="bio-card p-5 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="bio-label">Tipo de medida</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={tipoAssimetria === "mobilidade" ? "default" : "outline"}
                size="sm"
                onClick={() => setTipoAssimetria("mobilidade")}
              >
                Mobilidade e flexibilidade
              </Button>
              <Button
                type="button"
                variant={tipoAssimetria === "forca" ? "default" : "outline"}
                size="sm"
                onClick={() => setTipoAssimetria("forca")}
              >
                Força (dinamometria)
              </Button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-[hsl(var(--bio-ink))]">
            <Switch checked={somenteForaVerde} onCheckedChange={setSomenteForaVerde} />
            Só fora da faixa verde
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <p className="bio-label">Datas das avaliações</p>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setDateOverride([...dates])}>
              Todas
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setDateOverride([])}>
              Limpar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => {
              const selected = selectedDates.includes(d);
              return (
                <Button
                  key={d}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() => toggleDate(d)}
                >
                  {format(parseISO(d), "dd/MM/yyyy")}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDates.length === 0 && (
        <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
          Selecione ao menos uma data para visualizar a evolução.
        </div>
      )}

      {selectedDates.length > 0 && selectedFuncDates.length === 0 && (
        <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
          As datas selecionadas não têm avaliação funcional para calcular assimetrias.
        </div>
      )}

      {selectedFuncDates.length > 0 && (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3 md:grid-cols-3">
              <ResumoNumero label="Fora da faixa verde" value={stats.foraFaixaVerde} />
              <ResumoNumero label="Pioraram" value={stats.pioraram} />
              <ResumoNumero label="Trocaram o lado mais fraco" value={stats.inverteram} />
            </div>
            <div className="bio-card p-4 min-w-72 space-y-3">
              <p className="bio-label">Faixas de assimetria</p>
              <div className="space-y-2 text-xs text-[hsl(var(--bio-ink-muted))]">
                <LegendaFaixa nivel="nenhuma">
                  Verde: &lt; {limiaresPadrao.moderado}%
                </LegendaFaixa>
                <LegendaFaixa nivel="moderada">
                  Âmbar: {limiaresPadrao.moderado}%–{limiaresPadrao.severo}%
                </LegendaFaixa>
                <LegendaFaixa nivel="severa">
                  Coral: &gt; {limiaresPadrao.severo}%
                </LegendaFaixa>
              </div>
              {tipoAssimetria === "mobilidade" && (
                <p className="text-[11px] leading-relaxed text-[hsl(var(--bio-ink-faint))]">
                  Psoas é medido em graus: moderada a partir de {limiaresPsoas.moderado}° e severa acima de {limiaresPsoas.severo}°.
                </p>
              )}
            </div>
          </div>

          {assimetrias.length === 0 && (
            <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
              Nenhuma assimetria encontrada para o tipo de medida selecionado.
            </div>
          )}

          {assimetrias.length > 0 && assimetriasVisiveis.length === 0 && (
            <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
              Nenhuma métrica fora da faixa verde na última avaliação selecionada.
            </div>
          )}

          {assimetriasVisiveis.length > 0 && (
            <>
              <TabelaResumoAssimetria resumos={assimetriasVisiveis} datasTabela={datasTabela} />

              {selectedFuncDates.length === 1 ? (
                <RetratoAssimetria resumos={assimetriasVisiveis} />
              ) : (
                <div className="grid gap-4 xl:grid-cols-3">
                  {assimetriasVisiveis.map((resumo, idx) => (
                    <MiniGraficoAssimetria
                      key={resumo.key}
                      resumo={resumo}
                      color={corAssimetria(idx)}
                      xDomain={domainDatas(selectedFuncDates)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <Collapsible open={valoresOpen} onOpenChange={setValoresOpen} className="space-y-4">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between bio-card h-auto px-5 py-4">
            <span className="text-left">
              <span className="bio-heading block text-base">Evolução dos valores</span>
              <span className="block text-xs font-normal text-[hsl(var(--bio-ink-muted))]">
                Mobilidade, flexibilidade, força e demais valores lançados.
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${valoresOpen ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          <EvolucaoSeletor
            grupos={grupos}
            selectedItems={selectedItems}
            onToggleItem={toggleItem}
            onToggleGrupo={toggleGrupo}
            mostrarDatas={false}
            className="bio-card p-5 space-y-5"
          />

          {(charts.length === 0 || selectedDates.length === 0) && (
            <div className="bio-card p-8 text-center text-[hsl(var(--bio-ink-muted))] text-sm">
              Selecione ao menos uma data e um dado para visualizar a evolução.
            </div>
          )}

          {selectedDates.length > 0 && charts.some((c) => c.id === "mobility" || c.id === "flexibility" || c.id === "forca") && (
            <LadoLegendTraco />
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ResumoNumero({ label, value }: { label: string; value: number }) {
  return (
    <div className="bio-card p-4">
      <p className="bio-label mb-2">{label}</p>
      <p className="bio-heading text-3xl">{value}</p>
    </div>
  );
}

function LegendaFaixa({ nivel, children }: { nivel: "nenhuma" | "moderada" | "severa"; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${nivelDotClass(nivel)}`} />
      <span>{children}</span>
    </div>
  );
}

function TabelaResumoAssimetria({ resumos, datasTabela }: { resumos: AssimetriaResumoEvolucao[]; datasTabela: string[] }) {
  return (
    <div className="bio-card overflow-hidden">
      <div className="border-b border-[hsl(var(--bio-line))] px-4 py-3">
        <h3 className="bio-heading text-base">Resumo por métrica</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--bio-line))] text-left text-[11px] uppercase tracking-wide text-[hsl(var(--bio-ink-muted))]">
              <th className="px-4 py-3 font-semibold">Métrica</th>
              {datasTabela.map((date) => (
                <th key={date} className="px-3 py-3 font-semibold">
                  {format(parseISO(date), "dd/MM/yy")}
                </th>
              ))}
              <th className="px-3 py-3 font-semibold">Variação</th>
              <th className="px-3 py-3 font-semibold">Tendência</th>
              <th className="px-3 py-3 font-semibold">Faixa atual</th>
              <th className="px-4 py-3 font-semibold">Lado mais fraco</th>
            </tr>
          </thead>
          <tbody>
            {resumos.map((resumo) => (
              <tr key={resumo.key} className="border-b border-[hsl(var(--bio-line))] last:border-b-0">
                <td className="px-4 py-3 font-medium text-[hsl(var(--bio-ink))]">{resumo.nome}</td>
                {datasTabela.map((date) => {
                  const ponto = resumo.pontos.find((p) => p.data === date);
                  return (
                    <td key={date} className="px-3 py-3">
                      {ponto ? <ValorBadge ponto={ponto} /> : <span className="text-[hsl(var(--bio-ink-faint))]">—</span>}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-[hsl(var(--bio-ink))]">{formatVariacao(resumo.variacao, resumo.unidade)}</td>
                <td className="px-3 py-3">
                  <span className={tendenciaClass(resumo.tendencia)}>{TENDENCIA_LABEL[resumo.tendencia]}</span>
                </td>
                <td className="px-3 py-3">{resumo.ultima ? <NivelBadge nivel={resumo.ultima.nivel} /> : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[hsl(var(--bio-ink))]">{formatLado(resumo.ultimoLadoValido)}</span>
                    {resumo.inverteu && <span className="rounded-full border border-[hsl(var(--sev-attention)/0.35)] bg-[hsl(var(--sev-attention)/0.12)] px-2 py-0.5 text-[11px] font-medium text-[hsl(var(--sev-attention))]">inverteu</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RetratoAssimetria({ resumos }: { resumos: AssimetriaResumoEvolucao[] }) {
  return (
    <div className="bio-card p-5 space-y-4">
      <p className="text-sm text-[hsl(var(--bio-ink-muted))]">A evolução aparece a partir da segunda avaliação.</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {resumos.map((resumo) => (
          <div key={resumo.key} className="rounded-lg border border-[hsl(var(--bio-line))] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-[hsl(var(--bio-ink))]">{resumo.nome}</p>
              {resumo.ultima && <ValorBadge ponto={resumo.ultima} />}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[hsl(var(--bio-ink-muted))]">
              <span>{resumo.ultima ? NIVEL_LABEL[resumo.ultima.nivel] : "Sem faixa"}</span>
              <span>{formatLado(resumo.ultimoLadoValido)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniGraficoAssimetria({ resumo, color, xDomain }: { resumo: AssimetriaResumoEvolucao; color: string; xDomain: [number, number] }) {
  const maxValor = Math.max(...resumo.pontos.map((p) => p.valor), 0);
  const baseMax = resumo.unidade === "°" ? 8 : 30;
  const yMax = Math.max(baseMax, Math.ceil(maxValor));
  const lastTimestamp = resumo.ultima?.timestamp ?? 0;
  const xMin = xDomain[0];
  const xMax = xDomain[1];
  const safeXDomain: [number, number] = xMin === xMax ? [xMin - 86400000, xMax + 86400000] : xDomain;

  return (
    <div className="bio-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h4 className="bio-heading text-sm leading-snug">{resumo.nome}</h4>
        {resumo.ultima && <ValorBadge ponto={resumo.ultima} />}
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={resumo.pontos} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bio-line))" />
          <ReferenceArea y1={0} y2={resumo.corteModerado} fill="hsl(var(--sev-good))" fillOpacity={0.12} />
          <ReferenceArea y1={resumo.corteModerado} y2={resumo.corteSevero} fill="hsl(var(--sev-attention))" fillOpacity={0.14} />
          <ReferenceArea y1={resumo.corteSevero} y2={yMax} fill="hsl(var(--sev-weak))" fillOpacity={0.12} />
          <ReferenceLine y={resumo.corteModerado} stroke="hsl(var(--sev-attention))" strokeDasharray="3 3" label={{ value: `${resumo.corteModerado}${resumo.unidade}`, fontSize: 10, fill: "hsl(var(--bio-ink-muted))", position: "insideTopLeft" }} />
          <ReferenceLine y={resumo.corteSevero} stroke="hsl(var(--sev-weak))" strokeDasharray="3 3" label={{ value: `${resumo.corteSevero}${resumo.unidade}`, fontSize: 10, fill: "hsl(var(--bio-ink-muted))", position: "insideTopRight" }} />
          {resumo.marcos.map((marco) => (
            <ReferenceLine
              key={`${marco.origem}:${marco.data}`}
              x={new Date(`${marco.data}T00:00:00`).getTime()}
              stroke="hsl(var(--bio-ink-muted))"
              strokeDasharray="4 4"
              label={{ value: marco.rotulo, fontSize: 10, fill: "hsl(var(--bio-ink-muted))", position: "insideTop" }}
            />
          ))}
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={safeXDomain}
            stroke="hsl(var(--bio-ink-muted))"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => format(new Date(Number(value)), "dd/MM/yy")}
          />
          <YAxis
            domain={[0, yMax]}
            ticks={ticksY(yMax, resumo.corteModerado, resumo.corteSevero)}
            stroke="hsl(var(--bio-ink-muted))"
            tick={{ fontSize: 10 }}
            tickFormatter={(value) => `${value}${resumo.unidade}`}
          />
          <Tooltip content={<AssimetriaTooltip />} cursor={{ stroke: "hsl(var(--bio-ink-muted))", strokeDasharray: "3 3" }} />
          <Line
            type="linear"
            dataKey="valor"
            name={resumo.nome}
            stroke={color}
            strokeWidth={2}
            dot={(props) => <PontoAssimetria {...props} lastTimestamp={lastTimestamp} />}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[hsl(var(--bio-ink-muted))]">
        <span>Lado atual: {formatLado(resumo.ultimoLadoValido)}</span>
        {resumo.inverteu ? (
          <span className="rounded-full border border-[hsl(var(--sev-attention)/0.35)] bg-[hsl(var(--sev-attention)/0.12)] px-2 py-0.5 text-[hsl(var(--sev-attention))]">
            Inverteu: {formatLado(resumo.primeiroLadoValido).toLowerCase()} → {formatLado(resumo.ultimoLadoValido).toLowerCase()}
          </span>
        ) : (
          <span>{formatVariacao(resumo.variacao, resumo.unidade)} desde a primeira data</span>
        )}
      </div>
    </div>
  );
}

function ValorBadge({ ponto }: { ponto: AssimetriaPontoEvolucao }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${nivelBadgeClass(ponto.nivel)}`}>
      {formatValor(ponto.valor, ponto.unidade)}
    </span>
  );
}

function NivelBadge({ nivel }: { nivel: "nenhuma" | "moderada" | "severa" }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${nivelBadgeClass(nivel)}`}>
      {NIVEL_LABEL[nivel]}
    </span>
  );
}

function PontoAssimetria(props: { cx?: number; cy?: number; payload?: { timestamp?: number; nivel?: "nenhuma" | "moderada" | "severa" }; lastTimestamp: number }) {
  const { cx, cy, payload, lastTimestamp } = props;
  if (cx === undefined || cy === undefined) return <g />;
  const isLast = payload?.timestamp === lastTimestamp;
  const nivel = payload?.nivel ?? "nenhuma";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isLast ? 5 : 3}
      fill={isLast ? nivelFill(nivel) : "hsl(var(--bio-ink-muted))"}
      stroke="hsl(var(--bio-surface))"
      strokeWidth={isLast ? 2 : 1}
    />
  );
}

function AssimetriaTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: AssimetriaPontoEvolucao }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const ponto = payload[0]?.payload;
  if (!ponto) return null;
  return (
    <div className="rounded-md border border-[hsl(var(--bio-line))] bg-[hsl(var(--bio-surface-2))] px-3 py-2 text-xs text-[hsl(var(--bio-ink))] shadow-sm">
      <div className="font-semibold">{format(parseISO(ponto.data), "dd/MM/yyyy")}</div>
      <div>{formatValor(ponto.valor, ponto.unidade)} · {NIVEL_LABEL[ponto.nivel]}</div>
      <div className="text-[hsl(var(--bio-ink-muted))]">{formatLado(ponto.ladoMaisFraco)}</div>
    </div>
  );
}

function domainDatas(datas: string[]): [number, number] {
  const ordered = [...datas].sort();
  const first = ordered[0];
  const last = ordered[ordered.length - 1] ?? first;
  if (!first) return [0, 1];
  return [new Date(`${first}T00:00:00`).getTime(), new Date(`${last}T00:00:00`).getTime()];
}

function ticksY(max: number, moderado: number, severo: number): number[] {
  return Array.from(new Set([0, moderado, severo, max])).sort((a, b) => a - b);
}

function formatValor(valor: number, unidade: "°" | "%"): string {
  const fixed = Number.isInteger(valor) ? valor.toFixed(0) : valor.toFixed(1);
  return `${fixed}${unidade}`;
}

function formatVariacao(variacao: number | null, unidade: "°" | "%"): string {
  if (variacao === null) return "—";
  const sinal = variacao > 0 ? "+" : "";
  const sufixo = unidade === "%" ? " pp" : "°";
  return `${sinal}${variacao.toFixed(1)}${sufixo}`;
}

function formatLado(lado: AssimetriaLado | null | undefined): string {
  if (lado === "esquerdo") return "Esquerdo";
  if (lado === "direito") return "Direito";
  if (lado === "sem_diferenca") return "Sem diferença";
  return "—";
}

function nivelBadgeClass(nivel: "nenhuma" | "moderada" | "severa"): string {
  if (nivel === "severa") return "border-[hsl(var(--sev-weak)/0.35)] bg-[hsl(var(--sev-weak)/0.14)] text-[hsl(var(--sev-weak))]";
  if (nivel === "moderada") return "border-[hsl(var(--sev-attention)/0.35)] bg-[hsl(var(--sev-attention)/0.14)] text-[hsl(var(--sev-attention))]";
  return "border-[hsl(var(--sev-good)/0.35)] bg-[hsl(var(--sev-good)/0.14)] text-[hsl(var(--sev-good))]";
}

function nivelDotClass(nivel: "nenhuma" | "moderada" | "severa"): string {
  if (nivel === "severa") return "bg-[hsl(var(--sev-weak))]";
  if (nivel === "moderada") return "bg-[hsl(var(--sev-attention))]";
  return "bg-[hsl(var(--sev-good))]";
}

function nivelFill(nivel: "nenhuma" | "moderada" | "severa"): string {
  if (nivel === "severa") return "hsl(var(--sev-weak))";
  if (nivel === "moderada") return "hsl(var(--sev-attention))";
  return "hsl(var(--sev-good))";
}

function tendenciaClass(tendencia: TendenciaAssimetria): string {
  if (tendencia === "melhorou") return "text-[hsl(var(--sev-good))] font-medium";
  if (tendencia === "piorou") return "text-[hsl(var(--sev-weak))] font-medium";
  return "text-[hsl(var(--bio-ink-muted))]";
}
