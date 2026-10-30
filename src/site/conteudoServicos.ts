/** Conteúdo editável das páginas de serviço (/site/treinamento, nutricao, reabilitacao, avaliacao). */
import type { OrigemWhatsApp } from "./config";

export type Botao = { tipo: "whats"; texto: string } | { tipo: "link"; texto: string; href: string };
export type Item = { titulo: string; texto: string };
export type Bloco =
  | { tipo: "secao"; rotulo?: string; titulo?: string; texto?: string; cards?: Item[]; numeros?: { valor: string; texto: string }[]; foto?: string; botoes?: Botao[]; claro?: boolean }
  | { tipo: "etapas"; titulo: string; itens: Item[] }
  | { tipo: "horarios"; titulo: string; linhas: { dia: string; horario: string }[]; valores?: { nome: string; valor: string }[]; local?: string }
  | { tipo: "pessoas"; rotulo: string; pessoas: { nome: string; funcao?: string; registro?: string; foto?: string; itens?: string[]; frase?: string }[]; nota?: string }
  | { tipo: "faq"; itens: { pergunta: string; resposta: string; link?: { texto: string; href: string } }[] };

export interface PaginaServico {
  origem: OrigemWhatsApp;
  meta: { titulo: string; descricao: string };
  hero: { rotulo: string; titulo: string; texto: string; foto: string; botoes: Botao[] };
  blocos: Bloco[];
  cta: string;
}

const W = (texto: string): Botao => ({ tipo: "whats", texto });
const PLANOS: Botao = { tipo: "link", texto: "Ver planos", href: "/planos" };

