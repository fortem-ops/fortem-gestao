CREATE OR REPLACE FUNCTION public.fn_sync_nivel_membro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _nivel_pontos text;
  _nivel_plano text;
  _nivel_final text;
  _plano_tipo text;
  _rank_pontos int;
  _rank_plano int;
BEGIN
  -- Nível pelos pontos, mapeado para o enum de plano
  _nivel_pontos := CASE NEW.nivel
    WHEN 'elite'        THEN 'max'
    WHEN 'comprometido' THEN 'pro'
    WHEN 'dedicado'     THEN 'power'
    ELSE                     'start'
  END;

  SELECT lower(tipo) INTO _plano_tipo
  FROM planos
  WHERE aluno_id = NEW.aluno_id AND ativo = true
  ORDER BY created_at DESC LIMIT 1;

  _plano_tipo := REPLACE(LOWER(COALESCE(_plano_tipo, 'start')), '+', '_plus');
  _plano_tipo := REPLACE(_plano_tipo, ' ', '_');

  _nivel_plano := CASE _plano_tipo
    WHEN 'max'        THEN 'max'
    WHEN 'pro'        THEN 'pro'
    WHEN 'power'      THEN 'power'
    WHEN 'start_plus' THEN 'start_plus'
    ELSE                   'start'
  END;

  _rank_pontos := CASE _nivel_pontos WHEN 'max' THEN 5 WHEN 'pro' THEN 4 WHEN 'power' THEN 3 WHEN 'start_plus' THEN 2 ELSE 1 END;
  _rank_plano  := CASE _nivel_plano  WHEN 'max' THEN 5 WHEN 'pro' THEN 4 WHEN 'power' THEN 3 WHEN 'start_plus' THEN 2 ELSE 1 END;

  _nivel_final := CASE WHEN _rank_pontos >= _rank_plano THEN _nivel_pontos ELSE _nivel_plano END;

  INSERT INTO public.clube_fortem_membros (aluno_id, nivel_membro, status_membro)
  VALUES (NEW.aluno_id, _nivel_final::clube_nivel_membro, 'ativo')
  ON CONFLICT (aluno_id) DO UPDATE SET
    nivel_membro = _nivel_final::clube_nivel_membro,
    updated_at   = now()
  WHERE clube_fortem_membros.nivel_membro::text IS DISTINCT FROM _nivel_final;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  rec RECORD;
  _nivel_pontos text;
  _nivel_plano text;
  _nivel_final text;
  _plano_tipo text;
  _rank_pontos int;
  _rank_plano int;
BEGIN
  FOR rec IN SELECT aluno_id, nivel FROM public.clube_pontos LOOP
    _nivel_pontos := CASE rec.nivel
      WHEN 'elite'        THEN 'max'
      WHEN 'comprometido' THEN 'pro'
      WHEN 'dedicado'     THEN 'power'
      ELSE                     'start'
    END;

    SELECT lower(REPLACE(REPLACE(tipo, '+', '_plus'), ' ', '_'))
    INTO _plano_tipo
    FROM planos
    WHERE aluno_id = rec.aluno_id AND ativo = true
    ORDER BY created_at DESC LIMIT 1;

    _plano_tipo := COALESCE(_plano_tipo, 'start');

    _nivel_plano := CASE _plano_tipo
      WHEN 'max'        THEN 'max'
      WHEN 'pro'        THEN 'pro'
      WHEN 'power'      THEN 'power'
      WHEN 'start_plus' THEN 'start_plus'
      ELSE                   'start'
    END;

    _rank_pontos := CASE _nivel_pontos WHEN 'max' THEN 5 WHEN 'pro' THEN 4 WHEN 'power' THEN 3 WHEN 'start_plus' THEN 2 ELSE 1 END;
    _rank_plano  := CASE _nivel_plano  WHEN 'max' THEN 5 WHEN 'pro' THEN 4 WHEN 'power' THEN 3 WHEN 'start_plus' THEN 2 ELSE 1 END;

    _nivel_final := CASE WHEN _rank_pontos >= _rank_plano THEN _nivel_pontos ELSE _nivel_plano END;

    INSERT INTO public.clube_fortem_membros (aluno_id, nivel_membro, status_membro)
    VALUES (rec.aluno_id, _nivel_final::clube_nivel_membro, 'ativo')
    ON CONFLICT (aluno_id) DO UPDATE SET
      nivel_membro = _nivel_final::clube_nivel_membro,
      updated_at   = now();
  END LOOP;
END;
$$;