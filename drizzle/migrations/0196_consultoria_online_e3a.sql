ALTER TABLE public.planos DROP CONSTRAINT planos_atividade_check;
ALTER TABLE public.planos ADD CONSTRAINT planos_atividade_check
  CHECK (atividade = ANY (ARRAY['treinamento_funcional'::text, 'corrida'::text, 'consultoria_online'::text]));

ALTER TABLE public.contratos DROP CONSTRAINT contratos_plano_tipo_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_plano_tipo_check
  CHECK (plano_tipo = ANY (ARRAY['start'::text, 'start_plus'::text, 'power'::text, 'pro'::text, 'max'::text, 'corrida'::text, 'gympass'::text, 'wellhub'::text, 'totalpass'::text, 'outro'::text, 'start_2027'::text, 'power_2027'::text, 'pro_2027'::text, 'consultoria_2027'::text]));

ALTER TABLE public.contratos DROP CONSTRAINT contratos_vigencia_tipo_check;
ALTER TABLE public.contratos ADD CONSTRAINT contratos_vigencia_tipo_check
  CHECK (vigencia_tipo = ANY (ARRAY['mensal'::text, 'quadrimestral'::text, 'semestral'::text, 'anual'::text]));