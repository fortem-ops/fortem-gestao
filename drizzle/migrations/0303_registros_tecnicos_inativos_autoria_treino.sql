ALTER TABLE public.tarefas ADD COLUMN treino_id uuid REFERENCES public.treinos(id) ON DELETE CASCADE;
ALTER TABLE public.avaliacoes ADD COLUMN treino_id uuid REFERENCES public.treinos(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.fn_aluno_inativo(_aluno_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.alunos a LEFT JOIN public.pipeline_stages s ON s.id=a.current_pipeline_stage_id LEFT JOIN public.pipeline_funnels f ON f.id=s.funnel_id WHERE a.id=_aluno_id AND (lower(a.status)='inativo' OR f.slug='inativo'));
$$;
CREATE OR REPLACE FUNCTION public.fn_tarefa_tecnica(_tipo text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT COALESCE(_tipo IN ('relatorio_tecnico_forca','relatorio_tecnico_corrida','relatorio_reabilitacao','relatorio_experimental','reavaliacao_funcional','avaliacao_funcional_agendada','atualizar_treino'),false);
$$;
CREATE OR REPLACE FUNCTION public.fn_tarefa_tecnica_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.aluno_id IS NOT NULL AND public.fn_tarefa_tecnica(NEW.tipo_auto) THEN
  PERFORM 1 FROM public.alunos WHERE id=NEW.aluno_id FOR UPDATE;
  IF NEW.status <> 'concluida' AND public.fn_aluno_inativo(NEW.aluno_id) THEN RETURN NULL; END IF;
 END IF;
 IF NEW.tipo_auto='atualizar_treino' THEN NEW.titulo := 'Atualizar treino + Relatório Técnico'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_00_tarefa_tecnica_guard BEFORE INSERT OR UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.fn_tarefa_tecnica_guard();
CREATE OR REPLACE FUNCTION public.fn_aluno_inativo_limpar_tarefas() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.fn_aluno_inativo(NEW.id) THEN
  DELETE FROM public.tarefas WHERE aluno_id=NEW.id AND status <> 'concluida' AND public.fn_tarefa_tecnica(tipo_auto);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_aluno_inativo_limpar_tarefas AFTER UPDATE OF status,current_pipeline_stage_id ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.fn_aluno_inativo_limpar_tarefas();
CREATE OR REPLACE FUNCTION public.fn_gerar_tarefas_relatorio_tecnico(_data date DEFAULT CURRENT_DATE) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT 0; $$;
COMMENT ON FUNCTION public.fn_gerar_tarefas_relatorio_tecnico(date) IS 'Relatórios de força/corrida acompanham a troca de treino, não o calendário mensal.';
CREATE OR REPLACE FUNCTION public.fn_treino_exigir_relatorio() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_resp uuid;
BEGIN
 IF NEW.status NOT IN ('atual','aguardando') OR public.fn_aluno_inativo(NEW.aluno_id) THEN RETURN NEW; END IF;
 SELECT COALESCE(NEW.autor_id,responsavel_id) INTO v_resp FROM public.alunos WHERE id=NEW.aluno_id;
 IF v_resp IS NULL THEN RETURN NEW; END IF;
 -- Reaproveita a tarefa de troca de treino; autosaves não geram novos lembretes.
 UPDATE public.tarefas SET treino_id=NEW.id,titulo='Atualizar treino + Relatório Técnico',descricao='Treino salvo. Finalize o Relatório Técnico deste treino.',responsavel_id=v_resp
 WHERE aluno_id=NEW.aluno_id AND tipo_auto='atualizar_treino' AND status <> 'concluida' AND treino_id IS NULL;
 IF NOT FOUND THEN
 INSERT INTO public.tarefas(titulo,descricao,aluno_id,responsavel_id,criado_por_id,prioridade,status,data_limite,automatica,tipo_auto,tipo_atividade,origem,treino_id)
 VALUES ('Atualizar treino + Relatório Técnico','Treino salvo. Finalize o Relatório Técnico deste treino.',NEW.aluno_id,v_resp,v_resp,'media','pendente',CURRENT_DATE,true,'atualizar_treino','tarefa','tecnico',NEW.id);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_treino_exigir_relatorio AFTER INSERT ON public.treinos FOR EACH ROW EXECUTE FUNCTION public.fn_treino_exigir_relatorio();
CREATE OR REPLACE FUNCTION public.fn_registro_autoria() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NOT NULL THEN NEW.avaliador_id:=auth.uid(); END IF;
  IF NEW.avaliador_id IS NULL THEN RAISE EXCEPTION 'Profissional responsável pelo registro é obrigatório'; END IF;
 ELSE
  IF NEW.avaliador_id IS DISTINCT FROM OLD.avaliador_id THEN RAISE EXCEPTION 'O autor original do registro não pode ser alterado'; END IF;
 END IF;
 IF NEW.treino_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.treinos WHERE id=NEW.treino_id AND aluno_id=NEW.aluno_id) THEN RAISE EXCEPTION 'Treino não pertence ao aluno do relatório'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_00_registro_autoria BEFORE INSERT OR UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.fn_registro_autoria();
CREATE OR REPLACE FUNCTION public.fn_registro_tecnico_concluir_e_avisar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_notif uuid; v_nome text; v_aluno text; v_tipo text;
BEGIN
 IF NEW.treino_id IS NOT NULL AND NEW.tipo='relatorioforca' AND NEW.dados->>'status'='finalizado' THEN
  UPDATE public.tarefas SET status='concluida' WHERE treino_id=NEW.treino_id AND tipo_auto='atualizar_treino' AND status <> 'concluida';
 END IF;
 -- Rascunhos avisam apenas ao finalizar, nunca a cada salvamento.
 IF NEW.dados->>'status'='rascunho' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF COALESCE(OLD.dados->>'status','') <> 'rascunho' OR NEW.dados->>'status' IS DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=NEW.avaliador_id AND role IN ('professor','nutricionista','fisioterapeuta')) THEN RETURN NEW; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role IN ('admin','coordenador') AND user_id<>NEW.avaliador_id) THEN RETURN NEW; END IF;
 SELECT full_name INTO v_nome FROM public.profiles WHERE user_id=NEW.avaliador_id;
 SELECT nome INTO v_aluno FROM public.alunos WHERE id=NEW.aluno_id;
 SELECT nome INTO v_tipo FROM public.avaliacao_tipos WHERE slug=NEW.tipo;
 INSERT INTO public.notificacoes(titulo,descricao,categoria,criado_por,aluno_id)
 VALUES (COALESCE(v_nome,'Profissional') || ' registrou ' || COALESCE(v_tipo,NEW.tipo) || ' de ' || COALESCE(v_aluno,'aluno'),
 'Registro disponível na ficha: /alunos/' || NEW.aluno_id || '?tab=registros&sub=' || CASE WHEN NEW.tipo IN ('funcional','funcional_v2','composicao_corporal') THEN 'avaliacoes' ELSE 'relatorios' END,'pauta_tecnica',NEW.avaliador_id,NEW.aluno_id) RETURNING id INTO v_notif;
 INSERT INTO public.notificacao_destinatarios(notificacao_id,usuario_id)
 SELECT DISTINCT v_notif,r.user_id FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id AND p.ativo WHERE r.role IN ('admin','coordenador') AND r.user_id<>NEW.avaliador_id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER trg_registro_tecnico_concluir_e_avisar AFTER INSERT OR UPDATE OF dados ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION public.fn_registro_tecnico_concluir_e_avisar();
REVOKE ALL ON FUNCTION public.fn_aluno_inativo(uuid),public.fn_tarefa_tecnica(text),public.fn_tarefa_tecnica_guard(),public.fn_aluno_inativo_limpar_tarefas(),public.fn_treino_exigir_relatorio(),public.fn_registro_autoria(),public.fn_registro_tecnico_concluir_e_avisar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_aluno_inativo(uuid),public.fn_tarefa_tecnica(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fn_tarefa_tecnica_guard(),public.fn_aluno_inativo_limpar_tarefas(),public.fn_treino_exigir_relatorio(),public.fn_registro_autoria(),public.fn_registro_tecnico_concluir_e_avisar() TO service_role;