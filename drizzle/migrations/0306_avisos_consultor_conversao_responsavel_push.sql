-- Controle de deduplicação para aviso único de conversão de prospect para aluno ativo
CREATE TABLE IF NOT EXISTS public.notificacao_conversao_log (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  plano_id uuid REFERENCES public.planos(id) ON DELETE SET NULL,
  notificacao_id uuid REFERENCES public.notificacoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notificacao_conversao_log TO authenticated;
GRANT ALL ON public.notificacao_conversao_log TO service_role;

ALTER TABLE public.notificacao_conversao_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin e coordenador leem log de conversao" ON public.notificacao_conversao_log;
CREATE POLICY "Admin e coordenador leem log de conversao"
  ON public.notificacao_conversao_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'coordenador'::public.app_role)
  );

-- 1) Avaliação experimental, funcional ou de força finalizada -> avisa o consultor do aluno
CREATE OR REPLACE FUNCTION public.fn_avaliacao_avisar_consultor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultor_id uuid;
  v_aluno_nome text;
  v_avaliador_nome text;
  v_tipo_label text;
  v_notif_id uuid;
  v_sub text;
BEGIN
  IF NEW.tipo NOT IN ('experimental', 'funcional', 'funcional_v2', 'forca') THEN
    RETURN NEW;
  END IF;

  IF NEW.dados->>'status' = 'rascunho' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.dados->>'status', '') <> 'rascunho'
       OR NEW.dados->>'status' IS DISTINCT FROM 'finalizado' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT a.consultor_id, a.nome
    INTO v_consultor_id, v_aluno_nome
    FROM public.alunos a
   WHERE a.id = NEW.aluno_id;

  IF v_consultor_id IS NULL OR v_consultor_id = NEW.avaliador_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = v_consultor_id AND p.ativo = true
  ) THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name INTO v_avaliador_nome
    FROM public.profiles p
   WHERE p.user_id = NEW.avaliador_id;

  v_tipo_label := CASE NEW.tipo
    WHEN 'experimental' THEN 'Avaliação experimental'
    WHEN 'forca' THEN 'Avaliação de força'
    ELSE 'Avaliação funcional'
  END;

  v_sub := CASE WHEN NEW.tipo IN ('funcional', 'funcional_v2') THEN 'avaliacoes' ELSE 'relatorios' END;

  INSERT INTO public.notificacoes (titulo, descricao, categoria, criado_por, aluno_id)
  VALUES (
    v_tipo_label || ' de ' || COALESCE(v_aluno_nome, 'aluno') || ' realizada por ' || COALESCE(v_avaliador_nome, 'profissional'),
    'Registro disponível na ficha: /alunos/' || NEW.aluno_id || '?tab=registros&sub=' || v_sub,
    'comercial',
    NEW.avaliador_id,
    NEW.aluno_id
  )
  RETURNING id INTO v_notif_id;

  INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
  VALUES (v_notif_id, v_consultor_id)
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_avaliacao_avisar_consultor ON public.avaliacoes;
CREATE TRIGGER trg_avaliacao_avisar_consultor
  AFTER INSERT OR UPDATE OF dados ON public.avaliacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_avaliacao_avisar_consultor();

-- 2) Conversão de prospect para aluno ativo -> avisa professor do experimental, coordenadores e admins
CREATE OR REPLACE FUNCTION public.fn_plano_conversao_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eh_prospect boolean := false;
  v_aluno_nome text;
  v_plano_nome text;
  v_agregador text;
  v_freq text;
  v_prof_exp uuid;
  v_criado_por uuid;
  v_notif_id uuid;
  v_inserido boolean := false;
