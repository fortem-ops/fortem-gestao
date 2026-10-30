/** SEO do site público: domínio canônico, imagem de compartilhamento e dados estruturados (JSON-LD). */
import { EMAIL_CONTATO, MAPA_URL, REDES, WHATSAPP_NUMERO } from "./config";

export const SITE_URL = "https://www.soufortem.com.br";
export const SITE_NOME = "FORTEM";
/** Imagem de compartilhamento (troque aqui quando houver a definitiva; 1200x630 recomendado). */
export const OG_IMAGEM = `${SITE_URL}/og-fortem.png`;

export const urlCanonica = (path: string) => `${SITE_URL}${path === "/" ? "/" : path}`;

type JsonLd = Record<string, unknown>;

export function jsonLdNegocio(): JsonLd {
  const h = (dias: string[], abre: string, fecha: string) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: dias.map((d) => `https://schema.org/${d}`),
    opens: abre,
    closes: fecha,
  });
  return {
    "@context": "https://schema.org",
    "@type": "ExerciseGym",
    "@id": `${SITE_URL}/#negocio`,
    name: SITE_NOME,
    legalName: "Fortem Treinamento Físico Ltda",
    url: `${SITE_URL}/`,
    image: OG_IMAGEM,
    logo: `${SITE_URL}/fortem-logo.png`,
    telephone: `+${WHATSAPP_NUMERO}`,
    email: EMAIL_CONTATO,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. Independência, 358",
      addressLocality: "Porto Alegre",
      addressRegion: "RS",
      postalCode: "90035-070",
      addressCountry: "BR",
    },
    hasMap: MAPA_URL,
    sameAs: REDES.map((r) => r.url),
    openingHoursSpecification: [
      h(["Monday", "Wednesday"], "06:00", "21:00"),
      h(["Tuesday", "Thursday"], "06:00", "13:00"),
      h(["Tuesday", "Thursday"], "15:00", "21:00"),
      h(["Friday"], "06:00", "20:00"),
    ],
  };
}

export function jsonLdServico(nome: string, descricao: string, path: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: nome,
    description: descricao,
    url: urlCanonica(path),
    areaServed: { "@type": "City", name: "Porto Alegre" },
    provider: { "@id": `${SITE_URL}/#negocio`, "@type": "ExerciseGym", name: SITE_NOME, url: `${SITE_URL}/` },
  };
}

export function jsonLdFaq(itens: { pergunta: string; resposta: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: itens.map((f) => ({
      "@type": "Question",
      name: f.pergunta,
      acceptedAnswer: { "@type": "Answer", text: f.resposta },
    })),
  };
}
