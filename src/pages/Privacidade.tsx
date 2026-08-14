import { Seo } from "@/components/Seo";

const Privacidade = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Política de Privacidade — Fortem"
        description="Como a Fortem Treinamento Físico coleta, usa e protege os dados pessoais de alunos e visitantes, conforme a LGPD."
        path="/privacidade"
      />
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Fortem Treinamento Físico Ltda. · Última atualização: 30/07/2026
          </p>
        </header>

        <article className="space-y-8 leading-relaxed text-[15px]">
          <section>
            <h2 className="text-xl font-semibold mb-2">1. Quem somos</h2>
            <p>
              A <strong>Fortem Treinamento Físico Ltda.</strong>, inscrita no CNPJ nº
              26.502.263/0001-92, com sede na Av. Independência, 358 – Porto Alegre/RS,
              é um centro de treinamento funcional, nutrição e reabilitação. Para dúvidas
              sobre esta política ou sobre o tratamento de dados pessoais, entre em contato
              pelo e-mail{" "}
              <a href="mailto:contatofortem@gmail.com" className="text-primary underline underline-offset-4">
                contatofortem@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">2. Quais dados coletamos</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Dados de identificação: nome completo, CPF, RG, data de nascimento, endereço, telefone e e-mail;</li>
              <li>Dados de saúde: anamnese, avaliações físicas e informações clínicas necessárias à prescrição de treinos e acompanhamento;</li>
              <li>Histórico de treinos, avaliações e evolução de desempenho;</li>
              <li>Planos contratados e informações relacionadas ao serviço;</li>
              <li>Dados de pagamento: conforme descrito na seção 4 desta política.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">3. Para que usamos os dados</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Gestão de treinos, avaliações e agendamentos;</li>
              <li>Comunicação operacional via WhatsApp, incluindo confirmações de agendamento e lembretes;</li>
              <li>Controle financeiro, cobranças e gestão de planos e contratos;</li>
              <li>Cumprimento de obrigações legais e contratuais.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">4. Compartilhamento de dados</h2>
            <p>
              <strong>Não vendemos seus dados pessoais.</strong> Podemos compartilhá-los
              com os seguintes operadores, exclusivamente para as finalidades indicadas:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-3">
              <li>
                <strong>Rede Itaú S.A.</strong> (CNPJ 60.701.190/0001-04) — processamento
                de pagamentos com cartão de crédito e armazenamento seguro de credenciais
                de pagamento, conforme detalhado na seção 4-A;
              </li>
              <li>
                <strong>Meta Platforms Ireland Ltd.</strong> — envio de mensagens operacionais
                via WhatsApp Business API exclusivamente relacionadas ao seu atendimento
                (confirmações, lembretes e notificações de serviço);
              </li>
              <li>
                <strong>Supabase Inc.</strong> — armazenamento e processamento dos dados
                do sistema em infraestrutura de nuvem com criptografia em repouso e em
                trânsito.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">
              4-A. Tratamento de dados de pagamento (PCI DSS)
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1">Processamento por operadora certificada</h3>
                <p>
                  Os dados de cartão de crédito informados para pagamento ou cadastro de
                  meio de pagamento para cobranças recorrentes são transmitidos diretamente
                  à <strong>Rede Itaú S.A.</strong>, certificada no padrão{" "}
                  <strong>PCI DSS Nível 1</strong> — o mais alto grau de conformidade para
                  processamento de dados de cartão. A Rede Itaú S.A. atua como{" "}
                  <strong>operadora</strong> nos termos do Art. 37 da LGPD.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-1">O que a Fortem NÃO armazena</h3>
                <p>Em conformidade com os requisitos PCI DSS, a Fortem <strong>não coleta,
                não armazena e não registra</strong> em seus sistemas:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Número completo do cartão de crédito (PAN);</li>
                  <li>Código de segurança (CVV/CVC);</li>
                  <li>Dados da trilha magnética ou chip;</li>
                  <li>Senha do cartão.</li>
                </ul>
                <p className="mt-2">
                  Esses dados trafegam exclusivamente entre o dispositivo do titular e os
                  servidores da Rede Itaú S.A., por meio de conexão criptografada (TLS 1.2
                  ou superior), sem armazenamento nos servidores da Fortem.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-1">O que a Fortem armazena</h3>
                <p>
                  Para viabilizar cobranças recorrentes previamente autorizadas, a Fortem
                  armazena exclusivamente:
                </p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li><strong>Token de pagamento</strong> — identificador único fornecido pela Rede Itaú S.A., sem utilidade fora do sistema da Fortem;</li>
                  <li><strong>Últimos 4 dígitos</strong> do cartão (para identificação pelo titular);</li>
                  <li><strong>Bandeira</strong> do cartão (Visa, Mastercard, Elo, Hipercard, etc.);</li>
                  <li><strong>Nome do titular</strong> conforme impresso no cartão;</li>
                  <li><strong>Mês e ano de validade</strong> do cartão.</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-1">Base legal</h3>
                <p>
                  O tratamento tem como base legal o <strong>Art. 7º, inciso V da LGPD</strong>{" "}
                  (execução de contrato) para cobranças decorrentes do plano contratado, e o{" "}
                  <strong>Art. 7º, inciso I</strong> (consentimento) quando o titular autoriza
                  expressamente o armazenamento do cartão para cobranças futuras.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-1">Direitos do titular sobre dados de pagamento</h3>
                <p>O titular pode, a qualquer momento:</p>
                <ul className="list-disc pl-6 space-y-1 mt-2">
                  <li>Visualizar os cartões cadastrados no perfil do aplicativo;</li>
                  <li>Revogar a autorização de armazenamento de qualquer cartão, via aplicativo ou na recepção — o que impedirá cobranças recorrentes futuras;</li>
                  <li>Solicitar a exclusão dos dados de pagamento armazenados, observado que isso implicará na necessidade de novo meio de pagamento para manutenção do contrato.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">5. Retenção de dados</h2>
            <p>
              Mantemos seus dados pelo período de vigência do contrato acrescido de{" "}
              <strong>5 (cinco) anos</strong>, conforme prazos exigidos pela legislação
              brasileira aplicável (civil, tributária e sanitária). Dados de pagamento
              seguem o mesmo prazo, sendo excluídos automaticamente após o período
              de retenção.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">6. Segurança dos dados</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados pessoais,
              incluindo:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Controle de acesso por perfil (administrador, coordenador, professor, aluno);</li>
              <li>Criptografia dos dados em repouso e em trânsito;</li>
              <li>Registro de auditoria de todas as operações sensíveis;</li>
              <li>Autenticação com senha e controle de sessão.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">7. Direitos do titular</h2>
            <p>
              Nos termos da <strong>LGPD (Lei nº 13.709/2018)</strong>, você tem direito a:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Acessar os dados que mantemos sobre você;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a exclusão de dados, respeitados os prazos legais;</li>
              <li>Solicitar a portabilidade dos dados a outro fornecedor;</li>
              <li>Revogar o consentimento a qualquer momento, sem prejuízo da legalidade do tratamento anterior.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">8. Contato</h2>
            <p>
              Para exercer qualquer direito previsto na LGPD ou esclarecer dúvidas sobre
              o tratamento de seus dados, envie sua solicitação para{" "}
              <a href="mailto:contatofortem@gmail.com" className="text-primary underline underline-offset-4">
                contatofortem@gmail.com
              </a>. Responderemos no prazo de até 15 dias úteis, observados os limites legais.
            </p>
          </section>

          <section className="pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Última atualização: <strong>30/07/2026</strong>. Esta política pode ser
              atualizada periodicamente. Alterações relevantes serão comunicadas aos
              titulares com antecedência mínima de 30 dias.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
};

export default Privacidade;