BEGIN
  IF COALESCE(NEW.ativo, false) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.ativo, false) = true THEN
    RETURN NEW;
  END IF;

  -- Verifica se o aluno está em prospect (status ou funil prospects)
  SELECT
    a.nome,
    (
      lower(COALESCE(a.status, '')) = 'prospect'
      OR f.slug = 'prospects'
    )
    INTO v_aluno_nome, v_eh_prospect
    FROM public.alunos a
    LEFT JOIN public.pipeline_stages s ON s.id = a.current_pipeline_stage_id
    LEFT JOIN public.pipeline_funnels f ON f.id = s.funnel_id
   WHERE a.id = NEW.aluno_id;

  IF NOT COALESCE(v_eh_prospect, false) THEN
    RETURN NEW;
  END IF;

  -- Trava de deduplicação: apenas um aviso de conversão por aluno
  INSERT INTO public.notificacao_conversao_log (aluno_id, plano_id)
  VALUES (NEW.aluno_id, NEW.id)
  ON CONFLICT (aluno_id) DO NOTHING
  RETURNING true INTO v_inserido;

  IF NOT COALESCE(v_inserido, false) THEN
    RETURN NEW;
  END IF;

  -- Informações do plano contratado (incluindo agregadores)
  SELECT COALESCE(pc.nome, NEW.nome, NEW.tipo)
    INTO v_plano_nome
    FROM (SELECT 1) _
    LEFT JOIN public.planos_catalogo pc ON pc.id = NEW.catalogo_id;

  v_freq := CASE
    WHEN NEW.frequencia IS NOT NULL THEN ' (' || NEW.frequencia::text || ')'
    ELSE ''
  END;

  v_agregador := CASE
    WHEN lower(COALESCE(NEW.tipo, '') || ' ' || COALESCE(v_plano_nome, '')) ~ '(wellhub|gympass)' THEN ' - Agregador: Wellhub'
    WHEN lower(COALESCE(NEW.tipo, '') || ' ' || COALESCE(v_plano_nome, '')) ~ 'total\s*pass' THEN ' - Agregador: TotalPass'
    ELSE ''
  END;

  -- Professor que realizou a avaliação experimental mais recente
  SELECT av.avaliador_id
    INTO v_prof_exp
    FROM public.avaliacoes av
    JOIN public.profiles p ON p.user_id = av.avaliador_id AND p.ativo = true
   WHERE av.aluno_id = NEW.aluno_id
     AND av.tipo = 'experimental'
   ORDER BY av.created_at DESC
   LIMIT 1;

  -- Autor da notificação (obrigatório em notificacoes.criado_por)
  v_criado_por := COALESCE(
    auth.uid(),
    v_prof_exp,
    (
      SELECT r.user_id
        FROM public.user_roles r
        JOIN public.profiles p ON p.user_id = r.user_id AND p.ativo = true
       WHERE r.role IN ('admin', 'coordenador')
       ORDER BY CASE WHEN r.role = 'admin' THEN 0 ELSE 1 END, r.user_id
       LIMIT 1
    )
  );

  IF v_criado_por IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notificacoes (titulo, descricao, categoria, criado_por, aluno_id)
  VALUES (
    'Novo aluno ativo: ' || COALESCE(v_aluno_nome, 'aluno'),
    COALESCE(v_aluno_nome, 'Aluno') || ' converteu para aluno ativo. Plano: '
      || COALESCE(v_plano_nome, 'Plano') || v_freq || v_agregador
      || '. Ficha: /alunos/' || NEW.aluno_id,
    'comercial',
    v_criado_por,
    NEW.aluno_id
  )
  RETURNING id INTO v_notif_id;

  UPDATE public.notificacao_conversao_log
     SET notificacao_id = v_notif_id
   WHERE aluno_id = NEW.aluno_id;

  -- Destinatários: professor do experimental + coordenadores + admins ativos
  IF v_prof_exp IS NOT NULL THEN
    INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
    VALUES (v_notif_id, v_prof_exp)
    ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;
  END IF;

  INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT DISTINCT v_notif_id, r.user_id
    FROM public.user_roles r
    JOIN public.profiles p ON p.user_id = r.user_id AND p.ativo = true
   WHERE r.role IN ('admin', 'coordenador')
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Prefixo trg_00_ para rodar antes de trg_planos_pipeline_after_insert (que move o estágio para Aluno ativo)
DROP TRIGGER IF EXISTS trg_00_plano_conversao_avisar ON public.planos;
CREATE TRIGGER trg_00_plano_conversao_avisar
  AFTER INSERT OR UPDATE OF ativo ON public.planos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_plano_conversao_avisar();

