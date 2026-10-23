-- Volta da E3a Consultoria Online (migração 0196). Recusa rodar se já houver uso dos valores novos.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.planos WHERE atividade = 'consultoria_online')
     OR EXISTS (SELECT 1 FROM public.contratos WHERE plano_tipo = 'consultoria_2027' OR vigencia_tipo = 'quadrimestral') THEN
    RAISE EXCEPTION 'Há planos/contratos de Consultoria Online; não reverter.';
  END IF;
END $$;

ALTER TABLE public.planos DROP CONSTRAINT planos_atividade_check;
ALTER TABLE public.planos ADD CONSTRAINT planos_atividade_check
  CHECK (atividade = ANY (ARRAY['treinamento_funcional'::text, 'corrida'::text]));

ALTER TABLE public.contratos DROP CONSTRAINT contratos_plano_tipo_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_plano_tipo_check
  CHECK (plano_tipo = ANY (ARRAY['start'::text, 'start_plus'::text, 'power'::text, 'pro'::text, 'max'::text, 'corrida'::text, 'gympass'::text, 'wellhub'::text, 'totalpass'::text, 'outro'::text, 'start_2027'::text, 'power_2027'::text, 'pro_2027'::text]));

ALTER TABLE public.contratos DROP CONSTRAINT contratos_vigencia_tipo_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_vigencia_tipo_check
  CHECK (vigencia_tipo = ANY (ARRAY['mensal'::text, 'semestral'::text, 'anual'::text]));
