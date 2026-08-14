import { Helmet } from "react-helmet-async";

const BASE_URL = "https://soufortem.com.br";

export interface SeoProps {
  title: string;
  description: string;
  /** Caminho da rota, ex.: "/corrida". Usado em canonical e og:url. */
  path: string;
  /** Bloqueia indexação em páginas utilitárias (recuperar senha, etc.). */
  noIndex?: boolean;
  /** JSON-LD adicional específico da página. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/**
 * Metadados por rota (title, description, canonical, Open Graph e JSON-LD).
 * As tags sitewide continuam em index.html como fallback para crawlers sem JS.
 */
export function Seo({ title, description, path, noIndex, jsonLd }: SeoProps) {
  const url = `${BASE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}

export default Seo;