-- 3) Toda notificação ligada a um aluno inclui professor responsável e coordenadores ativos
CREATE OR REPLACE FUNCTION public.fn_notificacao_aluno_incluir_equipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp_id uuid;
BEGIN
  IF NEW.aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT a.responsavel_id INTO v_resp_id
    FROM public.alunos a
   WHERE a.id = NEW.aluno_id;

  IF v_resp_id IS NOT NULL
     AND v_resp_id IS DISTINCT FROM NEW.criado_por
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_resp_id AND p.ativo = true) THEN
    INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
    VALUES (NEW.id, v_resp_id)
    ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;
  END IF;

  INSERT INTO public.notificacao_destinatarios (notificacao_id, usuario_id)
  SELECT DISTINCT NEW.id, r.user_id
    FROM public.user_roles r
    JOIN public.profiles p ON p.user_id = r.user_id AND p.ativo = true
   WHERE r.role = 'coordenador'
     AND r.user_id IS DISTINCT FROM NEW.criado_por
  ON CONFLICT (notificacao_id, usuario_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificacao_aluno_incluir_equipe ON public.notificacoes;
CREATE TRIGGER trg_notificacao_aluno_incluir_equipe
  AFTER INSERT ON public.notificacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificacao_aluno_incluir_equipe();

-- 4) Push automático para destinatários de notificações ligadas a alunos
CREATE OR REPLACE FUNCTION public.fn_notificacao_destinatario_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_titulo text;
  v_descricao text;
  v_prioridade public.notif_prioridade;
  v_aluno_id uuid;
  v_gatilho text;
BEGIN
  SELECT n.titulo, n.descricao, n.prioridade, n.aluno_id
    INTO v_titulo, v_descricao, v_prioridade, v_aluno_id
    FROM public.notificacoes n
   WHERE n.id = NEW.notificacao_id;

  IF v_aluno_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_gatilho := CASE
    WHEN v_prioridade = 'urgente' THEN 'notificacao_aluno_urgente'
    ELSE 'notificacao_aluno'
  END;

  PERFORM public.fn_call_edge_function(
    'send-push-equipe',
    jsonb_build_object(
      'acao', 'enviar',
      'gatilho', v_gatilho,
      'referencia', 'notif:' || NEW.notificacao_id::text,
      'titulo', left(replace(COALESCE(v_titulo, 'Notificação de aluno'), '!', '.'), 120),
      'corpo', left(replace(COALESCE(v_descricao, ''), '!', '.'), 400),
      'url', '/alunos/' || v_aluno_id::text,
      'user_ids', jsonb_build_array(NEW.usuario_id)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificacao_destinatario_push ON public.notificacao_destinatarios;
CREATE TRIGGER trg_notificacao_destinatario_push
  AFTER INSERT ON public.notificacao_destinatarios
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notificacao_destinatario_push();

-- Permissões restritas (nunca expor SECURITY DEFINER para anon)
REVOKE ALL ON FUNCTION
  public.fn_avaliacao_avisar_consultor(),
  public.fn_plano_conversao_avisar(),
  public.fn_notificacao_aluno_incluir_equipe(),
  public.fn_notificacao_destinatario_push()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.fn_avaliacao_avisar_consultor(),
  public.fn_plano_conversao_avisar(),
  public.fn_notificacao_aluno_incluir_equipe(),
  public.fn_notificacao_destinatario_push()
TO service_role;