/**
 * Conteúdo editável da festa de 10 anos (/10anos).
 * Valores aqui são só para exibição: o servidor recalcula total e prazo por conta própria.
 */

export type MarcoAno = {
  ano: string;
  marcos: string[];
  /** URL da foto do ano. Vazio = bloco discreto "foto em breve". */
  foto?: string;
  fotoAlt?: string;
};

export type OpcaoConsumo = "nao_alcoolico" | "chope" | "drink";
export type OpcaoIntolerancia = "lactose" | "gluten";
export type Vinculo = "aluno_atual" | "ex_aluno" | "amigo_fortem";

export const festa10AnosConfig = {
  dataIso: "2026-11-14",
  dataCurta: "14.11.26",
  dataExtenso: "sábado, 14 de novembro de 2026",
  horario: "das 17h às 00h",
  local: {
    nome: "FORTEM",
    endereco: "Av. Independência, 358",
    cidade: "Porto Alegre, RS",
  },
  /** Último dia para confirmar (fecha às 23:59:59 de Brasília). */
  prazoIso: "2026-11-08",
  prazoTexto: "até 8 de novembro",
  limiteAcompanhantes: 3,
  valores: {
    convidadoCentavos: 7000,
    acompanhanteCentavos: 9000,
    criancaTexto: "Isenta",
    pagamento: "Pagamento por PIX",
  },
  dresscode: {
    titulo: "VERMELHO E PRETO",
    nota: "Salto agulha não é permitido: o piso é irregular e precisa ser preservado.",
  },
  hero: {
    selo: "SAVE THE DATE",
    titulo: "FORTEM · 10 ANOS",
    texto: "Dez anos de movimento. Uma festa à altura de quem esteve com a gente.",
  },
  historia: {
    titulo: "UMA DÉCADA DE MOVIMENTO",
    texto:
      "Uma história construída por pessoas. De uma sala de 25 m² na galeria do Shopping Independência a um centro de treinamento, nutrição e reabilitação.",
    anos: [
      { ano: "2016", marcos: ["16 de outubro: primeira loja alugada, com 25 m², na galeria do Shopping Independência.", "7 de novembro: constituída a empresa."] },
      { ano: "2017", marcos: ["4 de janeiro: abertura das portas.", "Dezembro: 85 alunos atendidos."] },
      { ano: "2018", marcos: ["Nova loja, com mais 60 m².", "Início da equipe: contratação de professores e de um administrador.", "Nova modalidade: Circuito Funcional."] },
      { ano: "2019", marcos: ["Nova loja, com mais 25 m².", "Expansão do quadro de funcionários."] },
      { ano: "2020", marcos: ["Pandemia: de 120 alunos ativos, passamos para 40.", "Entrega da primeira loja."] },
      { ano: "2021", marcos: ["Início das obras da atual sede."] },
      { ano: "2022", marcos: ["Janeiro: início das atividades no novo local.", "Trabalho multidisciplinar: treinamento, nutrição e reabilitação."] },
      { ano: "2023–2024", marcos: ["Ampliação de serviços: avaliação funcional e venda de produtos."] },
      { ano: "2025", marcos: ["Novos formatos de venda de planos.", "Início do Grupo de Corrida."] },
      { ano: "2026", marcos: ["Implementação interna de novo sistema de prescrição de treinos.", "Ampliação estrutural da área de treinamento: mais 12 m².", "App do aluno."] },
    ] satisfies MarcoAno[],
  },
  festa: {
    titulo: "UMA NOITE PARA CELEBRAR",
    atracoes: ["DJ", "Bar de drinks", "Chope", "Comidinhas"],
  },
  programacao: [
    { hora: "17h", item: "Início" },
    { hora: "17h30", item: "Abertura dos drinks" },
    { hora: "18h30", item: "Discurso e sorteios" },
    { hora: "19h30", item: "DJ" },
    { hora: "23h30", item: "Encerramento dos drinks" },
    { hora: "00h", item: "Encerramento da festa" },
  ],
  confirmacao: {
    titulo: "RESERVE A DATA",
    privacidade: "Usamos seus dados apenas para organizar a festa.",
    encerrado: "As confirmações foram encerradas.",
    pixInstrucao:
      "Abra o app do seu banco, escolha pagar com PIX e leia o código. A confirmação é automática assim que o pagamento é identificado.",
  },
  vinculos: [
    { valor: "aluno_atual", rotulo: "Aluno atual" },
    { valor: "ex_aluno", rotulo: "Ex-aluno" },
    { valor: "amigo_fortem", rotulo: "Amigo(a) da FORTEM" },
  ] as { valor: Vinculo; rotulo: string }[],
  consumos: [
    { valor: "nao_alcoolico", rotulo: "Não alcoólico" },
    { valor: "chope", rotulo: "Chope" },
    { valor: "drink", rotulo: "Drink" },
  ] as { valor: OpcaoConsumo; rotulo: string }[],
  intolerancias: [
    { valor: "lactose", rotulo: "Lactose" },
    { valor: "gluten", rotulo: "Glúten" },
  ] as { valor: OpcaoIntolerancia; rotulo: string }[],
} as const;
