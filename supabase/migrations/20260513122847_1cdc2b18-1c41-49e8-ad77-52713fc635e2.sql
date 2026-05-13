
-- Enum para tipo de lançamento
DO $$ BEGIN
  CREATE TYPE public.ponto_banco_tipo AS ENUM ('credito_manual','debito_manual','compensacao','ajuste_saldo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de lançamentos do banco de horas
CREATE TABLE IF NOT EXISTS public.ponto_banco_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  minutos integer NOT NULL,
  motivo text NOT NULL,
  tipo public.ponto_banco_tipo NOT NULL DEFAULT 'ajuste_saldo',
  registrado_por uuid NOT NULL,
  referencia_jornada_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ponto_banco_horas_motivo_check CHECK (length(trim(motivo)) >= 3),
  CONSTRAINT ponto_banco_horas_minutos_check CHECK (minutos <> 0)
);

CREATE INDEX IF NOT EXISTS idx_ponto_banco_horas_usuario_data ON public.ponto_banco_horas(usuario_id, data DESC);

ALTER TABLE public.ponto_banco_horas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banco_horas_select_self_or_coord" ON public.ponto_banco_horas;
CREATE POLICY "banco_horas_select_self_or_coord"
ON public.ponto_banco_horas FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR public.is_coordinator_or_admin(auth.uid()));

DROP POLICY IF EXISTS "banco_horas_insert_coord" ON public.ponto_banco_horas;
CREATE POLICY "banco_horas_insert_coord"
ON public.ponto_banco_horas FOR INSERT TO authenticated
WITH CHECK (public.is_coordinator_or_admin(auth.uid()) AND registrado_por = auth.uid());

DROP POLICY IF EXISTS "banco_horas_update_coord" ON public.ponto_banco_horas;
CREATE POLICY "banco_horas_update_coord"
ON public.ponto_banco_horas FOR UPDATE TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()));

DROP POLICY IF EXISTS "banco_horas_delete_coord" ON public.ponto_banco_horas;
CREATE POLICY "banco_horas_delete_coord"
ON public.ponto_banco_horas FOR DELETE TO authenticated
USING (public.is_coordinator_or_admin(auth.uid()));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_ponto_banco_horas_updated ON public.ponto_banco_horas;
CREATE TRIGGER trg_ponto_banco_horas_updated
BEFORE UPDATE ON public.ponto_banco_horas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Saldo acumulado em minutos até uma data (default: total)
CREATE OR REPLACE FUNCTION public.fn_ponto_banco_saldo(_user_id uuid, _ate date DEFAULT NULL)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(minutos), 0)::int
  FROM public.ponto_banco_horas
  WHERE usuario_id = _user_id
    AND (_ate IS NULL OR data <= _ate);
$$;

-- Resumo mensal: saldo inicial, créditos e débitos no mês, total no mês
CREATE OR REPLACE FUNCTION public.fn_ponto_banco_resumo(_user_id uuid, _mes date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ini date := date_trunc('month', _mes)::date;
  _fim date := (date_trunc('month', _mes) + interval '1 month - 1 day')::date;
  _ant date := _ini - 1;
  _saldo_inicial int;
  _cred int;
  _deb int;
BEGIN
  SELECT public.fn_ponto_banco_saldo(_user_id, _ant) INTO _saldo_inicial;
  SELECT COALESCE(SUM(minutos) FILTER (WHERE minutos > 0), 0)::int,
         COALESCE(SUM(minutos) FILTER (WHERE minutos < 0), 0)::int
    INTO _cred, _deb
  FROM public.ponto_banco_horas
  WHERE usuario_id = _user_id AND data BETWEEN _ini AND _fim;

  RETURN jsonb_build_object(
    'saldo_inicial', _saldo_inicial,
    'creditos_mes', _cred,
    'debitos_mes', _deb,
    'movimentacao_mes', _cred + _deb,
    'saldo_final', _saldo_inicial + _cred + _deb
  );
END $$;
