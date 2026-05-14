
-- Performance indexes (Phase 2)
CREATE INDEX IF NOT EXISTS idx_alunos_responsavel ON public.alunos(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_alunos_status ON public.alunos(status);
CREATE INDEX IF NOT EXISTS idx_alunos_pipeline_stage ON public.alunos(current_pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_alunos_user_id ON public.alunos(user_id);

CREATE INDEX IF NOT EXISTS idx_agenda_prof_dia ON public.agenda_servicos(profissional_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_agenda_aluno ON public.agenda_servicos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_agenda_data ON public.agenda_servicos(data_especifica);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_aluno_data ON public.avaliacoes(aluno_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_avaliador ON public.avaliacoes(avaliador_id);

CREATE INDEX IF NOT EXISTS idx_pipeline_movements_aluno ON public.pipeline_movements(aluno_id, moved_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_movements_to_stage ON public.pipeline_movements(to_stage_id);

CREATE INDEX IF NOT EXISTS idx_notificacoes_criador ON public.notificacoes(criado_por, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_aluno ON public.notificacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_notif_dest_user_status ON public.notificacao_destinatarios(usuario_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_dest_notif ON public.notificacao_destinatarios(notificacao_id);
CREATE INDEX IF NOT EXISTS idx_notif_coment_notif ON public.notificacao_comentarios(notificacao_id);

CREATE INDEX IF NOT EXISTS idx_creditos_aluno_ativo ON public.creditos_aluno(aluno_id, ativo);
CREATE INDEX IF NOT EXISTS idx_creditos_mov_credito_data ON public.creditos_movimentos(credito_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_consumo_aluno_data ON public.consumo_servicos(aluno_id, data_consumo DESC);
CREATE INDEX IF NOT EXISTS idx_consumo_plano ON public.consumo_servicos(plano_id);

CREATE INDEX IF NOT EXISTS idx_planos_aluno_ativo ON public.planos(aluno_id, ativo);

CREATE INDEX IF NOT EXISTS idx_historico_prof_aluno_data ON public.historico_profissional(aluno_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_data ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_log(tabela, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_metadata_aluno ON public.pipeline_metadata(aluno_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_metadata_resp ON public.pipeline_metadata(responsavel_comercial_id);
