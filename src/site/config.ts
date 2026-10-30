/** Configuração única do site público. */
export const WHATSAPP_NUMERO = "555135199451";
export const WHATSAPP_EXIBICAO = "(51) 3519-9451";
export const ENDERECO_CURTO = "Av. Independência, 358, Porto Alegre";
export const ENDERECO_COMPLETO = "Av. Independência, 358 · Porto Alegre, RS · 90035-070";
export const EMAIL_CONTATO = "contatofortem@gmail.com";
export const RAZAO_SOCIAL = "Fortem Treinamento Físico Ltda · CNPJ 26.502.263/0001-92";
export const MAPA_URL = "https://maps.app.goo.gl/VNhfn5tBSs1CYxgA7";
/** Redes com url vazia ficam ocultas. */
export const REDES = [
  { nome: "Instagram", rotulo: "Instagram @sou.fortem", url: "https://www.instagram.com/sou.fortem" },
  { nome: "Facebook", rotulo: "Facebook", url: "" },
  { nome: "YouTube", rotulo: "YouTube", url: "https://www.youtube.com/@sou.fortem" },
].filter((r) => r.url);
/** Painel da equipe (protegido por login). */
export const PORTAL_EQUIPE_PATH = "/equipe";

/** Prefixo das rotas do site ("" = raiz). Âncoras viram "/#id" para funcionar de qualquer página. */
export const SITE_BASE = "";
export const sitePath = (p = "") => `${SITE_BASE}${p.startsWith("#") ? `/${p}` : p}` || "/";

export type OrigemWhatsApp =
  | "home" | "treinamento" | "nutricao" | "reabilitacao" | "avaliacao" | "experimental" | "geral"
  | "experimental-hero" | "experimental-cta-final" | "experimental-topo" | "corrida" | "loja" | "planos";

export const MENSAGENS_WHATSAPP: Record<OrigemWhatsApp, string> = {
  geral: "Olá! Vim pelo site e quero saber mais sobre a FORTEM.",
  home: "Olá! Vim pelo site e quero saber mais sobre a FORTEM.",
  treinamento: "Olá! Vim pelo site e quero saber mais sobre o treinamento da FORTEM.",
  nutricao: "Olá! Vim pelo site e quero saber mais sobre a nutrição da FORTEM.",
  reabilitacao: "Olá! Vim pelo site e quero saber mais sobre a reabilitação da FORTEM.",
  avaliacao: "Olá! Vim pelo site e quero agendar uma avaliação na FORTEM.",
  experimental: "Olá! Vim pelo site e quero agendar uma aula experimental na FORTEM.",
  "experimental-hero": "Olá! Vim pelo site e quero agendar uma aula experimental na FORTEM.",
  "experimental-cta-final": "Olá! Vim pelo site e quero agendar uma aula experimental na FORTEM.",
  "experimental-topo": "Olá! Vim pelo site e quero agendar uma aula experimental na FORTEM.",
  corrida: "Olá! Vim pelo site e quero saber mais sobre a corrida da FORTEM.",
  planos: "Olá! Vim pelo site e quero saber mais sobre os planos da FORTEM.",
  loja: "Olá! Vim pelo site e tenho uma dúvida sobre a loja da FORTEM.",
};

export function linkWhatsApp(origem: OrigemWhatsApp = "geral"): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(MENSAGENS_WHATSAPP[origem])}`;
}
