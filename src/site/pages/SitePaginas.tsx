import { SiteLayout } from "../SiteLayout";
import { PlaceholderFoto } from "../components/PlaceholderFoto";
import { ChamadaAcao, Depoimentos, Horarios } from "../components/Blocos";
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

export function SiteHome() {
  return (
    <SiteLayout titulo="FORTEM · Treinamento, nutrição e reabilitação em Porto Alegre" descricao="Centro de treinamento funcional, nutrição e reabilitação na Av. Independência, 358, Porto Alegre." path={sitePath()} origem="home">
      <Hero rotulo="Porto Alegre · desde 2016" titulo="Treinamento funcional, nutrição e reabilitação" texto="Conteúdo da home entra na Etapa 2." origem="home" foto="treino na FORTEM" />
      <section id="estrutura" className="py-16"><div className="sp-container"><p className="sp-rotulo sp-texto-acao">Estrutura</p><h2 className="mt-2 text-3xl">Em construção</h2></div></section>
      <section id="equipe" className="pb-16"><div className="sp-container"><p className="sp-rotulo sp-texto-acao">Equipe</p><h2 className="mt-2 text-3xl">Em construção</h2></div></section>
      <Depoimentos />
      <Horarios />
      <ChamadaAcao origem="home" />
    </SiteLayout>
  );
}

const SERVICOS: Record<string, { titulo: string; descricao: string; origem: OrigemWhatsApp }> = {
  treinamento: { titulo: "Treinamento", descricao: "Treinamento funcional com acompanhamento na FORTEM, em Porto Alegre.", origem: "treinamento" },
  nutricao: { titulo: "Nutrição", descricao: "Acompanhamento nutricional integrado ao seu treino na FORTEM, em Porto Alegre.", origem: "nutricao" },
  reabilitacao: { titulo: "Reabilitação", descricao: "Reabilitação e fisioterapia para você voltar a treinar com segurança na FORTEM.", origem: "reabilitacao" },
  avaliacao: { titulo: "Avaliação", descricao: "Avaliação física completa para começar seu treino na FORTEM, em Porto Alegre.", origem: "avaliacao" },
};

export function SiteServico({ slug }: { slug: keyof typeof SERVICOS }) {
  const s = SERVICOS[slug];
  return (
    <SiteLayout titulo={`${s.titulo} · FORTEM Porto Alegre`} descricao={s.descricao} path={sitePath(`/${slug}`)} origem={s.origem}>
      <Hero rotulo="Serviços" titulo={s.titulo} texto={`${s.descricao} Conteúdo completo na Etapa 3.`} origem={s.origem} foto={s.titulo.toLowerCase()} />
      <ChamadaAcao origem={s.origem} />
    </SiteLayout>
  );
}

export function SiteExperimental() {
  return (
    <SiteLayout minimo titulo="Aula experimental · FORTEM Porto Alegre" descricao="Agende sua aula experimental na FORTEM pelo WhatsApp." path={sitePath("/experimental")} origem="experimental">
      <Hero rotulo="Aula experimental" titulo="Venha conhecer a FORTEM" texto="Conteúdo da campanha entra na Etapa 4." origem="experimental" foto="aula experimental" />
      <ChamadaAcao titulo="Agende sua aula experimental" origem="experimental" />
    </SiteLayout>
  );
}

export const SiteTreinamento = () => <SiteServico slug="treinamento" />;
export const SiteNutricao = () => <SiteServico slug="nutricao" />;
export const SiteReabilitacao = () => <SiteServico slug="reabilitacao" />;
export const SiteAvaliacao = () => <SiteServico slug="avaliacao" />;
