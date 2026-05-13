import * as XLSX from "xlsx";
import { formatMinutes } from "@/lib/ponto";

export interface JornadaExport {
  data: string;
  professor: string;
  entrada: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  saida: string | null;
  minutos_trabalhados: number | null;
  minutos_previstos: number | null;
  pendencias: string;
}

export interface EventoExport {
  data: string;
  professor: string;
  tipo: string;
  data_hora: string;
  latitude: number | null;
  longitude: number | null;
  dispositivo: string | null;
  observacao: string | null;
}

export interface MensalExport {
  mes: string;
  professor: string;
  dias_trabalhados: number;
  total_minutos: number;
  previsto_minutos: number;
  saldo_minutos: number;
  saldo_jornadas?: number;
  saldo_banco?: number;
  pendencias: number;
  status: string;
}

const fmtHora = (iso: string | null) =>
  !iso ? "" : new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtData = (d: string) => new Date(d + "T00:00").toLocaleDateString("pt-BR");

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(";"), ...rows.map((r) => headers.map((h) => esc(r[h])).join(";"))].join("\n");
}

export function exportarDiarioCSV(jornadas: JornadaExport[], periodo: string) {
  const rows = jornadas.map((j) => ({
    Data: fmtData(j.data),
    Profissional: j.professor,
    Entrada: fmtHora(j.entrada),
    "Início intervalo": fmtHora(j.intervalo_inicio),
    "Fim intervalo": fmtHora(j.intervalo_fim),
    Saída: fmtHora(j.saida),
    Trabalhado: formatMinutes(j.minutos_trabalhados ?? 0),
    Previsto: formatMinutes(j.minutos_previstos ?? 0),
    Pendências: j.pendencias,
  }));
  downloadBlob(new Blob(["\uFEFF" + toCSV(rows)], { type: "text/csv;charset=utf-8" }), `relatorio-ponto-diario-${periodo}.csv`);
}

export function exportarDiarioXLSX(jornadas: JornadaExport[], eventos: EventoExport[], periodo: string) {
  const wb = XLSX.utils.book_new();

  const resumo = [
    { Campo: "Período", Valor: periodo },
    { Campo: "Total de jornadas", Valor: jornadas.length },
    { Campo: "Gerado em", Valor: new Date().toLocaleString("pt-BR") },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      jornadas.map((j) => ({
        Data: fmtData(j.data),
        Profissional: j.professor,
        Entrada: fmtHora(j.entrada),
        "Início intervalo": fmtHora(j.intervalo_inicio),
        "Fim intervalo": fmtHora(j.intervalo_fim),
        Saída: fmtHora(j.saida),
        Trabalhado: formatMinutes(j.minutos_trabalhados ?? 0),
        Previsto: formatMinutes(j.minutos_previstos ?? 0),
        "Saldo (min)": (j.minutos_trabalhados ?? 0) - (j.minutos_previstos ?? 0),
        Pendências: j.pendencias,
      })),
    ),
    "Jornadas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      eventos.map((e) => ({
        Data: fmtData(e.data),
        Profissional: e.professor,
        Tipo: e.tipo,
        "Data/Hora": new Date(e.data_hora).toLocaleString("pt-BR"),
        Latitude: e.latitude ?? "",
        Longitude: e.longitude ?? "",
        Dispositivo: e.dispositivo ?? "",
        Observação: e.observacao ?? "",
      })),
    ),
    "Eventos",
  );

  XLSX.writeFile(wb, `relatorio-ponto-diario-${periodo}.xlsx`);
}

export function exportarMensalCSV(rows: MensalExport[], periodo: string) {
  const data = rows.map((r) => ({
    Mês: r.mes,
    Profissional: r.professor,
    "Dias trabalhados": r.dias_trabalhados,
    Trabalhado: formatMinutes(r.total_minutos),
    Previsto: formatMinutes(r.previsto_minutos),
    Saldo: (r.saldo_minutos >= 0 ? "+" : "") + formatMinutes(Math.abs(r.saldo_minutos)),
    Pendências: r.pendencias,
    Status: r.status,
  }));
  downloadBlob(new Blob(["\uFEFF" + toCSV(data)], { type: "text/csv;charset=utf-8" }), `relatorio-ponto-mensal-${periodo}.csv`);
}

export function exportarMensalXLSX(rows: MensalExport[], periodo: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Mês: r.mes,
        Profissional: r.professor,
        "Dias trabalhados": r.dias_trabalhados,
        "Trabalhado (min)": r.total_minutos,
        "Previsto (min)": r.previsto_minutos,
        "Saldo (min)": r.saldo_minutos,
        Pendências: r.pendencias,
        Status: r.status,
      })),
    ),
    "Mensal",
  );
  XLSX.writeFile(wb, `relatorio-ponto-mensal-${periodo}.xlsx`);
}
