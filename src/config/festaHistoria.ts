/**
 * Conteúdo da seção "Nossa história" em /10anos (texto do dono, sem edição).
 * `oculto: true` esconde o capítulo da página e da navegação.
 * `audio`: caminho do mp3 em /public (ex.: "/audio/festa/2016.mp3"). Vazio = sem botão de ouvir.
 * Use **texto** para negrito.
 */

export type Numero = { valor: string; legenda: string };
export type Capitulo = {
  ano: string;
  titulo: string;
  numeros?: Numero[];
  frase?: string;
  pessoasRotulo?: string;
  pessoas?: string[];
  paragrafos: string[];
  audio?: string;
  /** Sem bloco de fotos (nem "Fotos em breve"). */
  semFotos?: boolean;
  /** Barra do ano em cinza em vez de vermelho. */
  barraCinza?: boolean;
  oculto?: boolean;
};

export const festaHistoriaAbertura = {
  eyebrow: "NOSSA HISTÓRIA",
  titulo: "A HISTÓRIA DA FORTEM",
  subtitulo: "Contada por quem viveu cada capítulo.",
  autor: { rotulo: "QUEM CONTA", nome: "Nícolas", cargo: "Fundador da FORTEM", foto: nicolasFoto.url as string },
  convite:
    "Acredito que, para contar uma história, ninguém melhor do que quem esteve presente desde o começo. Por isso, eu, Nícolas, fundador da FORTEM, te convido a conhecer como tudo começou — os primeiros passos, as conquistas, os desafios e as pessoas que ajudaram a construir o que somos hoje.",
  chamada: "Agora, sim, vamos à história!",
  apresentacaoTitulo: "ANTES DE COMEÇAR: CONHEÇA O NÍCOLAS",
  apresentacao: [
    "Mas, antes de entrar nessa história, deixa eu me apresentar brevemente.",
    "Venho de uma família em que o serviço público sempre esteve muito presente. Meu pai, Roberto, é economista, e minha mãe, Lisane, é professora de Educação Física. Minha irmã, Mayara, é psicóloga e também seguiu por muitos anos no serviço público. Atualmente, atua principalmente como professora do curso de Psicologia da Unisinos.",
    "E eu? Eu escolhi outro caminho: o empreendedorismo.",
    "Sou bacharel em Educação Física pela UFRGS e especialista em treinamento funcional. Nunca tive interesse em seguir carreira pública — tanto que nem sei direito como funciona uma prova para ingressar. Minha trajetória profissional começou no futebol, passando pelo Inter, Canoas, Cerâmica e São José. Depois, deixei o mundo da bola e fui para o treinamento funcional. Me especializei, trabalhei de forma autônoma em um estúdio e, quando percebi, estava dando um passo que mudaria a minha vida: abrindo a FORTEM.",
    "Hoje, minha atuação está muito mais concentrada na gestão da empresa, envolvendo finanças, pessoas e projetos. Mas existe um diferencial importante nessa trajetória: conheço tecnicamente o serviço que oferecemos e compreendo a relevância que ele tem na vida das pessoas. Afinal, esse conhecimento é parte do coração do nosso trabalho e daquilo que nos trouxe até aqui.",
  ],
  narracao: { titulo: "OUVIR A HISTÓRIA", autor: "Narração do Nícolas", duracao: "cerca de 14 min" },
  fechamento: {
    titulo: "QUE VENHAM OS PRÓXIMOS CAPÍTULOS.",
    texto: "E que a gente continue escrevendo cada um deles juntos.",
    botao: "CONFIRMAR PRESENÇA",
  },
};

const EQ = "CHEGARAM À EQUIPE";

