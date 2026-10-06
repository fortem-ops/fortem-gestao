import marcoPlaceholder from "@/assets/festa10anos/marco-placeholder.jpg";

export type MarcoFesta = {
  ano: string;
  titulo: string;
  texto: string;
  imagem: string;
  imagemAlt: string;
};

export const festa10AnosConfig = {
  dataIso: "2026-11-14",
  dataCurta: "14.11.26",
  dataExtenso: "14 de novembro de 2026",
  horario: "A confirmar",
  local: "A confirmar",
  instagram: {
    usuario: "@sou.fortem",
    url: "https://www.instagram.com/sou.fortem/",
  },
  hero: {
    selo: "SAVE THE DATE",
    titulo: "FORTEM · 10 ANOS",
    texto: "Dez anos de movimento. Uma festa à altura de quem esteve com a gente.",
  },
  historia: {
    titulo: "Nossa história",
    abertura: "Uma década de movimento. Uma história construída por pessoas.",
    marcos: [
      { ano: "2016", titulo: "[EXEMPLO] O primeiro movimento", texto: "Uma ideia ganha espaço, propósito e as primeiras pessoas dispostas a construí-la juntas.", imagem: marcoPlaceholder, imagemAlt: "Imagem neutra de exemplo para o marco de 2016" },
      { ano: "2018", titulo: "[EXEMPLO] Novos caminhos", texto: "A comunidade cresce e o cuidado com cada trajetória passa a alcançar ainda mais pessoas.", imagem: marcoPlaceholder, imagemAlt: "Imagem neutra de exemplo para o marco de 2018" },
      { ano: "2020", titulo: "[EXEMPLO] Movimento que aproxima", texto: "Mesmo diante de novos desafios, seguimos presentes, atentos e próximos de quem confia na FORTEM.", imagem: marcoPlaceholder, imagemAlt: "Imagem neutra de exemplo para o marco de 2020" },
      { ano: "2022", titulo: "[EXEMPLO] Uma nova etapa", texto: "Novos espaços e experiências ampliam a forma de cuidar de saúde, desempenho e longevidade.", imagem: marcoPlaceholder, imagemAlt: "Imagem neutra de exemplo para o marco de 2022" },
      { ano: "2024", titulo: "[EXEMPLO] Mais fortes juntos", texto: "Parcerias, encontros e conquistas consolidam uma história feita em comunidade.", imagem: marcoPlaceholder, imagemAlt: "Imagem neutra de exemplo para o marco de 2024" },
      { ano: "2026", titulo: "[EXEMPLO] Dez anos de FORTEM", texto: "Celebramos tudo o que nos trouxe até aqui e abrimos espaço para o próximo capítulo.", imagem: marcoPlaceholder, imagemAlt: "Imagem neutra de exemplo para o marco de 2026" },
    ] satisfies MarcoFesta[],
  },
  atracoes: [
    { titulo: "DJ", texto: "Música para acompanhar a noite." },
    { titulo: "Bar de drinks", texto: "Uma seleção preparada para o encontro." },
    { titulo: "Chope", texto: "Para brindar uma década de histórias." },
    { titulo: "Comidinhas", texto: "Sabores pensados para compartilhar." },
  ],
  aviso: "Os detalhes chegam logo para você.",
} as const;
