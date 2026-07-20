
CREATE TABLE public.knowledge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  icone text,
  ordem smallint NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_categories TO authenticated;
GRANT ALL ON public.knowledge_categories TO service_role;

ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_knowledge_categories" ON public.knowledge_categories FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_knowledge_categories" ON public.knowledge_categories FOR SELECT TO authenticated USING (ativo = true);

CREATE TABLE public.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.knowledge_categories(id) ON DELETE CASCADE,
  pergunta text NOT NULL,
  resposta text NOT NULL,
  palavras_chave text[] DEFAULT '{}',
  aliases text[] DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  visualizacoes integer NOT NULL DEFAULT 0,
  util_sim integer NOT NULL DEFAULT 0,
  util_nao integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.knowledge_articles (category_id);
CREATE INDEX ON public.knowledge_articles USING GIN (palavras_chave);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_articles TO authenticated;
GRANT ALL ON public.knowledge_articles TO service_role;

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_knowledge_articles" ON public.knowledge_articles FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_read_knowledge_articles" ON public.knowledge_articles FOR SELECT TO authenticated USING (ativo = true);

CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  escalou_para_humano boolean NOT NULL DEFAULT false,
  escalou_em timestamptz,
  resolvido boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all_conversations" ON public.assistant_conversations FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY "aluno_own_conversations" ON public.assistant_conversations FOR ALL TO authenticated USING (aluno_id = public.fn_current_aluno_id()) WITH CHECK (aluno_id = public.fn_current_aluno_id());

INSERT INTO public.knowledge_categories (nome, descricao, icone, ordem) VALUES
  ('Agendamento', 'Dúvidas sobre agendamento e cancelamento de treinos', 'CalendarDays', 1),
  ('Créditos', 'Saldo, validade e débito de créditos', 'CreditCard', 2),
  ('Plano', 'Planos, trancamento, cancelamento e upgrades', 'Shield', 3),
  ('Avaliação Funcional', 'O que é, quando fazer e como interpretar', 'Activity', 4),
  ('Serviços', 'Nutrição, reabilitação e outros serviços', 'HeartPulse', 5),
  ('Pagamento', 'Renovação, cartão e cobranças', 'Banknote', 6),
  ('Acesso e Estrutura', 'Horários, unidades e funcionamento', 'MapPin', 7),
  ('Treinos', 'Fichas, exercícios, cargas e progressão', 'Dumbbell', 8);