export const festaHistoriaCapitulos: Capitulo[] = [
  {
    ano: "2016", titulo: "O sonho começa a sair do papel", audio: "",
    numeros: [{ valor: "25 m²", legenda: "primeira loja" }, { valor: "10 semanas", legenda: "de obra" }, { valor: "500 kg+", legenda: "de entulho retirado" }],
    frase: "A FORTEM só existe porque a minha família acreditou em mim, me apoiou desde o começo e continua ao meu lado.",
    paragrafos: [
      "No dia 16 de outubro de 2016, aluguei a primeira loja da FORTEM: um pequeno espaço de 25 m², na galeria do Shopping Independência.",
      "Era o começo de tudo. Mas, antes de receber os primeiros alunos, havia muito trabalho pela frente.",
      "A obra foi realizada pelas mãos da minha família. Juntos, chegamos a retirar mais de meia tonelada de entulho! Foram dez semanas de trabalho, esforço e dedicação para transformar aquele pequeno espaço no lugar onde o meu sonho começaria a ganhar vida.",
      "Quando olho para trás, lembro não apenas do trabalho que tivemos, mas, principalmente, da energia e do carinho que cada um colocou para me ajudar naquele início. Um apoio que permanece até hoje e que foi fundamental para que a FORTEM chegasse até aqui.",
      "A FORTEM só existe porque a minha família acreditou em mim, me apoiou desde o começo e continua ao meu lado. Essa é uma parte da nossa história que faço questão de reconhecer e agradecer.",
      "Encerramos aquele ano com uma pequena celebração de inauguração entre amigos — a primeira de muitas que ainda viriam.",
      "A estrutura estava pronta. O sonho começava a tomar forma. Faltava abrir as portas e dar início às atividades.",
      "E isso aconteceria logo no início do ano seguinte.",
    ],
  },
  {
    ano: "2017", titulo: "Tudo começa com 25 m²", audio: "",
    numeros: [{ valor: "25 m²", legenda: "primeira loja" }, { valor: "100", legenda: "aulas experimentais" }, { valor: "85%", legenda: "de conversão" }],
    frase: "A FORTEM estava apenas começando, mas já mostrava que tinha potencial para ir além daqueles primeiros 25 m².",
    pessoasRotulo: "PRIMEIROS ALUNOS", pessoas: ["Gabi C.", "Vivian K.", "Bruno Funari"],
    paragrafos: [
      "No dia 4 de janeiro, às 7h, a FORTEM abria as portas e iniciava suas atividades com a primeira aluna, a Gabi C. Na sequência, chegaram a Vivian K. e o Bruno Funari — sim, o nosso Brunão, ou Bruninho, antes de fazer parte da equipe, também era aluno!",
      "Ao longo daquele primeiro ano, a operação ficou praticamente toda nas minhas mãos, com a minha família dando uma mãozinha — ou melhor, colocando bastante a mão na massa — nas tarefas de limpeza e manutenção.",
      "Aos poucos, a capacidade de atendimento foi aumentando. Começamos com três alunos por hora e chegamos a atender até cinco. Para viabilizar esse crescimento, fizemos a primeira adaptação do espaço: retiramos a recepção e ganhamos mais área para os treinos.",
      "Ao final daquele ano, realizamos exatamente 100 aulas experimentais, com uma conversão de 85%. Um resultado simplesmente espetacular para o início de uma operação!",
      "Também me lembro muito bem da rotina daquela época: chegava às 7h e saía às 22h, com um pequeno intervalo para almoçar, descansar e treinar. Era muito trabalho, muita dedicação e uma vontade enorme de fazer aquilo dar certo.",
      "A FORTEM estava apenas começando, mas já mostrava que tinha potencial para ir além daqueles primeiros 25 m².",
    ],
  },
  {
    ano: "2018", titulo: "Crescer, profissionalizar e ampliar", audio: "",
    numeros: [{ valor: "+60 m²", legenda: "nova loja, na mesma galeria" }, { valor: "2", legenda: "modalidades de treino" }],
    frase: "Construir uma empresa que também oferecesse vínculos de trabalho formais era — e continua sendo — motivo de orgulho.",
    pessoasRotulo: EQ, pessoas: ["Rodrigo · professor", "Bruno Funari · administrador", "Pedro Schons · circuito"],
    paragrafos: [
      "Aqueles 25 m² começaram a ficar pequenos. Em janeiro de 2018, surgiu a oportunidade de alugar uma nova loja, de 60 m², na mesma galeria.",
      "Vieram novas obras, a contratação do nosso primeiro professor, Rodrigo, e a chegada de um administrador: o então aluno Bruno Funari.",
      "Como de costume, comemoramos a conquista! Lembro-me de sentir muito orgulho pelo trabalho que estávamos desenvolvendo e, principalmente, por conseguir contratar profissionais pelo regime CLT. Pode parecer algo banal para alguns, mas, ainda hoje, a contratação de profissionais autônomos é muito comum na nossa área. Para mim, construir uma empresa que também oferecesse vínculos de trabalho formais era — e continua sendo — motivo de orgulho.",
      "Naquele ano, também decidimos ampliar nossa oferta de serviços. Passamos a trabalhar com duas modalidades: o treinamento personalizado, que segue até hoje como uma das bases da FORTEM, e o treinamento em circuito.",
      "Para liderar essa segunda modalidade, contratamos o professor Pedro Schons, meu colega de faculdade. Com isso, conseguimos atender a dois públicos com interesses e preferências diferentes em relação aos métodos de treinamento.",
      "A FORTEM continuava crescendo. E, junto com ela, cresciam também nossos objetivos e nossas possibilidades.",
    ],
  },
  {
    ano: "2019", titulo: "Mais gente, mais espaço e novos planos", audio: "",
    numeros: [{ valor: "+25 m²", legenda: "de estrutura" }],
    frase: "A FORTEM ganhava corpo, amadurecia como negócio e se aproximava de um novo objetivo: ocupar o espaço onde hoje funciona a nossa sede.",
    pessoasRotulo: EQ, pessoas: ["Gustavo Dubois", "Arthur Berger", "Jonas Hubner"],
    paragrafos: [
      "Adivinha? Continuamos crescendo!",
      "O número de alunos aumentou, tanto no treinamento personalizado quanto no circuito. Com isso, vieram novas contratações e novas oportunidades.",
      "Gustavo Dubois passou a integrar a equipe do circuito e, hoje, é um dos nossos coordenadores técnicos. Arthur Berger, outro colega da faculdade, entrou para substituir o professor Rodrigo.",
      "Foi o Arthur quem indicou o Jonas Hubner, também nosso colega de faculdade, para atuar nos treinos em circuito. Hoje, junto com o Gustavo, ele faz parte da coordenação técnica da FORTEM.",
      "E não foi só a equipe que cresceu. Conquistamos mais 25 m², ampliando novamente nossa estrutura.",
      "A operação estava a todo vapor, e eu já começava a olhar para o futuro com outros olhos. A FORTEM ganhava corpo, amadurecia como negócio e se aproximava de um novo objetivo: ocupar o espaço onde hoje funciona a nossa sede.",
      "Os planos eram grandes.",
      "Mas, então, chegou 2020.",
    ],
  },
  {
    ano: "2020", titulo: "Quando o mundo parou", audio: "",
    numeros: [{ valor: "120 → 40", legenda: "alunos na pandemia" }],
    frase: "Nem todo crescimento acontece em linha reta.",
    paragrafos: [
      "Veio a pandemia.",
      "Naquele momento, tínhamos 120 alunos. Ao longo dos meses, perdemos cerca de dois terços dessa base e chegamos a aproximadamente 40 alunos.",
      "Foi um período de muita incerteza. Precisamos nos adaptar rapidamente, dividindo a operação entre treinos on-line e presenciais, sempre que as condições permitiam.",
      "Tudo aquilo que havíamos construído até então passou a ser colocado à prova. O cenário era completamente diferente de qualquer coisa que eu pudesse ter imaginado quando abri as portas da FORTEM.",
      "No final daquele ano, manter o aluguel da primeira sede já não fazia sentido financeiramente. Tomamos a decisão de entregar o imóvel e concentrar a operação nas outras duas lojas.",
      "Foi necessário recuar em algumas frentes para continuar avançando. Nem todo crescimento acontece em linha reta, e aquele foi um dos primeiros grandes aprendizados que a FORTEM me proporcionou.",
    ],
  },
  {
    ano: "2021", titulo: "Um passo ousado rumo à nova FORTEM", audio: "",
    numeros: [{ valor: "85 → 220 m²", legenda: "novo espaço" }],
    frase: "Oferecer um serviço de excelência, respeitando as individualidades e valorizando cada pessoa que atendemos.",
    pessoasRotulo: "CHEGOU À EQUIPE", pessoas: ["Renan · professor"],
    paragrafos: [
      "Naquele ano, o Jonas deixou a equipe para viajar pelo Brasil ao lado da Julinha, nossa fisioterapeuta. Para ocupar seu lugar, contratamos o professor Renan.",
      "Enquanto reorganizávamos a equipe, eu também observava as mudanças que aconteciam ao nosso redor. A pandemia havia reforçado, para muitas pessoas, a importância da saúde e da atividade física na prevenção de problemas de saúde e na construção de uma vida melhor.",
      "Foi nesse contexto que, em julho, decidi arriscar e dar um passo ousado: sair dos 85 m² que ocupávamos e encarar um espaço de 220 m², com uma proposta de trabalho multidisciplinar.",
      "Nascia a nova FORTEM!",
      "Novo endereço, nova identidade visual e uma proposta de atendimento ampliada, mas com a mesma essência que nos acompanha até hoje: oferecer um serviço de excelência, respeitando as individualidades e valorizando cada pessoa que atendemos.",
      "A ideia era ir além do treinamento físico e construir um ambiente em que diferentes áreas pudessem trabalhar de forma integrada, colocando o aluno no centro do cuidado.",
      "E as obras? Bem, essa parte merece um capítulo à parte. Vamos pular alguns detalhes, mas já adianto que até calote envolvendo marcenaria e serralheria entrou nessa história!",
      "Nem tudo saiu como planejado, mas seguimos em frente. A nova FORTEM estava tomando forma — literalmente.",
    ],
  },
  {
    ano: "2022", titulo: "A multidisciplinaridade ganha vida", audio: "",
    numeros: [{ valor: "Agosto", legenda: "obras concluídas" }],
    frase: "Mais do que crescer em estrutura, queríamos crescer mantendo o padrão de serviço que acreditávamos ser o correto.",
    pessoasRotulo: EQ, pessoas: ["Julinha · reabilitação", "Júlia Lorenzon · nutrição", "Bruno Victor"],
    paragrafos: [
      "As obras, iniciadas em 2021, só foram concluídas em agosto de 2022, quase um ano depois do início daquela grande transformação.",
      "Com o espaço finalmente pronto, começamos a colocar em prática a proposta multidisciplinar que havíamos idealizado.",
      "Iniciamos os atendimentos de reabilitação com a Julinha — sim, ela e o Jonas voltaram das experiências Brasil afora! Também começamos a oferecer serviços de nutrição, com a Júlia Lorenzon, que se tornou não apenas uma parceira de negócios, mas também minha namorada.",
      "Além do retorno do Jonas, o Bruno Victor também passou a integrar a equipe de profissionais da FORTEM.",
      "Há outro detalhe que considero importante destacar: durante muito tempo, nossa equipe foi formada exclusivamente por profissionais já graduados. Os estagiários só começaram a fazer parte da FORTEM bem mais tarde, algo relativamente incomum na nossa área.",
      "Essa escolha refletia a importância que sempre demos à qualificação técnica e à qualidade do atendimento. Mais do que crescer em estrutura, queríamos crescer mantendo o padrão de serviço que acreditávamos ser o correto.",
      "A nova sede representava muito mais do que um espaço maior. Era o começo de uma nova etapa, com mais possibilidades de cuidado, integração e desenvolvimento.",
    ],
  },
  {
    ano: "2023", titulo: "Aperfeiçoamento e evolução técnica", audio: "",
    frase: "A FORTEM seguia evoluindo, não apenas em tamanho ou número de serviços, mas na maneira de pensar, organizar e entregar o nosso trabalho.",
    pessoasRotulo: EQ, pessoas: ["Eduardo Camargo · fisioterapia", "Júlia Assis Brasil", "Gabi · estágio"],
    paragrafos: [
      "O ano de 2023 foi marcado pelo aperfeiçoamento técnico e metodológico e pelo fortalecimento da nossa proposta multidisciplinar.",
      "O fisioterapeuta Eduardo Camargo passou a compor a equipe e contribuiu muito para o nosso desenvolvimento técnico, trabalhando também em conjunto com a Júlia Assis Brasil.",
      "Seguíamos buscando formas de integrar cada vez mais as diferentes áreas de atuação, aprimorando os processos e qualificando a experiência dos nossos alunos.",
      "Também demos início ao nosso processo de estágio com a Gabi, que permaneceu conosco por alguns meses.",
      "A FORTEM seguia evoluindo, não apenas em tamanho ou número de serviços, mas na maneira de pensar, organizar e entregar o nosso trabalho.",
    ],
  },
  {
    ano: "2024", titulo: "O ano em que tudo mudou", audio: "", semFotos: true, barraCinza: true,
    pessoasRotulo: EQ, pessoas: ["Thaís dos Santos", "Sophia Buchaim · estágio", "Kiko"],
    paragrafos: [
      "2024 foi o ano mais difícil da minha vida e marcou o início de um grande desafio pessoal.",
      "Perdi a Jú Lorenzon. E todos nós perdemos — especialmente aqueles que tiveram o privilégio de conhecê-la e conviver com ela.",
      "Ela partiu para outro plano, deixando saudade, lembranças e marcas que continuam presentes em nossas vidas.",
      "Começo por esse acontecimento porque seria impossível contar a história daquele ano sem reconhecer o quanto ele me afetou. Foi uma perda que transformou minha maneira de enxergar a vida e que trouxe um sentimento com o qual eu ainda precisaria aprender a conviver: o luto.",
      "Mesmo em meio a tudo isso, a FORTEM continuou sua trajetória e novas pessoas chegaram para somar à equipe.",
      "Em janeiro, recebemos a Thaís dos Santos. Entre março e abril, foi a vez da Sophia Buchaim, nossa estagiária. Em setembro, o Kiko também passou a fazer parte do time.",
      "São pessoas e profissionais maravilhosos, que trouxeram muita competência, dedicação e leveza para o nosso dia a dia.",
      "A vida pessoal e a história da empresa nem sempre caminham separadas. Às vezes, uma atravessa a outra de maneira profunda. E 2024 foi, sem dúvida, um desses anos.",
    ],
  },
  {
    ano: "2025", titulo: "Recomeços, propósito e novos caminhos", audio: "",
    numeros: [{ valor: "Novembro", legenda: "início do Grupo de Corrida" }],
    frase: "A FORTEM continuava sendo muito mais do que um negócio. Era também um lugar de convivência, de vínculos e de construção de significado.",
    pessoasRotulo: EQ, pessoas: ["Vanessa · professora", "Jéssica Elkfury · nutrição", "Igor Niederauer · corrida"],
    paragrafos: [
      "Meu 2025 começou com um grande objetivo: buscar — ou reencontrar — a felicidade e aprender a viver com o luto.",
      "Era um desafio novo, que exigia tempo, acolhimento e uma maneira diferente de olhar para a vida.",
      "Encontrei na FORTEM parte desse acolhimento e também um propósito para seguir em frente: dar continuidade aos sonhos que comecei a construir anos antes. E, nesse caminho, encontrei um novo amor, a Marcinha, minha namorada e parceira.",
      "A FORTEM continuava sendo muito mais do que um negócio. Era também um lugar de convivência, de vínculos e de construção de significado.",
      "Na equipe, recebemos a professora Vanessa, que passou a contribuir com todo o seu profissionalismo e a somar ainda mais ao nosso ambiente.",
      "Também tivemos uma nova profissional à frente do consultório de nutrição: a Jéssica Elkfury, que assumiu essa importante área do nosso trabalho.",
      "E foi nesse ano que tiramos do papel mais um projeto: o nosso **Grupo de Corrida**!",
      "Se já oferecíamos treinamento físico, nutrição e reabilitação em um único lugar, por que não ampliar esse cuidado também para quem gosta de correr?",
      "Assim nasceu mais essa frente de atuação da FORTEM. Em novembro, o professor Igor Niederauer deu início ao projeto, abrindo um novo caminho para que pudéssemos acompanhar nossos alunos também fora das paredes da academia, nas ruas e na prática da corrida.",
      "Mais um passo na direção de uma proposta de cuidado cada vez mais completa.",
    ],
  },
  {
    ano: "2026", titulo: "Dez anos de história e novos horizontes", audio: "",
    numeros: [{ valor: "42ª", legenda: "Maratona Internacional de Porto Alegre" }],
    frase: "Algumas coisas continuam iguais: o cuidado com as pessoas, a busca pela excelência e a vontade de fazer um trabalho que realmente faça diferença na vida de quem passa por aqui.",
    pessoasRotulo: "CHEGOU À EQUIPE", pessoas: ["Yasmim Ávila · corrida"],
    paragrafos: [
      "Em 2026, participamos do nosso primeiro grande evento de corrida: a 42ª Maratona Internacional de Porto Alegre. E não poderia haver cenário mais especial para marcar essa etapa da nossa trajetória!",
      "Ainda no primeiro semestre, tivemos uma mudança na equipe da corrida, com a chegada da Yasmim Ávila. Atualmente estagiária, ela assumiu essa frente com muita competência e vem contribuindo para o desenvolvimento do projeto.",
      "Mas este ano também foi marcado por uma mudança no meu próprio trabalho.",
      "Passei a me dedicar a outro tipo de desafio. Nunca trabalhei tanto diante de um computador! Tenho concentrado boa parte da minha energia no desenvolvimento de projetos, na organização da empresa e na construção de novas possibilidades para a FORTEM.",
      "Ainda não vou revelar todos os detalhes, mas posso adiantar que tem novidade vindo por aí.",
      "Ao olhar para esses anos, percebo o quanto a empresa mudou. Começamos em uma pequena loja de 25 m², com uma operação praticamente toda concentrada em mim. Hoje, temos uma estrutura maior, diferentes áreas de atuação, uma equipe que compartilha responsabilidades e muitos projetos pela frente.",
      "Mas algumas coisas continuam iguais: o cuidado com as pessoas, a busca pela excelência e a vontade de fazer um trabalho que realmente faça diferença na vida de quem passa por aqui.",
      "Chegar até este momento é motivo de orgulho. Não apenas pelo que construímos, mas por tudo o que precisamos aprender e superar ao longo do caminho.",
    ],
  },
  {
    ano: "2027", titulo: "O próximo capítulo", audio: "",
    frase: "A FORTEM nasceu de um sonho meu, mas nunca foi construída por uma pessoa só.",
    paragrafos: [
      "Não sei exatamente o que 2027 nos reserva.",
      "Mas espero continuar crescendo profissionalmente, conduzindo a FORTEM a novas conquistas e construindo projetos que nos permitam evoluir sem perder aquilo que nos trouxe até aqui.",
      "Tenho a certeza de que uma parte importante do nosso sucesso está nas pessoas que caminham ao meu lado. São profissionais, parceiros, alunos e amigos que, cada um à sua maneira, ajudam a escrever essa história.",
      "Quando olho para trás, vejo muito mais do que metros quadrados, equipamentos, contratações ou novos serviços. Vejo escolhas, riscos, aprendizados, perdas, recomeços e, acima de tudo, relações construídas ao longo dos anos.",
      "A FORTEM nasceu de um sonho meu, mas nunca foi construída por uma pessoa só.",
      "Ela é feita de todos que passaram por aqui, dos que permanecem e daqueles que, de alguma forma, contribuíram para que chegássemos até este momento.",
      "Por isso, contar a história da FORTEM é também contar a história de muitas pessoas. Pessoas que confiaram no nosso trabalho, vestiram a nossa camiseta, compartilharam desafios e participaram das nossas conquistas.",
      "E, se tem uma coisa que aprendi ao longo dessa trajetória, é que crescer não significa apenas chegar mais longe. Significa saber com quem queremos caminhar e quais valores queremos preservar durante o percurso.",
      "**A nossa história começou há alguns anos, mas está longe de terminar.**",
      "Que venham os próximos capítulos. E que a gente continue escrevendo cada um deles juntos.",
    ],
  },
];

/** Minutos de leitura (~150 palavras/min, mínimo 1). */
export function minutosLeitura(paragrafos: string[]) {
  const palavras = paragrafos.join(" ").replace(/\*\*/g, "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 150));
}
