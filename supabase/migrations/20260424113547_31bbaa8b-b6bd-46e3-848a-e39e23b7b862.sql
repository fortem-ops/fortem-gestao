
-- ============================================================
-- MÓDULO CLUBE FORTEM
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ENUMS
CREATE TYPE public.clube_status_membro AS ENUM ('ativo','bloqueado','inadimplente','cancelado');
CREATE TYPE public.clube_nivel_membro AS ENUM ('start','start_plus','power','pro','max');
CREATE TYPE public.parceiro_modo_validacao AS ENUM ('qr_scan','cpf_manual','lista_nome');
CREATE TYPE public.beneficio_tipo AS ENUM ('desconto_percentual','desconto_valor','gratuidade','vantagem_exclusiva','cashback_futuro');
CREATE TYPE public.beneficio_periodicidade AS ENUM ('dia','semana','mes','livre');
CREATE TYPE public.uso_status_validacao AS ENUM ('valido','recusado','expirado','bloqueado');
CREATE TYPE public.uso_origem_validacao AS ENUM ('scanner','cpf_manual','admin');
CREATE TYPE public.regra_elegibilidade_tipo AS ENUM ('plano','frequencia_minima','status_financeiro','tempo_matricula');

-- SEQUENCE
CREATE SEQUENCE IF NOT EXISTS public.clube_fortem_id_seq START 1;

-- TABELA: clube_fortem_membros
CREATE TABLE public.clube_fortem_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL UNIQUE REFERENCES public.alunos(id) ON DELETE CASCADE,
  cpf_hash text NOT NULL UNIQUE,
  status_membro public.clube_status_membro NOT NULL DEFAULT 'ativo',
  nivel_membro public.clube_nivel_membro NOT NULL DEFAULT 'start',
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  qr_secret text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32),'hex'),
  ultimo_refresh_qr timestamptz,
  fortem_id text NOT NULL UNIQUE,
  foto_url text,
  aluno_desde date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clube_membros_aluno_id ON public.clube_fortem_membros(aluno_id);
CREATE INDEX idx_clube_membros_cpf_hash ON public.clube_fortem_membros(cpf_hash);
CREATE INDEX idx_clube_membros_fortem_id ON public.clube_fortem_membros(fortem_id);

