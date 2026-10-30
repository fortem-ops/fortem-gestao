import { SiteLayout } from "../SiteLayout";
import { PlaceholderFoto } from "../components/PlaceholderFoto";
import { ChamadaAcao } from "../components/Blocos";
export { SiteHome } from "./SiteHome";
import { SiteServicoPagina } from "./SiteServicoPagina";
import { linkWhatsApp, sitePath, type OrigemWhatsApp } from "../config";

function Hero({ rotulo, titulo, texto, origem, foto }: { rotulo: string; titulo: string; texto: string; origem: OrigemWhatsApp; foto: string }) {
  return (
    <section className="sp-fundo-preto">
      <div className="sp-container grid items-center gap-8 py-14 md:grid-cols-2 md:py-20">
        <div>
          <p className="sp-rotulo sp-texto-acao !text-[hsl(var(--sp-vermelho))]">{rotulo}</p>
          <h1 className="mt-3 text-4xl leading-tight md:text-5xl">{titulo}</h1>
          <p className="mt-4 max-w-lg text-[hsl(var(--sp-cinza))]">{texto}</p>
          <a href={linkWhatsApp(origem)} target="_blank" rel="noopener noreferrer" className="sp-btn sp-btn-acao mt-8">Falar no WhatsApp</a>
        </div>
        <PlaceholderFoto descricao={foto} />
      </div>
    </section>
  );
}

export { SiteExperimental } from "./SiteExperimental";

export const SiteTreinamento = () => <SiteServicoPagina slug="treinamento" />;
export const SiteNutricao = () => <SiteServicoPagina slug="nutricao" />;
export const SiteReabilitacao = () => <SiteServicoPagina slug="reabilitacao" />;
export const SiteAvaliacao = () => <SiteServicoPagina slug="avaliacao" />;
