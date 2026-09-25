CREATE OR REPLACE FUNCTION public.fn_converter_em_avulso(_aluno_id uuid, _observacao text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a record; _funnel text;
BEGIN
  IF NOT (public.is_coordinator_or_admin(auth.uid())
          OR public.has_role(auth.uid(), 'nutricionista')
          OR public.has_role(auth.uid(), 'fisioterapeuta')) THEN
    RAISE EXCEPTION 'Sem permissão para converter em cliente avulso';
  END IF;
  SELECT id, status, current_pipeline_stage_id INTO _a FROM public.alunos WHERE id = _aluno_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro não encontrado'; END IF;
  SELECT f.slug::text INTO _funnel FROM public.pipeline_stages s
    JOIN public.pipeline_funnels f ON f.id = s.funnel_id WHERE s.id = _a.current_pipeline_stage_id;
  IF NOT (_a.status IN ('lead','prospect') OR _funnel = 'prospects') THEN
    RAISE EXCEPTION 'Somente leads ou prospects podem virar cliente avulso';
  END IF;
  UPDATE public.alunos SET status = 'avulso', current_pipeline_stage_id = NULL WHERE id = _aluno_id;
  IF coalesce(trim(_observacao), '') <> '' THEN
    INSERT INTO public.pipeline_metadata (aluno_id, notas) VALUES (_aluno_id, 'Cliente avulso: ' || trim(_observacao))
    ON CONFLICT (aluno_id) DO UPDATE SET notas = concat_ws(E'\n', pipeline_metadata.notas, EXCLUDED.notas), updated_at = now();
  END IF;
  INSERT INTO public.audit_log (tabela, registro_id, operacao, user_id, dados_antes, dados_depois)
  VALUES ('alunos', _aluno_id, 'update', auth.uid(),
    jsonb_build_object('status', _a.status, 'stage_id', _a.current_pipeline_stage_id),
    jsonb_build_object('status', 'avulso', 'acao', 'converter_em_avulso', 'observacao', _observacao));
END $$;
REVOKE ALL ON FUNCTION public.fn_converter_em_avulso(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_converter_em_avulso(uuid, text) TO authenticated;