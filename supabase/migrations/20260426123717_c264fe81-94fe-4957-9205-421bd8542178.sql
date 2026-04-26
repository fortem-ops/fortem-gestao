-- ================================================================
-- Tabela de alertas internos do Clube FORTEM
-- ================================================================
CREATE TYPE public.clube_alerta_tipo AS ENUM (
  'cron_falha',
  'divergencia_nivel',
  'sincronizacao_parcial',
  'manual'
);

CREATE TYPE public.clube_alerta_severidade AS ENUM ('info', 'aviso', 'critico');

CREATE TABLE public.clube_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.clube_alerta_tipo NOT NULL,
  severidade public.clube_alerta_severidade NOT NULL DEFAULT 'aviso',
  mensagem text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  aluno_id uuid,
  lido boolean NOT NULL DEFAULT false,
  lido_por uuid,
  lido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clube_alertas_lido ON public.clube_alertas (lido, created_at DESC);
CREATE INDEX idx_clube_alertas_aluno ON public.clube_alertas (aluno_id) WHERE aluno_id IS NOT NULL;

ALTER TABLE public.clube_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coord/admin can view alertas"
  ON public.clube_alertas FOR SELECT TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can update alertas"
  ON public.clube_alertas FOR UPDATE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "Coord/admin can delete alertas"
  ON public.clube_alertas FOR DELETE TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()));

-- INSERT só via funções SECURITY DEFINER (sem policy de INSERT)

-- ================================================================
-- Função: verificar divergências plano <-> nível
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_clube_check_divergencias()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _r record;
  _info jsonb;
  _esperado public.clube_nivel_membro;
  _esperado_status public.clube_status_membro;
  _divergencias int := 0;
BEGIN
  FOR _r IN
    SELECT m.aluno_id, m.nivel_membro, m.status_membro, a.nome
    FROM public.clube_fortem_membros m
    JOIN public.alunos a ON a.id = m.aluno_id
    WHERE m.status_membro <> 'cancelado'
  LOOP
    _info := public.fn_clube_nivel_por_plano(_r.aluno_id);
    _esperado := (_info->>'nivel')::public.clube_nivel_membro;
    _esperado_status := (_info->>'status')::public.clube_status_membro;

    IF _r.nivel_membro <> _esperado
       OR (_r.status_membro <> _esperado_status
           AND _r.status_membro NOT IN ('inadimplente','bloqueado')) THEN
      INSERT INTO public.clube_alertas (tipo, severidade, mensagem, payload, aluno_id)
      VALUES (
        'divergencia_nivel',
        'aviso',
        'Divergência entre plano e nível do Clube para ' || _r.nome,
        jsonb_build_object(
          'aluno_id', _r.aluno_id,
          'aluno_nome', _r.nome,
          'nivel_atual', _r.nivel_membro,
          'nivel_esperado', _esperado,
          'status_atual', _r.status_membro,
          'status_esperado', _esperado_status
        ),
        _r.aluno_id
      );
      _divergencias := _divergencias + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('divergencias', _divergencias, 'verificado_em', now());
END $$;

-- ================================================================
-- Versão segura do resync (captura falhas e registra alerta)
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_clube_resync_todos_safe()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _resync_result jsonb;
  _diverg_result jsonb;
BEGIN
  BEGIN
    _resync_result := public.fn_clube_resync_todos();
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.clube_alertas (tipo, severidade, mensagem, payload)
    VALUES (
      'cron_falha',
      'critico',
      'Falha no cron diário de re-sincronização do Clube FORTEM',
      jsonb_build_object('erro', SQLERRM, 'sqlstate', SQLSTATE, 'quando', now())
    );
    RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
  END;

  BEGIN
    _diverg_result := public.fn_clube_check_divergencias();
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.clube_alertas (tipo, severidade, mensagem, payload)
    VALUES (
      'cron_falha',
      'aviso',
      'Falha ao verificar divergências do Clube FORTEM',
      jsonb_build_object('erro', SQLERRM, 'sqlstate', SQLSTATE)
    );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'resync', _resync_result,
    'divergencias', _diverg_result
  );
END $$;

-- ================================================================
-- Reagenda o cron para usar a versão safe
-- ================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('clube-fortem-resync-diario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clube-fortem-resync-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'clube-fortem-resync-diario',
  '0 3 * * *',
  $$ SELECT public.fn_clube_resync_todos_safe(); $$
);

-- Função utilitária: marcar alerta como lido
CREATE OR REPLACE FUNCTION public.fn_clube_marcar_alerta_lido(_alerta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.clube_alertas
  SET lido = true, lido_por = auth.uid(), lido_em = now()
  WHERE id = _alerta_id;
END $$;