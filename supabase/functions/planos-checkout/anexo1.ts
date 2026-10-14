// ANEXO I – Declaração de Aptidão Física e Uso de Imagem (cópia do /assinar).
// O bloco aceito entra no HTML do contrato que gera o hash e no e-mail da confirmação.
export const ANEXO1_VERSAO = "anexo1-2027-v1";

export type Anexo1 = {
  versao: string; medical_status: "ok" | "restricao"; image_usage: boolean; lgpd: true; termos_lidos: true;
  emergency_contact_name: string; emergency_contact_phone: string;
};

export const ANEXO1_ERROS = [
  "Preencha o ANEXO I", "Selecione a opção da Avaliação Médica", "Selecione a opção do Direito de Uso de Imagem",
  "Leia e aceite os termos do ANEXO I", "Informe o contato de emergência", "Assine o ANEXO I",
] as const;

export class ErroAnexo extends Error {}

/** Valida as respostas do anexo; a assinatura é conferida à parte (não entra no hash). */
export function lerAnexo(a: any, assinatura: unknown): { anexo: Anexo1; assinatura: string } {
  if (!a || typeof a !== "object" || a.versao !== ANEXO1_VERSAO) throw new ErroAnexo("Preencha o ANEXO I");
  if (a.medical_status !== "ok" && a.medical_status !== "restricao") throw new ErroAnexo("Selecione a opção da Avaliação Médica");
  if (typeof a.image_usage !== "boolean") throw new ErroAnexo("Selecione a opção do Direito de Uso de Imagem");
  if (a.lgpd !== true || a.termos_lidos !== true) throw new ErroAnexo("Leia e aceite os termos do ANEXO I");
  const nome = typeof a.emergency_contact_name === "string" ? a.emergency_contact_name.trim().slice(0, 120) : "";
  const tel = typeof a.emergency_contact_phone === "string" ? a.emergency_contact_phone.replace(/\D/g, "").slice(0, 13) : "";
  if (nome.length < 3 || tel.length < 10) throw new ErroAnexo("Informe o contato de emergência");
  if (typeof assinatura !== "string" || !assinatura.startsWith("data:image/png;base64,") || assinatura.length > 1_000_000)
    throw new ErroAnexo("Assine o ANEXO I");
  return {
    anexo: { versao: ANEXO1_VERSAO, medical_status: a.medical_status, image_usage: a.image_usage, lgpd: true, termos_lidos: true,
      emergency_contact_name: nome, emergency_contact_phone: tel },
    assinatura,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export const ANEXO1_TEXTO_HTML = `<h2>1. DECLARAÇÃO DE CONDIÇÕES DE SAÚDE</h2>
<p>Declaro, para os devidos fins, que: I. Encontro-me em condições físicas e de saúde adequadas para a prática de atividades físicas, incluindo treinos funcionais, exercícios de força e atividades aeróbicas; II. Não possuo, até a presente data, restrições médicas, doenças, lesões ou condições de saúde que impeçam ou limitem a prática de atividades físicas, exceto aquelas que eventualmente tenham sido informadas previamente à equipe da FORTEM; III. Caso possua qualquer condição de saúde relevante, comprometo-me a apresentar atestado ou liberação médica antes do início ou continuidade das atividades.</p>
<h2>2. CIÊNCIA DOS RISCOS</h2>
<p>Declaro estar ciente de que a prática de atividades físicas envolve riscos inerentes, incluindo, mas não se limitando a: lesões musculares e articulares; quedas; mal-estar físico; fadiga; eventos decorrentes de esforço físico. E que tais riscos podem ocorrer mesmo com acompanhamento profissional adequado.</p>
<h2>3. RESPONSABILIDADE E COMPROMISSO</h2>
<p>Comprometo-me a: I. Informar imediatamente qualquer alteração no meu estado de saúde; II. Comunicar dores, desconfortos ou limitações durante os treinos; III. Seguir as orientações dos profissionais da FORTEM; IV. Interromper a atividade em caso de sintomas anormais (tontura, dor intensa, falta de ar, etc.).</p>
<h2>4. DIREITO DE USO DE IMAGEM</h2>
<p>Autorizo, de forma gratuita e livre, a utilização da minha imagem, voz e nome pela FORTEM TREINAMENTO FÍSICO LTDA, para fins de divulgação institucional, publicitária e promocional, em meios digitais e físicos. Declaro estar ciente de que esta autorização pode ser revogada a qualquer momento mediante solicitação formal.</p>
<h2>5. ISENÇÃO DE RESPONSABILIDADE</h2>
<p>Declaro que a omissão de informações relevantes sobre minha condição de saúde poderá resultar em riscos à minha integridade física, isentando a FORTEM de responsabilidade por eventuais danos decorrentes dessa omissão.</p>
<h2>6. AUTORIZAÇÃO EM CASO DE EMERGÊNCIA</h2>
<p>Autorizo, em caso de emergência, o acionamento de serviços médicos, estando ciente de que eventuais custos decorrentes serão de minha responsabilidade.</p>
<h2>7. VALIDADE</h2>
<p>A presente declaração é válida por prazo indeterminado a partir da data de assinatura, devendo ser atualizada em caso de alteração no estado de saúde.</p>
<h2>8. DECLARAÇÃO FINAL</h2>
<p>Declaro que li, compreendi e concordo integralmente com todos os termos deste documento, assumindo plena responsabilidade pelas informações prestadas.</p>`;

/** Bloco "ANEXO I aceito" anexado ao contrato (texto integral + respostas). Telefone mascarado. */
export function blocoAnexo(a: Anexo1, nome: string, quando: Date): string {
  const data = quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const tel = a.emergency_contact_phone;
  const telMasc = tel.length >= 4 ? `(**) *****-${tel.slice(-4)}` : "-";
  return `<hr/><h1>ANEXO I – DECLARAÇÃO DE APTIDÃO FÍSICA E USO DE IMAGEM</h1>
${ANEXO1_TEXTO_HTML}
<h2>RESPOSTAS DO ALUNO (ANEXO I ACEITO)</h2>
<p>Aluno: ${esc(nome)}</p>
<p>Avaliação Médica: ${a.medical_status === "ok" ? "Nenhum médico informou restrições à prática de atividade física (sem restrições)" : "Possuo limitações atestadas por médico que não impedem a prática (com restrições; atestado a ser entregue à equipe FORTEM)"}</p>
<p>Direito de Uso de Imagem: ${a.image_usage ? "Autorizo" : "Não autorizo"}</p>
<p>Contato de emergência: ${esc(a.emergency_contact_name)} · ${telMasc}</p>
<p>Política de Privacidade (LGPD): aceita · Termos lidos até o fim: sim · Assinatura eletrônica desenhada registrada</p>
<p>Versão do texto: ${a.versao} · Aceito em ${data}</p>`;
}
