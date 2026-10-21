// Regras de exibição do reconhecimento facial no app do aluno (sem acesso ao banco).

export const TERMO_FACIAL_VERSAO = "v1-provisoria";
export const TERMO_FACIAL_TEXTO =
  "TERMO DE CONSENTIMENTO PARA USO DA IMAGEM DO ROSTO. Eu autorizo a FORTEM a coletar e armazenar uma foto do meu rosto e a gerar dela os dados necessários para o reconhecimento facial na porta do estúdio, com a única finalidade de liberar a minha entrada e confirmar a minha presença nos treinos que eu já tenho agendados. A foto e os dados do rosto não são compartilhados com terceiros nem usados para outra finalidade, como publicidade. Os registros de passagem (data e hora) ficam guardados no meu cadastro. Posso pedir a remoção do meu rosto a qualquer momento, pelo aplicativo ou na recepção: o rosto é apagado da porta e a foto é apagada do sistema; o registro deste consentimento e das passagens permanece guardado para fins de comprovação. Este consentimento é válido enquanto eu for aluno da FORTEM ou até que eu o revogue.";

export type EstadoFacial = "nao_cadastrado" | "menor" | "acompanhamento";

export function idadeEm(nasc: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!nasc) return null;
  const n = new Date(nasc + "T00:00:00");
  if (Number.isNaN(n.getTime())) return null;
  let a = hoje.getFullYear() - n.getFullYear();
  if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) a--;
  return a;
}

/** Data vazia ou menos de 18 anos = menor (não se cadastra sozinho). */
export function ehMenor(nasc: string | null | undefined, hoje: Date = new Date()): boolean {
  const a = idadeEm(nasc, hoje);
  return a === null || a < 18;
}

export function temCredencial(status: string | null | undefined): boolean {
  return !!status && status !== "removida" && status !== "sem_facial";
}

export function estadoFacial(credStatus: string | null | undefined, nasc: string | null | undefined, hoje: Date = new Date()): EstadoFacial {
  if (temCredencial(credStatus)) return "acompanhamento";
  return ehMenor(nasc, hoje) ? "menor" : "nao_cadastrado";
}

/** Só promete "Presença confirmada" quando o treino ligado teve check-in facial gravado. */
export function rotuloPassagem(
  resultado: string,
  treino: { horario_inicio?: string | null; checkin_origem?: string | null } | null | undefined,
): string {
  if (resultado === "presenca_confirmada" && treino?.checkin_origem === "facial") {
    const h = (treino.horario_inicio ?? "").slice(0, 5);
    return h ? `Presença confirmada · Treino das ${h}` : "Presença confirmada";
  }
  if (resultado === "sem_treino_agendado") return "Entrada registrada · sem treino agendado";
  if (resultado === "nao_reconhecido") return "Rosto não reconhecido";
  return "Entrada registrada";
}

const TZ = "America/Sao_Paulo";
const diaChave = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export function dataPassagem(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (diaChave(d) === diaChave(agora)) return `Hoje, ${hora}`;
  const sem = d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long" }).split("-")[0];
  const dm = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${dm}, ${hora}`;
}

export function motivoErroFacial(erro: string | null | undefined): string {
  const e = (erro ?? "").toLowerCase();
  if (e.includes("consentimento")) return "Falta aceitar o termo de consentimento.";
  if (e.includes("foto") || e.includes("face") || e.includes("rosto") || e.includes("imagem"))
    return "A porta não conseguiu ler o rosto na foto. Envie outra, de frente e com boa luz.";
  return "A porta não conseguiu concluir o cadastro. Tente de novo com outra foto.";
}
