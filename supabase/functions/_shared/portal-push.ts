export type GatilhoPortal =
  | "plano_vencendo_30d"
  | "reavaliacao_pendente"
  | "creditos_baixos"
  | "cobranca_atrasada"
  | "aniversario_fortem"
  | "aniversario_aluno"
  | "documentos_pendentes"
  | "baixa_frequencia"
  | "vaga_liberada";

export interface AvisoPortal {
  aluno_id: string;
  gatilho: GatilhoPortal;
  referencia: string;
  url: string;
  plano_tipo: string | null;
  data_referencia: string | null;
  valor: number | string | null;
  saldo: number | null;
  anos: number | null;
  nome?: string | null;
  documentos?: number | null;
  dias?: number | null;
  atividade?: string | null;
  horario?: string | null;
}

export function dataBrasilia(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

function dataCurta(iso: string | null): string {
  if (!iso) throw new Error("Aviso sem data de referência");
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}`;
}

function valorBr(valor: number | string | null): string {
  const numero = Number(valor);
  if (valor === null || !Number.isFinite(numero)) throw new Error("Aviso sem valor válido");
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function textoAvisoPortal(aviso: AvisoPortal): { title: string; body: string } {
  switch (aviso.gatilho) {
    case "plano_vencendo_30d":
      return {
        title: "Seu plano vence em 30 dias",
        body: `Seu plano ${aviso.plano_tipo ?? ""} termina em ${dataCurta(aviso.data_referencia)}. Fale com a equipe para renovar e manter seu ritmo.`,
      };
    case "reavaliacao_pendente":
      return {
        title: "Hora da sua reavaliação",
        body: "Sua última avaliação funcional foi há mais de 4 meses. Agende pelo app e acompanhe sua evolução.",
      };
    case "creditos_baixos":
      return {
        title: "Seus créditos estão acabando",
        body: `Restam ${aviso.saldo ?? 0} créditos de treino neste ciclo. Agende seus próximos treinos pelo app.`,
      };
    case "cobranca_atrasada":
      // Multa e juros seguem src/lib/encargosAtraso.ts; o teste de regressão compara as constantes.
      return {
        title: "Mensalidade em aberto",
        body: `Sua mensalidade de R$ ${valorBr(aviso.valor)} venceu em ${dataCurta(aviso.data_referencia)}. Regularize para evitar multa de 2% e juros de 1% ao mês.`,
      };
    case "aniversario_fortem": {
      const anos = aviso.anos ?? 0;
      return {
        title: `${anos} ${anos === 1 ? "ano" : "anos"} de FORTEM`,
        body: "Obrigado por treinar com a gente. Seguimos juntos na sua evolução.",
      };
    }
    case "aniversario_aluno":
      return {
        title: `Feliz aniversário, ${aviso.nome ?? ""}!`,
        body: "A equipe FORTEM deseja um ano de muita saúde e bons treinos.",
      };
    case "documentos_pendentes": {
      const total = aviso.documentos ?? 0;
      return {
        title: "Documento para assinar",
        body: `Você tem ${total} ${total === 1 ? "documento" : "documentos"} aguardando seu aceite. Acesse o app para revisar e aceitar.`,
      };
    }
    case "baixa_frequencia":
      return {
        title: "Sentimos sua falta",
        body: `Faz ${aviso.dias ?? 0} dias desde seu último treino. Que tal voltar esta semana? Agende pelo app.`,
      };
    case "vaga_liberada": {
      const hhmm = (aviso.horario ?? "").slice(0, 5);
      return {
        title: `Vaga liberada às ${hhmm}`,
        body: `Abriu uma vaga em ${aviso.atividade ?? ""} de ${dataCurta(aviso.data_referencia)} às ${hhmm}. Agende pelo app: a vaga fica com quem confirmar primeiro.`,
      };
    }
  }
}
