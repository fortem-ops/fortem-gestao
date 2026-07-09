
CREATE TABLE public.whatsapp_disparos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL CHECK (categoria IN ('evento', 'agendado')),
  gatilho text NOT NULL,
  destinatario text NOT NULL CHECK (destinatario IN ('aluno', 'profissional')),
  atividades text[] DEFAULT NULL,
  ativo boolean NOT NULL DEFAULT false,
  modo_teste boolean NOT NULL DEFAULT true,
  template_texto text NOT NULL,
  variaveis_disponiveis text[] NOT NULL DEFAULT '{}',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_disparos_config TO authenticated;
GRANT ALL ON public.whatsapp_disparos_config TO service_role;

ALTER TABLE public.whatsapp_disparos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e coord gerenciam disparos config"
  ON public.whatsapp_disparos_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE TRIGGER update_whatsapp_disparos_config_updated_at
  BEFORE UPDATE ON public.whatsapp_disparos_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_disparos_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid REFERENCES public.whatsapp_disparos_config(id) ON DELETE SET NULL,
  agenda_id uuid REFERENCES public.agenda_servicos(id) ON DELETE SET NULL,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  destinatario_telefone text,
  destinatario_nome text,
  mensagem_enviada text,
  status text NOT NULL DEFAULT 'enviado',
  erro_detalhe text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_disparos_log_agenda_config
  ON public.whatsapp_disparos_log(agenda_id, config_id);
