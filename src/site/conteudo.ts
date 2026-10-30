/** Conteúdo editável da home pública (textos aprovados pelo dono). */
export const NOTA_GOOGLE = { nota: "5,0", avaliacoes: 156, url: "https://maps.app.goo.gl/VNhfn5tBSs1CYxgA7" };

export const SERVICOS_HOME = [
  { rotulo: "Treinamento", titulo: "Treino funcional personalizado", texto: "Progressão lógica de movimento e de força, com acompanhamento de perto.", path: "/treinamento" },
  { rotulo: "Nutrição", titulo: "Acompanhamento nutricional", texto: "Aliado ao treino de força, para emagrecimento e hipertrofia com mais rapidez.", path: "/nutricao" },
  { rotulo: "Reabilitação", titulo: "Sessões individuais de fisioterapia", texto: "Foco em mobilidade e força, com informações que orientam o seu treino.", path: "/reabilitacao" },
  { rotulo: "Avaliação", titulo: "Avaliação funcional e de força", texto: "Análise quantitativa de mobilidade articular, flexibilidade e saúde muscular.", path: "/avaliacao" },
];

export const FOTOS_ESTRUTURA = ["área principal de treino", "equipamentos de força", "sala de reabilitação", "consultório de nutrição", "vestiários", "Recepção"];
/** Deixe vazio para ocultar o link do vídeo. */
export const VIDEO_ESTRUTURA_URL = "https://youtu.be/-qUUvtacXAs";
export const NUMEROS_ESTRUTURA = [
  { valor: "220 m²", texto: "de espaço no total" },
  { valor: "150 m²", texto: "de área de treinamento" },
  { valor: "Vestiários", texto: "completos, com chuveiro e secador de cabelo" },
];

const EF = "Bacharel em Educação Física · Especialização em Treinamento Funcional";
export const EQUIPE: { nome: string; funcao: string; formacao: string; registro: string; foto?: string }[] = [
  { nome: "Nicolas Janovik", funcao: "Fundador", formacao: EF, registro: "CREF 020625-G/RS" },
  { nome: "Jonas Hubner", funcao: "Coordenador técnico e instrutor", formacao: EF, registro: "CREF 023941-G/RS" },
  { nome: "Gustavo Dubois", funcao: "Coordenador técnico e instrutor", formacao: EF, registro: "CREF 017313-G/RS" },
  { nome: "Thaís dos Santos", funcao: "Instrutora", formacao: EF, registro: "CREF 037342-G/RS" },
  { nome: "Cristiano Ransolin", funcao: "Instrutor", formacao: EF, registro: "CREF 028513-G/RS" },
  { nome: "Vanessa Coutinho", funcao: "Instrutora", formacao: EF, registro: "CREF 024151-G/RS" },
  { nome: "Yasmim Avila", funcao: "Instrutora", formacao: "Bacharelanda em Educação Física", registro: "" },
  { nome: "Jéssica Elkfury", funcao: "Nutricionista", formacao: "Doutora em Ciências Médicas", registro: "CRN2 13041" },
  { nome: "Júlia Assis Brasil", funcao: "Fisioterapeuta", formacao: "Bacharel em Fisioterapia e Osteopatia", registro: "CREFITO 298489F" },
  { nome: "Bruno Funari", funcao: "Gerente administrativo", formacao: "Bacharel em Administração", registro: "" },
];

export const DEPOIMENTOS: { texto: string; nome: string; tempo: string; destaque?: boolean }[] = [
  { texto: "Foi a primeira vez na minha vida que eu consegui ficar mais de 3 meses fazendo um trabalho de força.", nome: "Felipe D.", tempo: "4 anos de FORTEM" },
  { texto: "Encontrei na Fortem um ambiente que eu consigo me sentir acolhida, que os equipamentos são bons e os professores atualizados.", nome: "Jéssica R.", tempo: "5 anos de FORTEM" },
  { texto: "Aqui eu posso ser quem eu sou, do jeito que eu sou, independente de como sou.", nome: "Eduardo A.", tempo: "7 anos de FORTEM" },
  { destaque: true, nome: "Laís G.", tempo: "1 ano de FORTEM", texto: "Já frequentei outros locais em POA e outros estados (por conta do Wellhub), mas não encontrei a mesma qualidade técnica e dedicação. Conheci a Fortem no início do ano e até hoje me impressiono, de verdade, não to acostumada (rsrs). Desde a aula experimental e avaliação, tive acompanhamento e cuidado diferenciados. Obviamente o treino é individualizado e sempre adaptado aos objetivos de cada pessoa. Não só demonstram a execução, mas ensinam sobre consciência corporal. Está longe de ser uma academia tradicional, quem frequenta a Fortem é muito privilegiado ❤️ muito obrigada, Bruno, Cristiano, Jonas, Nicolas, Thais, Vanessa e, especialmente, Gustavo, pelas orientações e pela atenção. (Isso não é uma despedida, só uma cliente muito feliz hehe)" },
];

export const ETAPAS = [
  { n: "01", titulo: "Treino experimental", texto: "Queremos conhecer seus padrões de movimento e seu condicionamento atual. Você tem o primeiro contato com a metodologia e a estrutura." },
  { n: "02", titulo: "Avaliação funcional e de força", texto: "Análise quantitativa de mobilidade articular, flexibilidade e saúde muscular." },
  { n: "03", titulo: "Plano personalizado", texto: "Estruturamos o treinamento a partir das suas características, limitações e objetivos, junto aos serviços da reabilitação." },
  { n: "04", titulo: "Programa multidisciplinar", texto: "Começamos a programação dos treinos e oferecemos sessões individuais de reabilitação, com foco no que precisa evoluir." },
];

export const PLANOS_HOME = [
  { nome: "Start", sub: "Mensal, sem fidelidade", texto: "Pagamento por recorrência. Cancele quando quiser, com acesso até o fim do ciclo pago." },
  { nome: "Power", sub: "12 meses", texto: "Uma avaliação funcional, 10 dias de licença e brinde camiseta." },
  { nome: "Pro", sub: "12 meses, o mais completo", texto: "Duas avaliações funcionais, 20 dias de licença, horários fixos, bota pneumática e reposição de créditos ao final." },
];

export const HORARIOS = [
  { servico: "Treinamento funcional", linhas: ["Seg e Qua · 06h às 21h", "Ter e Qui · 06h às 13h e 15h às 21h", "Sex · 06h às 20h"] },
  { servico: "Nutrição", linhas: ["Ter · 07h às 20h", "Qua · 10h às 17h"] },
  { servico: "Reabilitação", linhas: ["Seg · 10h às 12h e 15h30 às 20h30", "Qua e Sex · 08h às 13h e 15h30 às 19h30"] },
  { servico: "Grupo de Corrida", linhas: ["Seg e Qua · 07h20 e 07h40", "Ter e Qui · 18h e 18h30", "Sáb · 06h30 às 09h"] },
];
