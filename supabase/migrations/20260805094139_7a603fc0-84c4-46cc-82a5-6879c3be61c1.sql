ALTER TABLE public.whatsapp_disparos_config
  ADD COLUMN IF NOT EXISTS offset_min integer,
  ADD COLUMN IF NOT EXISTS horario_fixo time;

ALTER TABLE public.whatsapp_disparos_log
  ADD COLUMN IF NOT EXISTS usuario_id uuid,
  ADD COLUMN IF NOT EXISTS referencia_data date;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_disparos_log_ponto_dedup
  ON public.whatsapp_disparos_log (config_id, usuario_id, referencia_data)
  WHERE usuario_id IS NOT NULL AND status = 'enviado';

INSERT INTO public.whatsapp_disparos_config
  (nome, descricao, categoria, gatilho, destinatario, atividades, ativo, modo_teste, offset_min, horario_fixo, template_texto, variaveis_disponiveis, ordem)
VALUES
('Lembrete de Entrada → Profissional',
 'Lembra o profissional de registrar a entrada, 10 minutos antes do horário previsto.',
 'agendado', 'lembrete_entrada', 'profissional', NULL, false, true, -10, NULL,
 E'Oi, %NOME_PROFISSIONAL%! 👋🏽\n\nSua jornada de %DIA_SEMANA% começa às *%HORA_PREVISTA%*. Não esqueça de registrar a *entrada* no app.\n\n_Equipe FORTEM_',
 ARRAY['%NOME_PROFISSIONAL%','%DATA%','%DIA_SEMANA%','%HORA_PREVISTA%'], 10),

('Lembrete de Intervalo → Profissional',
 'Lembra o profissional de registrar o início do intervalo, no meio da jornada prevista.',
 'agendado', 'lembrete_intervalo', 'profissional', NULL, false, true, NULL, NULL,
 E'Oi, %NOME_PROFISSIONAL%! ⏸️\n\nHora do seu intervalo (%INTERVALO_MIN% min). Lembre de registrar o *início do intervalo* no app.\n\n_Equipe FORTEM_',
 ARRAY['%NOME_PROFISSIONAL%','%DATA%','%DIA_SEMANA%','%HORA_PREVISTA%','%INTERVALO_MIN%'], 11),

('Lembrete de Saída → Profissional',
 'Lembra o profissional de registrar a saída, 10 minutos antes do fim previsto da jornada.',
 'agendado', 'lembrete_saida', 'profissional', NULL, false, true, -10, NULL,
 E'Oi, %NOME_PROFISSIONAL%! 🕒\n\nSua jornada encerra às *%HORA_PREVISTA%*. Não esqueça de registrar a *saída* no app.\n\n_Equipe FORTEM_',
 ARRAY['%NOME_PROFISSIONAL%','%DATA%','%DIA_SEMANA%','%HORA_PREVISTA%'], 12),

('Resumo Diário de Ponto → Profissional',
 'Envia o resumo do ponto do dia após a saída registrada (ou após o fim previsto, quando não houver saída).',
 'agendado', 'resumo_diario_ponto', 'profissional', NULL, false, true, NULL, '22:00',
 E'%NOME_PROFISSIONAL%, resumo do seu ponto de %DATA%:\n\n• Entrada: %HORA_ENTRADA%\n• Intervalo: %INTERVALO%\n• Saída: %HORA_SAIDA%\n• Tempo trabalhado: %TEMPO_TRABALHADO%\n\n%AVISO%\n_Equipe FORTEM_',
 ARRAY['%NOME_PROFISSIONAL%','%DATA%','%DIA_SEMANA%','%HORA_ENTRADA%','%HORA_SAIDA%','%INTERVALO%','%TEMPO_TRABALHADO%','%AVISO%'], 13);