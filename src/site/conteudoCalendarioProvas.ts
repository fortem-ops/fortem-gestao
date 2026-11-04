/**
 * Calendário de Provas exibido na /corrida (#calendario).
 * Para adicionar uma prova, inclua um item neste array. Campos opcionais vazios não aparecem.
 * Não inventar distâncias, locais, links ou horários: só preencher o que for confirmado.
 */
export type ProvaCalendario = {
  id: string;
  /** Data ISO (AAAA-MM-DD). */
  data: string;
  nome: string;
  local?: string;
  distancias?: string;
  linkInscricao?: string;
  observacao?: string;
};

export const CALENDARIO_PROVAS_2027: ProvaCalendario[] = [
  { id: "meia-usina-gasometro-2027", data: "2027-04-25", nome: "1ª MEIA MARATONA DA USINA DO GASÔMETRO" },
  { id: "maratona-poa-2027", data: "2027-06-05", nome: "42ª MARATONA INTERNACIONAL DE PORTO ALEGRE" },
  { id: "new-balance-2027", data: "2027-08-21", nome: "3ª NEW BALANCE" },
  { id: "meia-mercado-publico-2027", data: "2027-10-03", nome: "3ª MEIA MARATONA DO MERCADO PÚBLICO" },
];

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function partesData(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return { dia: String(d).padStart(2, "0"), mes: MESES[m - 1] ?? "" };
}

export function ordenarProvas(provas: ProvaCalendario[]) {
  return [...provas].sort((a, b) => a.data.localeCompare(b.data));
}

/** Prova realizada = data anterior a hoje (data local AAAA-MM-DD). */
export function provaRealizada(iso: string, hojeIso: string) {
  return iso < hojeIso;
}

export function mensagemProva(nome: string) {
  return `Olá! Vim pelo site e quero saber mais sobre a preparação para a ${nome}.`;
}

const MESES_NOME = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

/** Agrupa por mês (AAAA-MM), só meses com prova, em ordem de data. */
export function agruparPorMes(provas: ProvaCalendario[]) {
  const grupos: { chave: string; rotulo: string; provas: ProvaCalendario[] }[] = [];
  for (const p of ordenarProvas(provas)) {
    const chave = p.data.slice(0, 7);
    let g = grupos.find((x) => x.chave === chave);
    if (!g) {
      const [a, m] = chave.split("-").map(Number);
      g = { chave, rotulo: `${MESES_NOME[m - 1]} ${a}`, provas: [] };
      grupos.push(g);
    }
    g.provas.push(p);
  }
  return grupos;
}

/** Dias inteiros entre duas datas ISO (sem horário). */
export function diasEntre(deIso: string, ateIso: string) {
  const t = (s: string) => { const [a, m, d] = s.split("-").map(Number); return Date.UTC(a, m - 1, d); };
  return Math.round((t(ateIso) - t(deIso)) / 86400000);
}

/** Texto do rodapé: FALTAM X DIAS / FALTA 1 DIA / É HOJE / REALIZADA. */
export function statusProva(iso: string, hojeIso: string) {
  const n = diasEntre(hojeIso, iso);
  if (n < 0) return "REALIZADA";
  if (n === 0) return "É HOJE";
  return n === 1 ? "FALTA 1 DIA" : `FALTAM ${n} DIAS`;
}
