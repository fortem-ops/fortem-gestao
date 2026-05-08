import { useRef, useState, useEffect, useCallback } from "react";

interface TermsScrollerProps {
  onScrollComplete: (completed: boolean) => void;
  isExperimental?: boolean;
}

const TermsScroller = ({ onScrollComplete, isExperimental }: TermsScrollerProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const progress = clientHeight >= scrollHeight ? 1 : scrollTop / (scrollHeight - clientHeight);
    setScrollProgress(Math.min(progress, 1));
    if (scrollTop + clientHeight >= scrollHeight - 20) onScrollComplete(true);
  }, [onScrollComplete]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="relative">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-secondary z-10">
        <div className="w-full rounded-full bg-primary transition-all duration-150" style={{ height: `${scrollProgress * 100}%` }} />
      </div>
      <div ref={scrollRef} className="ml-4 h-[400px] overflow-y-auto pr-2 space-y-6 scroll-smooth">
        <Section number="1" title="DECLARAÇÃO DE CONDIÇÕES DE SAÚDE">
          <p>Declaro, para os devidos fins, que:</p>
          <ol className="list-[upper-roman] pl-5 space-y-2 mt-2">
            <li>Encontro-me em condições físicas e de saúde adequadas para a prática de atividades físicas, incluindo treinos funcionais, exercícios de força e atividades aeróbicas;</li>
            <li>Não possuo, até a presente data, restrições médicas, doenças, lesões ou condições de saúde que impeçam ou limitem a prática de atividades físicas, exceto aquelas que eventualmente tenham sido informadas previamente à equipe da FORTEM;</li>
            <li>Caso possua qualquer condição de saúde relevante, comprometo-me a apresentar atestado ou liberação médica antes do início ou continuidade das atividades.</li>
          </ol>
        </Section>
        <Section number="2" title="CIÊNCIA DOS RISCOS">
          <p>Declaro estar ciente de que a prática de atividades físicas envolve riscos inerentes, incluindo, mas não se limitando a:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Lesões musculares e articulares</li>
            <li>Quedas</li>
            <li>Mal-estar físico</li>
            <li>Fadiga</li>
            <li>Eventos decorrentes de esforço físico</li>
          </ul>
          <p className="mt-2">E que tais riscos podem ocorrer mesmo com acompanhamento profissional adequado.</p>
        </Section>
        <Section number="3" title="RESPONSABILIDADE E COMPROMISSO">
          <p>Comprometo-me a:</p>
          <ol className="list-[upper-roman] pl-5 space-y-2 mt-2">
            <li>Informar imediatamente qualquer alteração no meu estado de saúde;</li>
            <li>Comunicar dores, desconfortos ou limitações durante os treinos;</li>
            <li>Seguir as orientações dos profissionais da FORTEM;</li>
            <li>Interromper a atividade em caso de sintomas anormais (tontura, dor intensa, falta de ar, etc.).</li>
          </ol>
        </Section>
        {!isExperimental && (
          <Section number="4" title="DIREITO DE USO DE IMAGEM">
            <p>Autorizo, de forma gratuita e livre, a utilização da minha imagem, voz e nome pela FORTEM TREINAMENTO FÍSICO LTDA, para fins de divulgação institucional, publicitária e promocional, em meios digitais e físicos.</p>
            <p className="mt-2">Declaro estar ciente de que esta autorização pode ser revogada a qualquer momento mediante solicitação formal.</p>
          </Section>
        )}
        <Section number="5" title="ISENÇÃO DE RESPONSABILIDADE">
          <p>Declaro que a omissão de informações relevantes sobre minha condição de saúde poderá resultar em riscos à minha integridade física, isentando a FORTEM de responsabilidade por eventuais danos decorrentes dessa omissão.</p>
        </Section>
        <Section number="6" title="AUTORIZAÇÃO EM CASO DE EMERGÊNCIA">
          <p>Autorizo, em caso de emergência, o acionamento de serviços médicos, estando ciente de que eventuais custos decorrentes serão de minha responsabilidade.</p>
        </Section>
        <Section number="7" title="VALIDADE">
          <p>A presente declaração é válida por prazo indeterminado a partir da data de assinatura, devendo ser atualizada em caso de alteração no estado de saúde.</p>
        </Section>
        <Section number="8" title="DECLARAÇÃO FINAL">
          <p>Declaro que li, compreendi e concordo integralmente com todos os termos deste documento, assumindo plena responsabilidade pelas informações prestadas.</p>
        </Section>
      </div>
      <div className="absolute bottom-0 left-4 right-0 h-12 bg-gradient-to-t from-card to-transparent pointer-events-none rounded-b-xl" />
    </div>
  );
};

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <div>
    <h3 className="text-sm font-semibold text-foreground mb-2">{number}. {title}</h3>
    <div className="legal-text">{children}</div>
  </div>
);

export default TermsScroller;
