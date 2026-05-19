
-- ============= ENUMS =============
CREATE TYPE comissao_tipo AS ENUM ('treino_experimental','avaliacao_funcional','carteira_ativa');
CREATE TYPE comissao_status AS ENUM ('pendente','em_validacao','aprovado','pago','cancelado');
CREATE TYPE comissao_pendencia_tipo AS ENUM ('avaliar_experimental','concluir_avaliacao_funcional','upload_arquivo_forca','aguardando_pagamento_plano');

-- ============= TABLES =============
CREATE TABLE public.comissionamento_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo comissao_tipo NOT NULL UNIQUE,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  meta_minima integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  regras_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comissionamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo comissao_tipo NOT NULL,
  profissional_id uuid NOT NULL,
  aluno_id uuid,
  origem_tabela text,
  origem_id uuid,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  status comissao_status NOT NULL DEFAULT 'pendente',
  descricao text,
  data_referencia date NOT NULL DEFAULT CURRENT_DATE,
  data_pagamento date,
  aprovado_por uuid,
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_comissao_origem_ativa
  ON public.comissionamentos (profissional_id, tipo, COALESCE(aluno_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(origem_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status <> 'cancelado';

CREATE INDEX idx_comissao_prof ON public.comissionamentos(profissional_id);
CREATE INDEX idx_comissao_aluno ON public.comissionamentos(aluno_id);
CREATE INDEX idx_comissao_status ON public.comissionamentos(status);
CREATE INDEX idx_comissao_data_ref ON public.comissionamentos(data_referencia);

CREATE TABLE public.comissionamento_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comissionamento_id uuid REFERENCES public.comissionamentos(id) ON DELETE SET NULL,
  profissional_id uuid NOT NULL,
  aluno_id uuid,
  tipo_pendencia comissao_pendencia_tipo NOT NULL,
  descricao text,
  agenda_id uuid,
  avaliacao_id uuid,
  concluido boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  responsavel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_pendencia_origem
  ON public.comissionamento_pendencias (profissional_id, tipo_pendencia, COALESCE(aluno_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(agenda_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(avaliacao_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX idx_pend_prof ON public.comissionamento_pendencias(profissional_id);
CREATE INDEX idx_pend_concluido ON public.comissionamento_pendencias(concluido);

-- ============= SEED CONFIG =============
INSERT INTO public.comissionamento_config (tipo, valor, meta_minima) VALUES
  ('treino_experimental', 30, 0),
  ('avaliacao_funcional', 35, 0),
  ('carteira_ativa', 5, 150);

-- ============= updated_at triggers =============
CREATE TRIGGER trg_comissao_config_updated BEFORE UPDATE ON public.comissionamento_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comissao_updated BEFORE UPDATE ON public.comissionamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comissao_pend_updated BEFORE UPDATE ON public.comissionamento_pendencias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= RLS =============
ALTER TABLE public.comissionamento_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissionamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissionamento_pendencias ENABLE ROW LEVEL SECURITY;

-- config
CREATE POLICY "Authenticated read comissao_config" ON public.comissionamento_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin manage comissao_config" ON public.comissionamento_config FOR ALL TO authenticated USING (public.is_coordinator_or_admin(auth.uid())) WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

-- comissionamentos
CREATE POLICY "View comissao own or coord/admin" ON public.comissionamentos FOR SELECT TO authenticated
  USING (profissional_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin insert comissao" ON public.comissionamentos FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin update comissao" ON public.comissionamentos FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Admin delete comissao" ON public.comissionamentos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- pendencias
CREATE POLICY "View pendencia own or coord/admin" ON public.comissionamento_pendencias FOR SELECT TO authenticated
  USING (profissional_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin insert pendencia" ON public.comissionamento_pendencias FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Owner or coord/admin update pendencia" ON public.comissionamento_pendencias FOR UPDATE TO authenticated
  USING (profissional_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Admin delete pendencia" ON public.comissionamento_pendencias FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============= HELPER FUNCTIONS =============

CREATE OR REPLACE FUNCTION public.fn_comissao_valor(_tipo comissao_tipo)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valor FROM public.comissionamento_config WHERE tipo = _tipo AND ativo), 0);
$$;

CREATE OR REPLACE FUNCTION public.fn_gerar_comissao(
  _tipo comissao_tipo,
  _profissional uuid,
  _aluno uuid,
  _origem_tabela text,
  _origem_id uuid,
  _descricao text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _valor numeric;
  _id uuid;
BEGIN
  IF _profissional IS NULL THEN RETURN NULL; END IF;
  _valor := public.fn_comissao_valor(_tipo);
  IF _valor IS NULL OR _valor = 0 THEN RETURN NULL; END IF;

  INSERT INTO public.comissionamentos (tipo, profissional_id, aluno_id, origem_tabela, origem_id, valor, status, descricao)
  VALUES (_tipo, _profissional, _aluno, _origem_tabela, _origem_id, _valor, 'pendente', _descricao)
  ON CONFLICT DO NOTHING
  RETURNING id INTO _id;

  RETURN _id;
END $$;

-- ============= TRIGGERS — TREINO EXPERIMENTAL =============

CREATE OR REPLACE FUNCTION public.trg_comissao_agenda_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _aluno_nome text;
BEGIN
  IF NEW.aluno_id IS NULL OR NEW.profissional_id IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  IF NEW.atividade ILIKE 'Treino Experimental' THEN
    INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, agenda_id)
    VALUES (NEW.profissional_id, NEW.aluno_id, 'avaliar_experimental',
      'Concluir avaliação do Treino Experimental de ' || COALESCE(_aluno_nome,''), NEW.id)
    ON CONFLICT DO NOTHING;
  ELSIF NEW.atividade ILIKE 'Avaliação Funcional' THEN
    INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, agenda_id)
    VALUES (NEW.profissional_id, NEW.aluno_id, 'concluir_avaliacao_funcional',
      'Concluir avaliação funcional de ' || COALESCE(_aluno_nome,''), NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_agenda_after_insert
AFTER INSERT ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_agenda_insert();

-- Tentar gerar comissão experimental quando todas condições baterem (pendência concluída + venda paga + plano)
CREATE OR REPLACE FUNCTION public.fn_tentar_comissao_experimental(_aluno uuid, _profissional uuid, _agenda uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tem_venda_paga boolean;
BEGIN
  IF _aluno IS NULL OR _profissional IS NULL THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vendas v
    WHERE v.aluno_id = _aluno
      AND v.status_pagamento = 'pago'
      AND v.plano_id IS NOT NULL
  ) INTO _tem_venda_paga;

  IF NOT _tem_venda_paga THEN RETURN; END IF;

  PERFORM public.fn_gerar_comissao(
    'treino_experimental', _profissional, _aluno, 'agenda_servicos', _agenda,
    'Conversão de Treino Experimental'
  );
END $$;

-- Quando pendência de experimental for concluída → tenta gerar
CREATE OR REPLACE FUNCTION public.trg_comissao_pendencia_concluida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.concluido = true AND (OLD.concluido IS DISTINCT FROM NEW.concluido) THEN
    IF NEW.tipo_pendencia = 'avaliar_experimental' THEN
      PERFORM public.fn_tentar_comissao_experimental(NEW.aluno_id, NEW.profissional_id, NEW.agenda_id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_pendencia_after_update
AFTER UPDATE ON public.comissionamento_pendencias
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_pendencia_concluida();

-- Quando venda pago → para cada pendência experimental concluída sem comissão, gerar
CREATE OR REPLACE FUNCTION public.trg_comissao_venda_paga()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  IF NEW.status_pagamento = 'pago' AND (TG_OP = 'INSERT' OR OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento) THEN
    FOR r IN
      SELECT DISTINCT p.profissional_id, p.agenda_id
      FROM public.comissionamento_pendencias p
      WHERE p.aluno_id = NEW.aluno_id
        AND p.tipo_pendencia = 'avaliar_experimental'
        AND p.concluido = true
    LOOP
      PERFORM public.fn_tentar_comissao_experimental(NEW.aluno_id, r.profissional_id, r.agenda_id);
    END LOOP;
  END IF;

  -- Cancelamento
  IF NEW.status_pagamento = 'cancelado' AND (TG_OP = 'UPDATE' AND OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento) THEN
    UPDATE public.comissionamentos
    SET status = 'cancelado', observacoes = COALESCE(observacoes,'') || ' [venda cancelada]'
    WHERE aluno_id = NEW.aluno_id AND tipo = 'treino_experimental' AND status NOT IN ('pago','cancelado');
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_venda_after
AFTER INSERT OR UPDATE OF status_pagamento ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_venda_paga();

-- ============= TRIGGERS — AVALIAÇÃO FUNCIONAL =============

-- Quando avaliação criada (funcional/forca) → marca pendência "concluir_avaliacao_funcional" como concluída
-- e cria pendência de upload se protocolo permitir upload
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _permite_upload boolean := false;
  _aluno_nome text;
  _agenda_id uuid;
  _profissional uuid;
BEGIN
  IF NEW.tipo NOT IN ('funcional','forca') THEN RETURN NEW; END IF;

  SELECT nome INTO _aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;

  IF NEW.protocolo_id IS NOT NULL THEN
    SELECT permite_upload INTO _permite_upload FROM public.avaliacao_protocolos WHERE id = NEW.protocolo_id;
  END IF;

  -- localiza pendência pendente mais recente do mesmo aluno
  UPDATE public.comissionamento_pendencias
  SET concluido = true, concluido_em = now(), responsavel_id = NEW.avaliador_id, avaliacao_id = NEW.id
  WHERE id = (
    SELECT id FROM public.comissionamento_pendencias
    WHERE aluno_id = NEW.aluno_id AND tipo_pendencia = 'concluir_avaliacao_funcional' AND concluido = false
    ORDER BY created_at DESC LIMIT 1
  )
  RETURNING agenda_id, profissional_id INTO _agenda_id, _profissional;

  IF _profissional IS NULL THEN
    _profissional := NEW.avaliador_id;
  END IF;

  IF COALESCE(_permite_upload, false) THEN
    -- cria pendência de upload
    INSERT INTO public.comissionamento_pendencias (profissional_id, aluno_id, tipo_pendencia, descricao, avaliacao_id, agenda_id)
    VALUES (_profissional, NEW.aluno_id, 'upload_arquivo_forca',
      'Upload de arquivo da avaliação de ' || COALESCE(_aluno_nome,''), NEW.id, _agenda_id)
    ON CONFLICT DO NOTHING;
  ELSE
    -- gera comissão direto
    PERFORM public.fn_gerar_comissao(
      'avaliacao_funcional', _profissional, NEW.aluno_id, 'avaliacoes', NEW.id,
      'Avaliação funcional concluída'
    );
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_avaliacao_after_insert
AFTER INSERT ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_avaliacao_insert();

-- Quando arquivo anexado → conclui pendência de upload e gera comissão
CREATE OR REPLACE FUNCTION public.trg_comissao_anexo_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _aluno uuid;
  _profissional uuid;
  _pend record;
BEGIN
  SELECT aluno_id INTO _aluno FROM public.avaliacoes WHERE id = NEW.avaliacao_id;

  SELECT * INTO _pend FROM public.comissionamento_pendencias
  WHERE avaliacao_id = NEW.avaliacao_id AND tipo_pendencia = 'upload_arquivo_forca' AND concluido = false
  LIMIT 1;

  IF _pend.id IS NOT NULL THEN
    UPDATE public.comissionamento_pendencias
    SET concluido = true, concluido_em = now(), responsavel_id = NEW.uploaded_by
    WHERE id = _pend.id;

    _profissional := _pend.profissional_id;

    PERFORM public.fn_gerar_comissao(
      'avaliacao_funcional', _profissional, _aluno, 'avaliacoes', NEW.avaliacao_id,
      'Avaliação funcional + upload concluído'
    );
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_anexo_after_insert
AFTER INSERT ON public.avaliacao_anexos
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_anexo_insert();

-- ============= CANCELAMENTOS =============

-- Plano desativado → cancelar comissões experimentais do aluno
CREATE OR REPLACE FUNCTION public.trg_comissao_plano_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.ativo = true AND NEW.ativo = false THEN
    UPDATE public.comissionamentos
    SET status = 'cancelado', observacoes = COALESCE(observacoes,'') || ' [plano desativado]'
    WHERE aluno_id = NEW.aluno_id AND tipo = 'treino_experimental' AND status NOT IN ('pago','cancelado');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_comissao_plano_after_update
AFTER UPDATE OF ativo ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_plano_update();

-- Agenda removida → cancelar pendências/comissões originadas
CREATE OR REPLACE FUNCTION public.trg_comissao_agenda_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.comissionamentos
  SET status = 'cancelado', observacoes = COALESCE(observacoes,'') || ' [agenda removida]'
  WHERE origem_tabela = 'agenda_servicos' AND origem_id = OLD.id AND status NOT IN ('pago','cancelado');

  DELETE FROM public.comissionamento_pendencias
  WHERE agenda_id = OLD.id AND concluido = false;

  RETURN OLD;
END $$;

CREATE TRIGGER trg_comissao_agenda_before_delete
BEFORE DELETE ON public.agenda_servicos
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_agenda_delete();

-- Avaliação removida → cancelar comissão
CREATE OR REPLACE FUNCTION public.trg_comissao_avaliacao_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.comissionamentos
  SET status = 'cancelado', observacoes = COALESCE(observacoes,'') || ' [avaliação removida]'
  WHERE origem_tabela = 'avaliacoes' AND origem_id = OLD.id AND status NOT IN ('pago','cancelado');
  RETURN OLD;
END $$;

CREATE TRIGGER trg_comissao_avaliacao_before_delete
BEFORE DELETE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_comissao_avaliacao_delete();

-- ============= FUNÇÃO CARTEIRA — chamada pela edge function mensal =============

CREATE OR REPLACE FUNCTION public.fn_carteira_ativos_por_profissional()
RETURNS TABLE(profissional_id uuid, qtd_alunos integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.responsavel_id AS profissional_id, COUNT(*)::int AS qtd_alunos
  FROM public.alunos a
  WHERE a.status = 'ativo'
    AND a.responsavel_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.planos p
      WHERE p.aluno_id = a.id
        AND p.ativo = true
        AND p.tipo NOT IN ('Gympass/Wellhub','Total Pass')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.aluno_licencas l
      WHERE l.aluno_id = a.id
        AND CURRENT_DATE BETWEEN l.data_inicio AND l.data_fim
    )
  GROUP BY a.responsavel_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_carteira_total_ativos()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(qtd_alunos), 0)::int FROM public.fn_carteira_ativos_por_profissional();
$$;

CREATE OR REPLACE FUNCTION public.fn_processar_comissao_carteira(_ref date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total int;
  _meta int;
  _valor numeric;
  _criadas int := 0;
  r record;
BEGIN
  SELECT meta_minima, valor INTO _meta, _valor FROM public.comissionamento_config WHERE tipo = 'carteira_ativa' AND ativo;
  IF _valor IS NULL THEN RETURN 0; END IF;

  _total := public.fn_carteira_total_ativos();
  IF _total < COALESCE(_meta, 150) THEN RETURN 0; END IF;

  FOR r IN SELECT * FROM public.fn_carteira_ativos_por_profissional() LOOP
    INSERT INTO public.comissionamentos (tipo, profissional_id, aluno_id, origem_tabela, origem_id, valor, status, descricao, data_referencia)
    VALUES ('carteira_ativa', r.profissional_id, NULL, 'carteira_mensal', NULL, r.qtd_alunos * _valor, 'pendente',
      'Bonificação carteira: ' || r.qtd_alunos || ' alunos ativos (total ' || _total || ')', _ref)
    ON CONFLICT DO NOTHING;
    _criadas := _criadas + 1;
  END LOOP;

  RETURN _criadas;
END $$;