export const PAGINAS_SERVICO: Record<"treinamento" | "nutricao" | "reabilitacao" | "avaliacao", PaginaServico> = {
  treinamento: {
    origem: "treinamento",
    meta: { titulo: "Treino funcional em Porto Alegre · FORTEM", descricao: "Treino funcional com acompanhamento de perto, até 4 alunos por professor. Desde 2017 na Avenida Independência, em Porto Alegre." },
    hero: {
      rotulo: "Treinamento", titulo: "TREINO FUNCIONAL COM ACOMPANHAMENTO DE PERTO.",
      texto: "Uma metodologia que respeita seus limites e faz você evoluir, com progressão lógica de movimento e de força e atendimento personalizado.",
      foto: "professor orientando aluno na sala de treino", botoes: [W("Combinar meu treino no WhatsApp"), PLANOS],
    },
    blocos: [
      { tipo: "secao", rotulo: "Método", titulo: "O treino parte do seu objetivo.", texto: "Cada pessoa tem um foco e uma evolução individuais. Se você precisa desenvolver mobilidade, força e resistência, o treino precisa de uma estrutura com progressão lógica na execução dos movimentos e no ganho de força.",
        numeros: [
          { valor: "Até 4 alunos", texto: "por professor em cada turma" },
          { valor: "12 alunos", texto: "no máximo na sala, com 3 professores" },
          { valor: "Desde 2017", texto: "na Avenida Independência, em Porto Alegre" },
        ] },
      { tipo: "etapas", titulo: "Como você começa", itens: [
        { titulo: "Treino experimental", texto: "Conhecemos seus padrões de movimento e seu condicionamento atual." },
        { titulo: "Avaliação funcional e de força", texto: "Mobilidade, flexibilidade e força medidas de forma quantitativa." },
        { titulo: "Plano personalizado", texto: "Treino montado a partir das suas características, limitações e objetivos." },
        { titulo: "Programa multidisciplinar", texto: "Nutrição e reabilitação entram quando fazem sentido para o seu objetivo." },
      ] },
      { tipo: "horarios", titulo: "Horários de treino", linhas: [
        { dia: "Segunda e quarta", horario: "06h às 21h" },
        { dia: "Terça e quinta", horario: "06h às 13h e 15h às 21h" },
        { dia: "Sexta", horario: "06h às 20h" },
      ] },
      { tipo: "pessoas", rotulo: "Quem conduz", pessoas: [
        { nome: "Nicolas Janovik", funcao: "Fundador", registro: "CREF 020625-G/RS" },
        { nome: "Jonas Hubner", funcao: "Coordenador técnico e instrutor", registro: "CREF 023941-G/RS" },
        { nome: "Gustavo Dubois", funcao: "Coordenador técnico e instrutor", registro: "CREF 017313-G/RS" },
        { nome: "Thaís dos Santos", funcao: "Instrutora", registro: "CREF 037342-G/RS" },
        { nome: "Cristiano Ransolin", funcao: "Instrutor", registro: "CREF 028513-G/RS" },
        { nome: "Vanessa Coutinho", funcao: "Instrutora", registro: "CREF 024151-G/RS" },
      ], nota: "Todos com bacharelado em Educação Física e especialização em Treinamento Funcional." },
      { tipo: "faq", itens: [
        { pergunta: "Quantos alunos treinam juntos?", resposta: "Até 4 alunos por professor. A sala comporta no máximo 12 alunos, com 3 professores." },
        { pergunta: "Nunca treinei. Posso começar?", resposta: "Sim. O treino experimental mostra seu condicionamento atual, e a metodologia respeita os seus limites." },
        { pergunta: "Tenho uma lesão ou restrição. Posso treinar?", resposta: "A avaliação funcional e de força identifica suas limitações, e o plano é montado a partir delas, com apoio da reabilitação." },
        { pergunta: "Quanto custa?", resposta: "Os valores dependem da frequência semanal e do plano. Monte o seu em poucos passos na página de planos.", link: { texto: "Ir para a página de planos →", href: "/planos" } },
        { pergunta: "O treino experimental tem custo?", resposta: "Sim, R$ 70. É um treinamento personalizado, em atendimento 1 para 1: o professor avalia seus padrões de movimento, possíveis limitações de movimento e seu nível de condicionamento físico." },
      ] },
    ],
    cta: "Vamos combinar o seu primeiro treino?",
  },
  nutricao: {
    origem: "nutricao",
    meta: { titulo: "Nutricionista em Porto Alegre · FORTEM", descricao: "Acompanhamento nutricional com a nutricionista Jéssica Elkfury, integrado ao seu treino na FORTEM, na Av. Independência, Porto Alegre." },
    hero: {
      rotulo: "Nutrição", titulo: "ALIMENTAÇÃO QUE CABE NA SUA ROTINA.",
      texto: "Acompanhamento nutricional com a nutricionista Jéssica Elkfury, integrado ao seu treino na FORTEM. Plano prático, acessível e coerente com o seu estilo de vida.",
      foto: "Jéssica Elkfury em consulta", botoes: [W("Agendar no WhatsApp")],
    },
    blocos: [
      { tipo: "secao", rotulo: "Áreas de atuação", titulo: "Para cada objetivo, uma estratégia.", cards: [
        { titulo: "Emagrecimento", texto: "Redução de gordura com preservação da massa magra, em um plano personalizado e baseado em evidências, que considera rotina e preferências." },
        { titulo: "Esporte", texto: "Estratégias para melhorar o desempenho e a recuperação pós-treino, a composição corporal e os níveis de energia, força e resistência." },
        { titulo: "Nutrição 50+", texto: "Cuidado com as mudanças metabólicas do climatério, com foco na saúde óssea e muscular, nos fatores de risco cardiovascular, no humor e no sono." },
        { titulo: "Idosos", texto: "Manejo nutricional de pessoas mais frágeis, em condições como Alzheimer, diabetes, hipertensão e disfagia." },
      ] },
      { tipo: "etapas", titulo: "Como funciona a consulta e o acompanhamento", itens: [
        { titulo: "Anamnese", texto: "História clínica, história alimentar, exames bioquímicos, consumo e preferências alimentares." },
        { titulo: "Avaliação física", texto: "Peso, altura e percentual de gordura corporal, por dobras cutâneas e bioimpedância quando necessário." },
        { titulo: "Plano alimentar", texto: "Orientações individualizadas, estratégias comportamentais para a adesão e materiais de apoio, como receitas e e-books." },
        { titulo: "Suporte no WhatsApp", texto: "Acompanhamento das metas combinadas, dúvidas e pequenos ajustes no plano." },
      ] },
      { tipo: "pessoas", rotulo: "Sua nutricionista", pessoas: [
        { nome: "Jéssica Elkfury", funcao: "Nutricionista clínica", registro: "CRN2 13041", foto: "Jéssica Elkfury",
          itens: ["Graduada pela UFRGS", "Mestrado e doutorado em Ciências Médicas pela UFRGS", "ISAK-1: certificação internacional em avaliação física (antropometria)", "Formação em comportamento alimentar"],
          frase: "Sua abordagem une ciência, empatia e estratégias personalizadas, sem restrições excessivas nem julgamentos." },
      ] },
      { tipo: "horarios", titulo: "Horários e valores", linhas: [
        { dia: "Terça", horario: "07h às 20h" },
        { dia: "Quarta", horario: "10h às 17h" },
      ], valores: [
        { nome: "Consulta completa", valor: "R$ 350" },
        { nome: "Pacote de 4 consultas", valor: "R$ 1.320" },
      ], local: "Av. Independência, 358 · Porto Alegre, RS" },
    ],
    cta: "Vamos combinar a sua primeira consulta?",
  },
  reabilitacao: {
    origem: "reabilitacao",
    meta: { titulo: "Fisioterapia e reabilitação em Porto Alegre · FORTEM", descricao: "Sessões individuais de fisioterapia e osteopatia, com foco em mobilidade e força, na FORTEM, Av. Independência, Porto Alegre." },
    hero: {
      rotulo: "Reabilitação", titulo: "SESSÕES INDIVIDUAIS PARA MOVER-SE MELHOR.",
      texto: "Atendimento 1 a 1 de fisioterapia e osteopatia, com foco em mobilidade e força, dentro do mesmo espaço em que você treina.",
      foto: "sessão de reabilitação", botoes: [W("Agendar no WhatsApp")],
    },
    blocos: [
      { tipo: "secao", rotulo: "Como ajudamos", titulo: "Reabilitação que conversa com o seu treino.", texto: "A reabilitação traz informações importantes para desenvolver mobilidade e força, e orienta o que o treino precisa priorizar.", cards: [
        { titulo: "Atendimento 1 a 1", texto: "Sessões individuais com a fisioterapeuta, no seu ritmo." },
        { titulo: "Mobilidade e força", texto: "Foco nos aspectos que precisam evoluir para você treinar melhor." },
        { titulo: "O que tratamos", texto: "Desconfortos como lesões recentes e dores crônicas." },
      ] },
      { tipo: "etapas", titulo: "Como é o atendimento", itens: [
        { titulo: "Avaliação individual", texto: "Avaliamos possíveis desequilíbrios mecânicos e sistêmicos do corpo e as regiões de tensão, pela análise de movimentos específicos e de um toque avaliativo." },
        { titulo: "Terapia manual e exercícios", texto: "Técnicas de terapia manual para liberar tensões e exercícios terapêuticos de força, consciência corporal, mobilidade, estabilidade, respiração e relaxamento, planejados a partir das demandas do seu corpo." },
        { titulo: "Prevenção de lesões", texto: "Usamos a avaliação funcional de mobilidade e de força, com dinamômetro, para elaborar um plano de prevenção de possíveis lesões." },
      ] },
      { tipo: "secao", rotulo: "Valor por sessão", claro: true, cards: [
        { titulo: "1 a 3 sessões", texto: "R$ 175 cada · até 2x sem juros" },
        { titulo: "4 a 10 sessões", texto: "R$ 150 cada · até 4x sem juros" },
        { titulo: "11 sessões ou mais", texto: "R$ 150 cada · até 8x sem juros" },
      ] },
      { tipo: "horarios", titulo: "Horários", linhas: [
        { dia: "Segunda", horario: "10h às 12h e 15h30 às 20h30" },
        { dia: "Quarta e sexta", horario: "08h às 13h e 15h30 às 19h30" },
      ] },
      { tipo: "pessoas", rotulo: "Sua fisioterapeuta", pessoas: [
        { nome: "Júlia Assis Brasil", funcao: "Bacharel em Fisioterapia e Osteopatia", registro: "CREFITO 298489F", foto: "Júlia Assis Brasil" },
      ] },
      { tipo: "faq", itens: [
        { pergunta: "O atendimento é individual?", resposta: "Sim. As sessões são 1 a 1 com a fisioterapeuta." },
        { pergunta: "Preciso ser aluno da FORTEM?", resposta: "Não. A reabilitação é aberta a quem quiser agendar." },
        { pergunta: "Preciso de indicação médica?", resposta: "Não. Você pode agendar sem indicação médica." },
      ] },
    ],
    cta: "Vamos combinar a sua primeira sessão?",
  },
  avaliacao: {
    origem: "avaliacao",
    meta: { titulo: "Avaliação funcional e de força em Porto Alegre · FORTEM", descricao: "Avaliação quantitativa de mobilidade articular, flexibilidade muscular e força com dinamômetro, na FORTEM, em Porto Alegre." },
    hero: {
      rotulo: "Avaliação funcional e de força", titulo: "MEÇA O QUE HOJE VOCÊ SÓ SENTE.",
      texto: "Avaliação quantitativa da mobilidade articular, da flexibilidade muscular e dos níveis de força com dinamômetro, para orientar o seu treino com dados.",
      foto: "avaliação com dinamômetro", botoes: [W("Agendar no WhatsApp")],
    },
    blocos: [
      { tipo: "secao", rotulo: "O que é medido", titulo: "Três frentes, um mesmo objetivo: treinar com segurança.", cards: [
        { titulo: "Mobilidade articular", texto: "Quanto cada articulação se move, e onde existem limitações." },
        { titulo: "Flexibilidade muscular", texto: "O comprimento e a liberdade de movimento dos músculos." },
        { titulo: "Força com dinamômetro", texto: "A força de grupos musculares dos membros superiores e inferiores, medida em quilos, de cada lado." },
      ] },
      { tipo: "secao", rotulo: "O relatório", titulo: "Você recebe os seus números, não uma opinião.", claro: true, texto: "O relatório mostra a assimetria de força entre o lado direito e o esquerdo, os indicativos de risco, o seu histórico em relação a valores de referência e a evolução entre as avaliações.", foto: "página de exemplo do relatório (dados de aluno anonimizados)" },
      { tipo: "secao", rotulo: "Valor", titulo: "Avaliação funcional e de força R$ 250", texto: "Para alunos: desconto, e em alguns planos a avaliação já está incluída.", botoes: [W("Agendar no WhatsApp"), PLANOS] },
      { tipo: "faq", itens: [
        { pergunta: "Preciso ser aluno para fazer a avaliação?", resposta: "Não. A avaliação também é aberta a quem não é aluno, e não exige indicação médica." },
        { pergunta: "Quanto tempo dura?", resposta: "Cerca de 1 hora." },
        { pergunta: "O que acontece depois da avaliação?", resposta: "Os resultados orientam o seu plano de treino personalizado, considerando limitações e objetivos." },
        { pergunta: "Posso repetir a avaliação?", resposta: "Sim. O relatório acompanha a evolução da assimetria entre uma avaliação e outra." },
      ] },
    ],
    cta: "Vamos agendar a sua avaliação?",
  },
};