CREATE INDEX idx_whatsapp_disparos_log_created
  ON public.whatsapp_disparos_log(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_disparos_log TO authenticated;
GRANT ALL ON public.whatsapp_disparos_log TO service_role;

ALTER TABLE public.whatsapp_disparos_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e coord veem disparos log"
  ON public.whatsapp_disparos_log FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

INSERT INTO public.whatsapp_disparos_config (nome, descricao, categoria, gatilho, destinatario, atividades, ativo, modo_teste, template_texto, variaveis_disponiveis, ordem) VALUES
('Treino Experimental → Profissional', 'Notifica o profissional ao agendar um Treino Experimental com anamnese do aluno', 'evento', 'agendamento_criado', 'profissional', ARRAY['Treino Experimental'], true, false,
E'*%TIPO_SERVICO% de %DIA_SEMANA%, %DATA%, às %HORA_INICIO%:*\n_Treinador(a): %NOME_PROFISSIONAL%_\n\n✅Nome Completo: %NOME_ALUNO%\n✅Data de nascimento: %DATA_NASCIMENTO%\n✅Como conheceu a FORTEM? %COMO_CONHECEU%\n✅Limitações / patologias / dores / lesões: %LIMITACOES%\n✅Atividade física atual: %ATIVIDADE_FISICA%\n✅Objetivo: %OBJETIVO%',
ARRAY['%TIPO_SERVICO%', '%DIA_SEMANA%', '%DATA%', '%HORA_INICIO%', '%NOME_PROFISSIONAL%', '%NOME_ALUNO%', '%DATA_NASCIMENTO%', '%COMO_CONHECEU%', '%LIMITACOES%', '%ATIVIDADE_FISICA%', '%OBJETIVO%'], 1),

('Avaliação Funcional → Profissional', 'Notifica o profissional ao agendar uma Avaliação Funcional', 'evento', 'agendamento_criado', 'profissional', ARRAY['Avaliação Funcional'], true, false,
E'*%TIPO_SERVICO% de %DIA_SEMANA%, %DATA%, às %HORA_INICIO%:*\n_Avaliador(a): %NOME_PROFISSIONAL%_\n\n✅Nome Completo: %NOME_ALUNO%\n✅Data de nascimento: %DATA_NASCIMENTO%\n✅Data da última avaliação: %ULTIMA_AVALIACAO%\n✅Objetivo: %OBJETIVO%',
ARRAY['%TIPO_SERVICO%', '%DIA_SEMANA%', '%DATA%', '%HORA_INICIO%', '%NOME_PROFISSIONAL%', '%NOME_ALUNO%', '%DATA_NASCIMENTO%', '%ULTIMA_AVALIACAO%', '%OBJETIVO%'], 2),

('Reabilitação/Nutrição → Profissional', 'Notifica o profissional ao agendar Reabilitação, Nutrição ou Avaliação Física', 'evento', 'agendamento_criado', 'profissional', ARRAY['Reabilitação', 'Nutrição', 'Avaliação Física'], true, false,
E'*Paciente de %DIA_SEMANA%, %DATA%, às %HORA_INICIO%:*\n_%CARGO_PROFISSIONAL%: %NOME_PROFISSIONAL%_\n\n✅Nome Completo: %NOME_ALUNO%\n✅Data de nascimento: %DATA_NASCIMENTO%',
ARRAY['%TIPO_SERVICO%', '%DIA_SEMANA%', '%DATA%', '%HORA_INICIO%', '%NOME_PROFISSIONAL%', '%CARGO_PROFISSIONAL%', '%NOME_ALUNO%', '%DATA_NASCIMENTO%'], 3),

('Cancelamento → Profissional', 'Notifica o profissional quando um agendamento é cancelado', 'evento', 'agendamento_cancelado', 'profissional', NULL, true, false,
E'⚠️ *Agendamento cancelado*\n\n%TIPO_SERVICO% de %DATA% às %HORA_INICIO% com %NOME_ALUNO% foi cancelado.',
ARRAY['%TIPO_SERVICO%', '%DATA%', '%HORA_INICIO%', '%NOME_ALUNO%'], 4),

('Confirmação de Agendamento → Aluno', 'Envia confirmação ao aluno quando um serviço é agendado', 'evento', 'agendamento_criado', 'aluno', NULL, false, true,
E'Olá, %NOME_ALUNO%! 👋🏽\n\nSeu *%TIPO_SERVICO%* está confirmado para *%DATA%* às *%HORA_INICIO%*.\n\nQualquer dúvida, só nos avisar. Até lá! 💪',
ARRAY['%NOME_ALUNO%', '%TIPO_SERVICO%', '%DATA%', '%HORA_INICIO%'], 5),

('Lembrete Dia Anterior → Aluno', 'Lembrete enviado no dia anterior ao agendamento pedindo confirmação', 'agendado', 'lembrete_dia_anterior', 'aluno', NULL, false, true,
E'Oi, %NOME_ALUNO%! Tudo bom? 👋🏽\n\nQueremos lembrar que você tem um(a) *%TIPO_SERVICO%* agendado(a) com a gente amanhã, *%DATA%*, às *%HORA_INICIO%*.\n\nPodemos confirmar? Se precisar alterar o horário ou tiver alguma dúvida, só nos avisar. Até lá! 👋🏽',
ARRAY['%NOME_ALUNO%', '%TIPO_SERVICO%', '%DATA%', '%HORA_INICIO%'], 6),

('Cobrança Recusada → Aluno', 'Avisa o aluno quando uma cobrança é recusada', 'evento', 'cobranca_recusada', 'aluno', NULL, false, true,
E'Oi, %NOME_ALUNO%! Tudo bem?\n\nInfelizmente, tivemos uma cobrança recusada do teu plano. Entra em contato com a nossa equipe para resolvermos ou verifica o teu saldo devedor no Menu > Contratos.\n\nEsperamos o seu contato! Até logo!\n_Equipe FORTEM_',
ARRAY['%NOME_ALUNO%'], 7),

('Renovação de Plano → Aluno', 'Lembrete de renovação quando o plano está próximo do vencimento', 'agendado', 'lembrete_renovacao', 'aluno', NULL, false, true,
E'Oi, %NOME_ALUNO%! \n\nSeu plano *%NOME_PLANO%* vence em *%DIAS_VENCIMENTO% dias*. Entre em contato para renovar e continuar sua evolução! 💪\n\n_Equipe FORTEM_',
ARRAY['%NOME_ALUNO%', '%NOME_PLANO%', '%DIAS_VENCIMENTO%'], 8);
