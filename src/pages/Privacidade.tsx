const Privacidade = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Fortem Gestão Técnica · Última atualização: 01/07/2026
          </p>
        </header>

        <article className="space-y-8 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Quem somos</h2>
            <p>
              A <strong>Fortem Gestão Técnica</strong> é um centro de treinamento,
              nutrição e reabilitação localizado em Porto Alegre/RS. Para dúvidas
              sobre esta política ou tratamento de dados pessoais, entre em contato
              pelo e-mail{" "}
              <a
                href="mailto:contatofortem@gmail.com"
                className="text-primary underline underline-offset-4"
              >
                contatofortem@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Quais dados coletamos</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Dados de identificação: nome, telefone e e-mail;</li>
              <li>
                Dados de saúde: anamnese, avaliações físicas e informações
                clínicas necessárias à prescrição de treinos e acompanhamento;
              </li>
              <li>Histórico de treinos e evolução de desempenho;</li>
              <li>Planos contratados e informações relacionadas ao serviço.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Para que usamos os dados</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gestão de treinos, avaliações e agendamentos;</li>
              <li>
                Comunicação operacional via WhatsApp, incluindo confirmações
                de agendamento e lembretes;
              </li>
              <li>Controle financeiro, cobranças e gestão de planos contratados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Compartilhamento de dados</h2>
            <p>
              <strong>Não vendemos seus dados pessoais.</strong> Podemos
              compartilhá-los com processadores de pagamento (por exemplo,
              Stripe e Rede) para viabilizar cobranças e com a Meta (WhatsApp
              Business API) exclusivamente para o envio de mensagens
              operacionais relacionadas ao seu atendimento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Retenção de dados</h2>
            <p>
              Mantemos seus dados pelo período de vigência do contrato acrescido
              de 5 (cinco) anos, conforme prazos exigidos pela legislação
              brasileira aplicável (civil, tributária e sanitária).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Direitos do titular</h2>
            <p>
              Nos termos da <strong>LGPD (Lei nº 13.709/2018)</strong>, você tem
              direito a:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Acessar os dados que mantemos sobre você;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a exclusão de dados, respeitados os prazos legais;</li>
              <li>Solicitar a portabilidade dos dados a outro fornecedor.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              7. Contato para exercer direitos
            </h2>
            <p>
              Para exercer qualquer direito previsto na LGPD, envie sua
              solicitação para{" "}
              <a
                href="mailto:contatofortem@gmail.com"
                className="text-primary underline underline-offset-4"
              >
                contatofortem@gmail.com
              </a>
              . Responderemos no menor prazo possível, observados os limites
              legais.
            </p>
          </section>

          <section className="pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Última atualização: <strong>01/07/2026</strong>.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
};

export default Privacidade;
