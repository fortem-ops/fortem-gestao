/** Configuração única do site público. */
export const WHATSAPP_NUMERO = "555135199451";
export const WHATSAPP_EXIBICAO = "(51) 3519-9451";
export const ENDERECO_CURTO = "Av. Independência, 358, Porto Alegre";
export const ENDERECO_COMPLETO = "Av. Independência, 358 · Independência · Porto Alegre/RS";
export const RAZAO_SOCIAL = "Fortem Treinamento Físico Ltda · CNPJ 26.502.263/0001-92";
// Provisório: confirmar endereços oficiais das redes com o dono.
export const REDES = [{ nome: "Instagram", url: "https://www.instagram.com/soufortem" }];

/** Prefixo das rotas do site enquanto está em construção. Vira "" na troca da raiz. */
export const SITE_BASE = "/site";
export const sitePath = (p = "") => `${SITE_BASE}${p}` || "/";

export type OrigemWhatsApp =
  | "home" | "treinamento" | "nutricao" | "reabilitacao" | "avaliacao" | "experimental" | "geral";

export const MENSAGENS_WHATSAPP: Record<OrigemWhatsApp, string> = {
  geral: "Olá! Vim pelo site e quero saber mais sobre a FORTEM.",
  home: "Olá! Vim pelo site e quero saber mais sobre a FORTEM.",
  treinamento: "Olá! Vim pelo site e quero saber mais sobre o treinamento da FORTEM.",
  nutricao: "Olá! Vim pelo site e quero saber mais sobre a nutrição da FORTEM.",
  reabilitacao: "Olá! Vim pelo site e quero saber mais sobre a reabilitação da FORTEM.",
  avaliacao: "Olá! Vim pelo site e quero agendar uma avaliação na FORTEM.",
  experimental: "Olá! Vim pelo site e quero agendar uma aula experimental na FORTEM.",
};

export function linkWhatsApp(origem: OrigemWhatsApp = "geral"): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(MENSAGENS_WHATSAPP[origem])}`;
}
