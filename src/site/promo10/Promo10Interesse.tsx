import {
  descreverInteresse,
  linkWhatsAppPromo10,
  montarMensagemWhatsAppPromo10,
  type InteressePromo10,
} from "@/lib/promo10Texto";

export function Promo10InteresseRegistrado({
  primeiroNome,
  interesses,
  onVoltar,
}: {
  primeiroNome: string;
  interesses: InteressePromo10[];
  onVoltar: () => void;
}) {
  const mensagem = montarMensagemWhatsAppPromo10(primeiroNome, interesses);
  const urlWhats = linkWhatsAppPromo10(mensagem);

  return (
    <section className="space-y-6">
      <div className="p10-card p-6 space-y-3">
        <span className="p10-badge">Interesse registrado</span>
        <h1 className="text-2xl font-black uppercase tracking-tight">Recebemos o seu interesse</h1>
        <p className="text-sm leading-relaxed text-[#d4d4d4]">
          A equipe FORTEM vai falar com você para fechar a condição escolhida. Se preferir, fale agora pelo WhatsApp: a mensagem já vai com os detalhes da sua escolha.
        </p>
      </div>

      <div className="p10-card p-6 space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-[0.1em] text-[#a3a3a3]">Resumo das escolhas</h2>
        <ul className="space-y-3">
          {interesses.map((item) => {
            const { titulo, detalhe } = descreverInteresse(item);
            return (
              <li key={item.codigo_pedido} className="border-t border-[#4a4b4b] pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-extrabold uppercase">{titulo}</p>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#d4d4d4]">{item.codigo_pedido}</span>
                </div>
                <p className="mt-1 text-sm text-[#d4d4d4]">{detalhe}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p10-card p-6 space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#a3a3a3]">Prévia da mensagem</p>
        <pre className="whitespace-pre-wrap border border-[#4a4b4b] bg-[#0e0e0e] p-3 text-xs leading-relaxed text-[#e5e5e5] font-sans">
          {mensagem}
        </pre>
        <a
          href={urlWhats}
          target="_blank"
          rel="noreferrer"
          className="p10-btn-primary flex w-full items-center justify-center px-4 text-sm"
        >
          Falar no WhatsApp
        </a>
      </div>

      <button type="button" onClick={onVoltar} className="p10-btn-secondary w-full px-4 text-xs">
        Voltar às promoções
      </button>
    </section>
  );
}

export function Promo10SemOferta() {
  return (
    <section className="p10-card p-6 space-y-5">
      <h1 className="text-2xl font-black uppercase tracking-tight">Vamos encontrar a melhor opção para você</h1>
      <p className="text-sm leading-relaxed text-[#d4d4d4]">
        Não encontramos uma condição de aniversário disponível para este CPF agora. Fale com a equipe ou conheça os planos da FORTEM.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={linkWhatsAppPromo10("Olá, equipe FORTEM. Gostaria de saber qual a melhor opção de plano para mim.")}
          target="_blank"
          rel="noreferrer"
          className="p10-btn-primary flex flex-1 items-center justify-center px-4 text-xs"
        >
          Falar com a equipe
        </a>
        <a href="/planos" className="p10-btn-secondary flex flex-1 items-center justify-center px-4 text-xs">
          Conhecer os planos
        </a>
      </div>
    </section>
  );
}

export function Promo10Encerradas() {
  return (
    <section className="p10-card p-6 space-y-5">
      <span className="p10-badge">10 ANOS</span>
      <h1 className="text-2xl font-black uppercase tracking-tight">Promoções encerradas</h1>
      <p className="text-sm leading-relaxed text-[#d4d4d4]">
        As condições especiais de aniversário da FORTEM foram válidas até 31/12/2026. Fale com a equipe para conhecer os planos atuais.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href={linkWhatsAppPromo10()}
          target="_blank"
          rel="noreferrer"
          className="p10-btn-primary flex flex-1 items-center justify-center px-4 text-xs"
        >
          Falar com a equipe
        </a>
        <a href="/planos" className="p10-btn-secondary flex flex-1 items-center justify-center px-4 text-xs">
          Conhecer os planos
        </a>
      </div>
    </section>
  );
}