CREATE OR REPLACE FUNCTION public.fn_clube_generate_fortem_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.fortem_id IS NULL OR NEW.fortem_id = '' THEN
    NEW.fortem_id := 'FORTEM ID ' || lpad(nextval('public.clube_fortem_id_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_clube_membros_fortem_id
BEFORE INSERT ON public.clube_fortem_membros
FOR EACH ROW EXECUTE FUNCTION public.fn_clube_generate_fortem_id();

CREATE TRIGGER trg_clube_membros_updated
BEFORE UPDATE ON public.clube_fortem_membros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clube_fortem_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view membros"
  ON public.clube_fortem_membros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin can insert membros"
  ON public.clube_fortem_membros FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin can update membros"
  ON public.clube_fortem_membros FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Admin can delete membros"
  ON public.clube_fortem_membros FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- TABELA: parceiros
CREATE TABLE public.parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL,
  descricao text,
  logo_url text,
  responsavel_nome text,
  responsavel_contato text,
  email_login text UNIQUE,
  user_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  data_inicio_parceria date NOT NULL DEFAULT CURRENT_DATE,
  data_fim_parceria date,
  modo_validacao public.parceiro_modo_validacao NOT NULL DEFAULT 'qr_scan',
  pontuacao_engajamento integer NOT NULL DEFAULT 0,
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parceiros_ativo ON public.parceiros(ativo);
CREATE INDEX idx_parceiros_user_id ON public.parceiros(user_id);

CREATE TRIGGER trg_parceiros_updated
BEFORE UPDATE ON public.parceiros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view parceiros"
  ON public.parceiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin can insert parceiros"
  ON public.parceiros FOR INSERT TO authenticated
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
CREATE POLICY "Coord/admin or owner can update parceiros"
  ON public.parceiros FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Coord/admin can delete parceiros"
  ON public.parceiros FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

-- TABELA: beneficios
CREATE TABLE public.beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo public.beneficio_tipo NOT NULL,
  regra_uso text,
  limite_por_periodo integer,
  periodicidade public.beneficio_periodicidade NOT NULL DEFAULT 'livre',
  nivel_minimo public.clube_nivel_membro NOT NULL DEFAULT 'start',
  ativo boolean NOT NULL DEFAULT true,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_beneficios_parceiro ON public.beneficios(parceiro_id);
CREATE INDEX idx_beneficios_ativo ON public.beneficios(ativo);

CREATE TRIGGER trg_beneficios_updated
BEFORE UPDATE ON public.beneficios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view beneficios"
  ON public.beneficios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin or partner owner can insert beneficios"
  ON public.beneficios FOR INSERT TO authenticated
  WITH CHECK (
    public.is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
  );
CREATE POLICY "Coord/admin or partner owner can update beneficios"
  ON public.beneficios FOR UPDATE TO authenticated
  USING (
    public.is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
  );
CREATE POLICY "Coord/admin can delete beneficios"
  ON public.beneficios FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

-- TABELA: regras_elegibilidade
CREATE TABLE public.regras_elegibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficio_id uuid NOT NULL REFERENCES public.beneficios(id) ON DELETE CASCADE,
  tipo_regra public.regra_elegibilidade_tipo NOT NULL,
  valor_regra text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_regras_beneficio ON public.regras_elegibilidade(beneficio_id);

CREATE TRIGGER trg_regras_updated
BEFORE UPDATE ON public.regras_elegibilidade
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.regras_elegibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view regras"
  ON public.regras_elegibilidade FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coord/admin can manage regras"
  ON public.regras_elegibilidade FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

-- TABELA: uso_beneficios
CREATE TABLE public.uso_beneficios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  cpf_hash text NOT NULL,
  beneficio_id uuid NOT NULL REFERENCES public.beneficios(id) ON DELETE RESTRICT,
  parceiro_id uuid NOT NULL REFERENCES public.parceiros(id) ON DELETE RESTRICT,
  validado_por uuid,
  data_uso date NOT NULL DEFAULT CURRENT_DATE,
  hora_uso time NOT NULL DEFAULT CURRENT_TIME,
  status_validacao public.uso_status_validacao NOT NULL,
  motivo_recusa text,
  token_validacao text,
  origem_validacao public.uso_origem_validacao NOT NULL DEFAULT 'scanner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uso_aluno ON public.uso_beneficios(aluno_id);
CREATE INDEX idx_uso_parceiro ON public.uso_beneficios(parceiro_id);
CREATE INDEX idx_uso_beneficio ON public.uso_beneficios(beneficio_id);
CREATE INDEX idx_uso_data ON public.uso_beneficios(data_uso);

ALTER TABLE public.uso_beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own/own-partner/coord uso"
  ON public.uso_beneficios FOR SELECT TO authenticated
  USING (
    public.is_coordinator_or_admin(auth.uid())
    OR validado_por = auth.uid()
    OR EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND a.responsavel_id = auth.uid())
  );

CREATE POLICY "Authenticated can insert uso"
  ON public.uso_beneficios FOR INSERT TO authenticated
  WITH CHECK (validado_por = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

-- ============================================================
-- FUNÇÕES
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_clube_hash_cpf(_cpf text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT encode(extensions.digest(regexp_replace(_cpf, '[^0-9]', '', 'g'), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.fn_clube_generate_qr_token(_aluno_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _membro record;
  _payload text;
  _signature text;
  _token text;
  _expires_at timestamptz;
  _nonce text;
BEGIN
  IF NOT (
    public.is_coordinator_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.alunos WHERE id = _aluno_id AND responsavel_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para gerar QR deste aluno';
  END IF;

  SELECT * INTO _membro FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id;
  IF _membro IS NULL THEN
    RAISE EXCEPTION 'Aluno não é membro do Clube FORTEM';
  END IF;

  _expires_at := now() + interval '30 seconds';
  _nonce := encode(extensions.gen_random_bytes(8), 'hex');
  _payload := encode(
    convert_to(
      jsonb_build_object(
        'aluno_id', _membro.aluno_id,
        'cpf_hash', _membro.cpf_hash,
        'exp', extract(epoch FROM _expires_at)::bigint,
        'nonce', _nonce
      )::text,
      'UTF8'
    ),
    'base64'
  );
  _payload := translate(_payload, E'+/=\n', '-_');
  _signature := translate(encode(extensions.hmac(_payload, _membro.qr_secret, 'sha256'), 'base64'), E'+/=\n', '-_');
  _token := _payload || '.' || _signature;

  UPDATE public.clube_fortem_membros SET ultimo_refresh_qr = now() WHERE id = _membro.id;

  RETURN jsonb_build_object(
    'token', _token,
    'expires_at', _expires_at,
    'fortem_id', _membro.fortem_id,
    'nivel_membro', _membro.nivel_membro,
    'status_membro', _membro.status_membro
  );
END $$;

CREATE OR REPLACE FUNCTION public.fn_clube_validar_token(_token text, _beneficio_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  _parts text[];
  _payload_b64 text;
  _signature text;
  _payload_json jsonb;
  _payload_text text;
  _aluno_id uuid;
  _cpf_hash text;
  _exp bigint;
  _membro record;
  _beneficio record;
  _expected_sig text;
  _aluno record;
  _used_count int;
  _periodo_inicio timestamptz;
  _regra record;
  _motivo text;
  _status public.uso_status_validacao := 'valido';
  _plano_ativo boolean;
  _dias_matricula int;
BEGIN
  _parts := string_to_array(_token, '.');
  IF array_length(_parts, 1) <> 2 THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Token malformado');
  END IF;
  _payload_b64 := _parts[1];
  _signature := _parts[2];

  BEGIN
    _payload_text := convert_from(decode(translate(_payload_b64, '-_', '+/') || repeat('=', (4 - length(_payload_b64) % 4) % 4), 'base64'), 'UTF8');
    _payload_json := _payload_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Payload inválido');
  END;

  _aluno_id := (_payload_json->>'aluno_id')::uuid;
  _cpf_hash := _payload_json->>'cpf_hash';
  _exp := (_payload_json->>'exp')::bigint;

  SELECT * INTO _membro FROM public.clube_fortem_membros WHERE aluno_id = _aluno_id AND cpf_hash = _cpf_hash;
  IF _membro IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Membro não encontrado');
  END IF;

  _expected_sig := translate(encode(extensions.hmac(_payload_b64, _membro.qr_secret, 'sha256'), 'base64'), E'+/=\n', '-_');
  IF _expected_sig <> _signature THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Assinatura inválida');
  END IF;

  IF to_timestamp(_exp) < now() THEN
    INSERT INTO public.uso_beneficios (aluno_id, cpf_hash, beneficio_id, parceiro_id, validado_por, status_validacao, motivo_recusa, token_validacao, origem_validacao)
      SELECT _aluno_id, _cpf_hash, _beneficio_id, b.parceiro_id, auth.uid(), 'expirado', 'Token expirado', _token, 'scanner'
      FROM public.beneficios b WHERE b.id = _beneficio_id;
    RETURN jsonb_build_object('ok', false, 'motivo', 'Token expirado');
  END IF;

  SELECT * INTO _beneficio FROM public.beneficios WHERE id = _beneficio_id;
  IF _beneficio IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'Benefício não encontrado');
  END IF;

  SELECT * INTO _aluno FROM public.alunos WHERE id = _aluno_id;

  IF _membro.status_membro <> 'ativo' THEN
    _status := 'bloqueado';
    _motivo := 'Membro ' || _membro.status_membro;
  ELSIF NOT _beneficio.ativo THEN
    _status := 'recusado';
    _motivo := 'Benefício inativo';
  ELSIF _beneficio.data_inicio > CURRENT_DATE OR (_beneficio.data_fim IS NOT NULL AND _beneficio.data_fim < CURRENT_DATE) THEN
    _status := 'recusado';
    _motivo := 'Benefício fora do período de vigência';
  ELSIF array_position(ARRAY['start','start_plus','power','pro','max']::text[], _membro.nivel_membro::text)
        < array_position(ARRAY['start','start_plus','power','pro','max']::text[], _beneficio.nivel_minimo::text) THEN
    _status := 'recusado';
    _motivo := 'Nível insuficiente';
  ELSIF _beneficio.limite_por_periodo IS NOT NULL THEN
    _periodo_inicio := CASE _beneficio.periodicidade
      WHEN 'dia' THEN date_trunc('day', now())
      WHEN 'semana' THEN date_trunc('week', now())
      WHEN 'mes' THEN date_trunc('month', now())
      ELSE NULL
    END;
    IF _periodo_inicio IS NOT NULL THEN
      SELECT count(*) INTO _used_count FROM public.uso_beneficios
        WHERE aluno_id = _aluno_id AND beneficio_id = _beneficio_id
          AND status_validacao = 'valido' AND created_at >= _periodo_inicio;
      IF _used_count >= _beneficio.limite_por_periodo THEN
        _status := 'recusado';
        _motivo := 'Limite de uso atingido para o período';
      END IF;
    END IF;
  END IF;

  IF _status = 'valido' THEN
    FOR _regra IN SELECT * FROM public.regras_elegibilidade WHERE beneficio_id = _beneficio_id AND ativo = true LOOP
      IF _regra.tipo_regra = 'plano' THEN
        IF NOT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = _aluno_id AND ativo = true AND tipo = _regra.valor_regra) THEN
          _status := 'recusado'; _motivo := 'Plano não atende à regra'; EXIT;
        END IF;
      ELSIF _regra.tipo_regra = 'status_financeiro' THEN
        SELECT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = _aluno_id AND ativo = true) INTO _plano_ativo;
        IF _regra.valor_regra = 'ativo' AND NOT _plano_ativo THEN
          _status := 'recusado'; _motivo := 'Sem plano ativo'; EXIT;
        END IF;
      ELSIF _regra.tipo_regra = 'tempo_matricula' THEN
        _dias_matricula := (CURRENT_DATE - _membro.aluno_desde);
        IF _dias_matricula < _regra.valor_regra::int THEN
          _status := 'recusado'; _motivo := 'Tempo de matrícula insuficiente'; EXIT;
        END IF;
      ELSIF _regra.tipo_regra = 'frequencia_minima' THEN
        IF COALESCE(_aluno.frequencia_semanal, 0) < _regra.valor_regra::int THEN
          _status := 'recusado'; _motivo := 'Frequência semanal abaixo do mínimo'; EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.uso_beneficios (aluno_id, cpf_hash, beneficio_id, parceiro_id, validado_por, status_validacao, motivo_recusa, token_validacao, origem_validacao)
  VALUES (_aluno_id, _cpf_hash, _beneficio_id, _beneficio.parceiro_id, auth.uid(), _status, _motivo, _token, 'scanner');

  IF _status = 'valido' THEN
    UPDATE public.parceiros SET pontuacao_engajamento = pontuacao_engajamento + 1 WHERE id = _beneficio.parceiro_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', _status = 'valido',
    'status', _status,
    'motivo', _motivo,
    'aluno', jsonb_build_object('id', _aluno.id, 'nome', _aluno.nome, 'fortem_id', _membro.fortem_id, 'nivel', _membro.nivel_membro),
    'beneficio', jsonb_build_object('titulo', _beneficio.titulo, 'descricao', _beneficio.descricao)
  );
END $$;

CREATE OR REPLACE FUNCTION public.fn_clube_sync_status_financeiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _has_active boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.planos WHERE aluno_id = NEW.aluno_id AND ativo = true) INTO _has_active;
  UPDATE public.clube_fortem_membros
  SET status_membro = CASE
    WHEN status_membro IN ('cancelado','bloqueado') THEN status_membro
    WHEN _has_active THEN 'ativo'::public.clube_status_membro
    ELSE 'inadimplente'::public.clube_status_membro
  END
  WHERE aluno_id = NEW.aluno_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_planos_clube_sync
AFTER INSERT OR UPDATE ON public.planos
FOR EACH ROW EXECUTE FUNCTION public.fn_clube_sync_status_financeiro();

CREATE OR REPLACE FUNCTION public.fn_clube_dashboard(_periodo_dias int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _result jsonb;
  _desde date := CURRENT_DATE - _periodo_dias;
  _total_alunos int;
  _total_membros int;
BEGIN
  SELECT count(*) INTO _total_alunos FROM public.alunos WHERE status = 'ativo';
  SELECT count(*) INTO _total_membros FROM public.clube_fortem_membros WHERE status_membro = 'ativo';

  WITH usos AS (
    SELECT u.*, b.titulo AS beneficio_titulo, p.nome AS parceiro_nome, p.categoria
    FROM public.uso_beneficios u
    JOIN public.beneficios b ON b.id = u.beneficio_id
    JOIN public.parceiros p ON p.id = u.parceiro_id
    WHERE u.data_uso >= _desde AND u.status_validacao = 'valido'
  )
  SELECT jsonb_build_object(
    'usos_periodo', (SELECT count(*) FROM usos),
    'usos_hoje', (SELECT count(*) FROM usos WHERE data_uso = CURRENT_DATE),
    'membros_ativos', _total_membros,
    'taxa_ativacao', CASE WHEN _total_alunos > 0 THEN round((_total_membros::numeric / _total_alunos) * 100, 1) ELSE 0 END,
    'ranking_parceiros', COALESCE((
      SELECT jsonb_agg(row_to_json(r)) FROM (
        SELECT parceiro_nome AS nome, count(*) AS usos FROM usos GROUP BY parceiro_nome ORDER BY usos DESC LIMIT 5
      ) r
    ), '[]'::jsonb),
    'beneficio_top', (SELECT beneficio_titulo FROM usos GROUP BY beneficio_titulo ORDER BY count(*) DESC LIMIT 1),
    'uso_por_categoria', COALESCE((
      SELECT jsonb_agg(row_to_json(c)) FROM (
        SELECT categoria, count(*) AS usos FROM usos GROUP BY categoria ORDER BY usos DESC
      ) c
    ), '[]'::jsonb),
    'parceiro_destaque', (SELECT nome FROM public.parceiros ORDER BY pontuacao_engajamento DESC LIMIT 1)
  ) INTO _result;

  RETURN _result;
END $$;
