import foto0 from "@/assets/fotos/home-hero.webp.asset.json";
import foto1 from "@/assets/fotos/experimental-hero.webp.asset.json";
import foto2 from "@/assets/fotos/equipe-nicolas.webp.asset.json";
import foto3 from "@/assets/fotos/equipe-gustavo.webp.asset.json";
import foto4 from "@/assets/fotos/equipe-thais.webp.asset.json";
import foto5 from "@/assets/fotos/equipe-cristiano.webp.asset.json";
import foto6 from "@/assets/fotos/equipe-bruno.webp.asset.json";
import foto7 from "@/assets/fotos/estrutura-area-treino.webp.asset.json";
import foto8 from "@/assets/fotos/estrutura-equipamentos.webp.asset.json";
import foto9 from "@/assets/fotos/estrutura-reabilitacao.webp.asset.json";
import foto10 from "@/assets/fotos/estrutura-nutricao.webp.asset.json";
import foto11 from "@/assets/fotos/estrutura-vestiarios-1.webp.asset.json";
import foto12 from "@/assets/fotos/estrutura-recepcao.webp.asset.json";
import foto13 from "@/assets/fotos/treinamento-orientacao.webp.asset.json";
import foto14 from "@/assets/fotos/avaliacao-dinamometro.webp.asset.json";

/** Fotos reais do site, com dimensões intrínsecas e descrição da cena. */
export const FOTOS_SITE = {
  "home-hero": { src: foto0.url, width: 1920, height: 1279, descricao: "Pessoas treinando com barras e pesos na área de treinamento da FORTEM" },
  "experimental-hero": { src: foto1.url, width: 1920, height: 1280, descricao: "Pessoa realizando exercício com barra acompanhada por um profissional" },
  "equipe-nicolas": { src: foto2.url, width: 900, height: 1200, descricao: "Profissional sorrindo, de braços cruzados, na área de treino" },
  "equipe-gustavo": { src: foto3.url, width: 900, height: 1200, descricao: "Profissional de camiseta preta diante dos equipamentos de treino" },
  "equipe-thais": { src: foto4.url, width: 900, height: 1200, descricao: "Profissional sorrindo, de camiseta preta, na área de treino" },
  "equipe-cristiano": { src: foto5.url, width: 900, height: 1200, descricao: "Profissional sorrindo diante dos equipamentos de treino" },
  "equipe-bruno": { src: foto6.url, width: 900, height: 1200, descricao: "Profissional sorrindo, de moletom preto, na área de treino" },
  "estrutura-area-treino": { src: foto7.url, width: 1280, height: 720, descricao: "Área de treino com piso emborrachado, equipamentos e paredes vermelhas" },
  "estrutura-equipamentos": { src: foto8.url, width: 1280, height: 853, descricao: "Barras, anilhas e estruturas de força na área de treino" },
  "estrutura-reabilitacao": { src: foto9.url, width: 1280, height: 720, descricao: "Sala de reabilitação com maca e bancada" },
  "estrutura-nutricao": { src: foto10.url, width: 1280, height: 720, descricao: "Consultório de nutrição com mesa e cadeiras" },
  "estrutura-vestiarios-1": { src: foto11.url, width: 1280, height: 720, descricao: "Vestiário com pias, espelhos e portas vermelhas" },
  "estrutura-recepcao": { src: foto12.url, width: 1280, height: 720, descricao: "Recepção com balcão vermelho e bancos altos" },
  "treinamento-orientacao": { src: foto13.url, width: 1280, height: 853, descricao: "Profissional observando uma pessoa durante exercício na área de treino" },
  "avaliacao-dinamometro": { src: foto14.url, width: 1280, height: 853, descricao: "Pessoa consultando um tablet durante avaliação de força com equipamento" },
};

export const FOTOS_EQUIPE = {
  "Nicolas Janovik": FOTOS_SITE["equipe-nicolas"],
  "Gustavo Dubois": FOTOS_SITE["equipe-gustavo"],
  "Thaís dos Santos": FOTOS_SITE["equipe-thais"],
  "Cristiano Ransolin": FOTOS_SITE["equipe-cristiano"],
  "Bruno Funari": FOTOS_SITE["equipe-bruno"],
};

export const FOTOS_ESTRUTURA_SITE = [
  FOTOS_SITE["estrutura-area-treino"],
  FOTOS_SITE["estrutura-equipamentos"],
  FOTOS_SITE["estrutura-reabilitacao"],
  FOTOS_SITE["estrutura-nutricao"],
  FOTOS_SITE["estrutura-vestiarios-1"],
  FOTOS_SITE["estrutura-recepcao"],
];
