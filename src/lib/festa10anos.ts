import { festa10AnosConfig } from "@/config/festa10anos";

/** Total informativo exibido na tela. O servidor recalcula sempre. */
export function calcularTotalFesta(acompanhantes: number, isento = false, descontoPessoaCentavos = 0) {
  const { pessoaCentavos } = festa10AnosConfig.valores;
  const n = Math.max(0, Math.min(festa10AnosConfig.limiteAcompanhantes, Math.trunc(acompanhantes)));
  if (isento) return 0;
  return (1 + n) * Math.max(0, pessoaCentavos - Math.max(0, Math.trunc(descontoPessoaCentavos || 0)));
}

/** Confirmações abertas até 23:59:59 (Brasília, UTC-3) do dia do prazo. */
export function confirmacoesAbertas(agora: Date = new Date(), prazoIso = festa10AnosConfig.prazoIso) {
  const fim = new Date(`${prazoIso}T23:59:59.999-03:00`);
  return agora.getTime() <= fim.getTime();
}

export const brlCentavos = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function maskWhatsApp(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Celular BR com DDD: 11 dígitos, 9 na terceira posição. */
export function whatsappValido(value: string) {
  const d = value.replace(/\D/g, "").replace(/^55(?=\d{11}$)/, "");
  return /^[1-9]{2}9\d{8}$/.test(d);
}