INSERT INTO public.knowledge_articles (category_id, pergunta, resposta, palavras_chave, aliases) VALUES
((SELECT id FROM public.knowledge_categories WHERE nome = 'Agendamento'),
'Como cancelar um treino agendado?',
'Você pode cancelar seu treino diretamente pelo app, na aba Agenda → Meus Agendamentos. Toque no botão "Cancelar" ao lado do treino desejado. Importante: cancelamentos com menos de 1 hora de antecedência não estornam o crédito — ele será debitado normalmente.',
ARRAY['cancelar','treino','agendamento','desmarcar','cancelamento'],
ARRAY['como cancelo meu treino','quero cancelar','desmarcar treino','como desmarco']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Agendamento'),
'Posso agendar treinos com quantos dias de antecedência?',
'Você pode agendar treinos com até 30 dias de antecedência. O calendário no app mostra os próximos 30 dias com os horários disponíveis e o número de vagas em cada turma.',
ARRAY['agendar','antecedência','dias','calendário','prazo'],
ARRAY['quantos dias posso agendar','até quando posso agendar','prazo agendamento']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Agendamento'),
'O que acontece quando a turma está lotada?',
'Quando todas as vagas de um horário estão preenchidas, você pode entrar na lista de espera. Se uma vaga abrir por cancelamento de outro aluno, você receberá uma notificação e poderá agendar normalmente.',
ARRAY['lotado','sem vagas','lista de espera','fila','vaga'],
ARRAY['turma lotada','não tem vaga','lista espera','fila de espera']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Agendamento'),
'Posso ter mais de um treino agendado no mesmo dia?',
'Não. O sistema permite apenas um agendamento de treino por dia. Isso garante que todos os alunos tenham acesso às vagas disponíveis de forma justa.',
ARRAY['dois treinos','mesmo dia','duplicar','dois agendamentos'],
ARRAY['posso treinar duas vezes','dois treinos no mesmo dia']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Créditos'),
'Como funcionam os créditos de treino?',
'Os créditos de treino são debitados automaticamente quando você agenda um treino. Se cancelar com mais de 1 hora de antecedência, o crédito é estornado. Faltando menos de 1 hora ou em caso de falta, o crédito não é devolvido. Seu saldo atual aparece na tela inicial do app.',
ARRAY['créditos','débito','saldo','crédito treino','funciona'],
ARRAY['como funcionam os créditos','o que são créditos','como funciona o crédito']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Créditos'),
'Quando meus créditos são renovados?',
'Seus créditos são renovados conforme a data de renovação do seu plano, que aparece no card de créditos na tela inicial. Planos anuais têm todos os créditos liberados no início. Planos em recorrência renovam mensalmente.',
ARRAY['renovação','renovar','quando','créditos novos','ciclo'],
ARRAY['quando renovam meus créditos','data renovação']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Créditos'),
'O que acontece se eu faltar a um treino agendado?',
'Se você não comparecer a um treino agendado sem cancelar previamente, o crédito é debitado normalmente. Para evitar isso, cancele pelo app com pelo menos 1 hora de antecedência.',
ARRAY['falta','faltar','não comparecer','ausência','perder crédito'],
ARRAY['faltei ao treino','não fui ao treino','o que acontece se eu faltar']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Plano'),
'Como funciona o trancamento do plano?',
'O trancamento pausa temporariamente seu plano sem perder os créditos restantes. O prazo disponível varia: Start+: até 10 dias, Power: até 15 dias, Pro: até 20 dias, Max: até 30 dias por ano. Solicite pelo app em Perfil → Gerenciar Plano → Trancar plano.',
ARRAY['trancamento','trancar','pausar','plano','suspender'],
ARRAY['como tranco meu plano','posso pausar meu plano','trancar plano']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Plano'),
'Como cancelar meu plano?',
'O cancelamento pode ser solicitado pelo app em Perfil → Gerenciar Plano → Cancelar plano. Após a solicitação, nossa equipe entrará em contato para finalizar o processo e calcular eventuais multas conforme seu contrato. Antes de cancelar, considere o trancamento como alternativa.',
ARRAY['cancelar','cancelamento','encerrar','rescisão','sair'],
ARRAY['quero cancelar meu plano','como cancelo','encerrar contrato']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Plano'),
'Posso fazer upgrade do meu plano?',
'Sim! Você pode fazer upgrade de plano ou de frequência semanal a qualquer momento. Acesse Perfil → Gerenciar Plano → Upgrade de plano ou Upgrade de frequência. Você será direcionado para o WhatsApp da equipe FORTEM para finalizar.',
ARRAY['upgrade','mudar plano','aumentar frequência','melhorar plano','trocar plano'],
ARRAY['quero mudar meu plano','posso melhorar meu plano','upgrade']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Avaliação Funcional'),
'O que é a avaliação funcional da FORTEM?',
'A avaliação funcional FORTEM analisa sua mobilidade articular, flexibilidade, força e simetria corporal. O resultado é um diagnóstico detalhado com score geral e identificação de pontos de atenção — base para um treino personalizado e eficiente.',
ARRAY['avaliação funcional','o que é','avaliação','diagnóstico','mobilidade'],
ARRAY['o que é avaliação funcional','para que serve a avaliação']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Avaliação Funcional'),
'Com que frequência devo fazer a avaliação funcional?',
'Recomendamos realizar a avaliação a cada 4 a 6 meses. Esse intervalo é ideal para acompanhar sua evolução e ajustar o programa de treino. O app te avisa automaticamente quando estiver na hora de reavaliar.',
ARRAY['frequência','quando','periodicidade','reavaliar','intervalo'],
ARRAY['de quanto em quanto tempo','quando refazer','prazo avaliação']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Avaliação Funcional'),
'Como agendar minha avaliação funcional?',
'Você pode agendar pelo app na aba Agenda → Serviços → Avaliação Funcional. Se tiver crédito de avaliação incluído no seu plano, ele será utilizado automaticamente. Caso não tenha, entre em contato com a equipe pelo WhatsApp.',
ARRAY['agendar avaliação','marcar avaliação','avaliação funcional agendamento'],
ARRAY['como agendar avaliação','quero fazer avaliação']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Serviços'),
'Meu plano inclui nutrição?',
'Os serviços incluídos variam por plano. Planos Power, Pro e Max incluem sessões de nutrição. Consulte a seção Serviços do Plano na tela inicial do app para ver o que está disponível para você.',
ARRAY['nutrição','nutricionista','consulta nutrição','incluído','serviços'],
ARRAY['tenho nutrição no plano','meu plano tem nutrição']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Serviços'),
'Como funciona a reabilitação?',
'A FORTEM oferece sessões de reabilitação com fisioterapeutas. Dependendo do seu plano, você pode ter sessões inclusas. Agende pela aba Agenda → Serviços → Reabilitação.',
ARRAY['reabilitação','fisioterapia','fisioterapeuta','lesão','recuperação'],
ARRAY['como funciona reabilitação','quero fazer fisioterapia']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Pagamento'),
'Meu plano renova automaticamente?',
'Planos em recorrência renovam automaticamente no cartão cadastrado. Você recebe uma notificação 30 dias antes do vencimento. Para planos anuais parcelados, as parcelas são cobradas mensalmente de forma automática.',
ARRAY['renovação automática','cobrança','automático','cartão','renovar'],
ARRAY['meu plano renova sozinho','cobrança automática','quando cobram']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Pagamento'),
'Como atualizar ou trocar o cartão de crédito?',
'Acesse Perfil → Carteira no app. Lá você pode ver os cartões salvos, definir um cartão padrão ou remover cartões antigos. Novos cartões são adicionados automaticamente ao realizar um pagamento.',
ARRAY['cartão','trocar cartão','atualizar cartão','carteira','pagamento'],
ARRAY['como troco meu cartão','trocar cartão de crédito']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Acesso e Estrutura'),
'Qual o horário de funcionamento da FORTEM?',
'A FORTEM funciona de segunda a sexta das 06h às 20h, e aos sábados das 08h às 13h. Os horários disponíveis para agendamento refletem a grade atual de turmas.',
ARRAY['horário','funcionamento','abre','fecha','quando'],
ARRAY['que horas abre','horário de funcionamento','até que horas funciona']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Treinos'),
'Como ver minha ficha de treino?',
'Sua ficha de treino está disponível na aba Treinos do app. Lá você encontra todos os exercícios com séries, repetições, descanso e vídeo de execução. Você também pode anotar as cargas utilizadas em cada sessão.',
ARRAY['ficha de treino','exercícios','treino','ver treino','ficha'],
ARRAY['onde está minha ficha','como vejo meu treino']),
((SELECT id FROM public.knowledge_categories WHERE nome = 'Treinos'),
'Posso anotar as cargas que uso nos exercícios?',
'Sim! Na aba Treinos, cada exercício tem um campo para anotar a carga utilizada. O histórico fica salvo e você consegue ver a evolução comparando com sessões anteriores.',
ARRAY['cargas','anotar','peso','registro','histórico cargas'],
ARRAY['como anoto as cargas','posso registrar peso']);
