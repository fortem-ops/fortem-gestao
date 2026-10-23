-- E1 Consultoria Online: só aditivo. Duração usa a coluna existente periodo_meses.
ALTER TABLE public.planos_catalogo DROP CONSTRAINT planos_catalogo_atividade_check;
ALTER TABLE public.planos_catalogo ADD CONSTRAINT planos_catalogo_atividade_check
  CHECK (atividade = ANY (ARRAY['treinamento_funcional'::text, 'corrida'::text, 'consultoria_online'::text]));

ALTER TABLE public.planos_catalogo DROP CONSTRAINT planos_catalogo_modalidade_ck;
ALTER TABLE public.planos_catalogo ADD CONSTRAINT planos_catalogo_modalidade_ck
  CHECK (modalidade_cobranca IS NULL OR modalidade_cobranca = ANY (ARRAY['recorrencia_mensal'::text, 'anual'::text, 'pacote'::text]));

COMMENT ON COLUMN public.planos_catalogo.periodo_meses IS
  'Duração em meses. Em modalidade pacote (consultoria_2027) também é o máximo de parcelas no cartão.';

INSERT INTO public.planos_catalogo
  (codigo, nome, nome_exibicao, familia, versao, atividade, modalidade_cobranca, periodo_meses, frequencia,
   quantidade_creditos, ilimitado, liberacao_creditos, valor, taxa_recorrencia, fidelidade_meses,
   licenca_dias, permite_fixar_horario, bota_compressao_mes, nivel_clube, reposicao_saldo_pct, ativo)
VALUES
  ('consultoria_2027_mensal', 'Consultoria Online', 'Consultoria Online (Mensal)', 'consultoria_2027', 2027, 'consultoria_online',
   'recorrencia_mensal', 1, 'livre', 0, false, NULL, 189.00, 0, 0, NULL, false, 0, 'bronze', 0, false),
  ('consultoria_2027_4m', 'Consultoria Online', 'Consultoria Online (4 meses)', 'consultoria_2027', 2027, 'consultoria_online',
   'pacote', 4, 'livre', 0, false, NULL, 676.00, 0, 0, NULL, false, 0, 'bronze', 0, false),
  ('consultoria_2027_6m', 'Consultoria Online', 'Consultoria Online (6 meses)', 'consultoria_2027', 2027, 'consultoria_online',
   'pacote', 6, 'livre', 0, false, NULL, 894.00, 0, 0, NULL, false, 0, 'bronze', 0, false);

CREATE OR REPLACE FUNCTION public.fn_aluno_somente_online(p_aluno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH vigentes AS (
    SELECT c.familia
    FROM public.planos p
    LEFT JOIN public.planos_catalogo c ON c.id = p.catalogo_id
    WHERE p.aluno_id = p_aluno_id
      AND p.ativo = true
      AND (p.data_fim IS NULL OR p.data_fim >= CURRENT_DATE OR coalesce(p.renovacao_automatica, false))
  )
  SELECT
    -- só o próprio aluno, a equipe ou o servidor podem consultar
    (auth.uid() IS NULL OR public.is_staff(auth.uid()) OR public.aluno_user_id(p_aluno_id) = auth.uid())
    AND EXISTS (SELECT 1 FROM vigentes WHERE familia = 'consultoria_2027')
    AND NOT EXISTS (SELECT 1 FROM vigentes WHERE familia IS DISTINCT FROM 'consultoria_2027');
$$;

REVOKE ALL ON FUNCTION public.fn_aluno_somente_online(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_aluno_somente_online(uuid) TO authenticated, service_role;