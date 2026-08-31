
CREATE TABLE IF NOT EXISTS public.import_aceite_historico_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid,
  contrato_id uuid,
  documento_id uuid,
  status text NOT NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.import_aceite_historico_log TO service_role;
ALTER TABLE public.import_aceite_historico_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS import_aceite_log_admin_read ON public.import_aceite_historico_log;
CREATE POLICY import_aceite_log_admin_read ON public.import_aceite_historico_log
  FOR SELECT TO authenticated USING (public.is_admin_role());
GRANT SELECT ON public.import_aceite_historico_log TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_tmp_importar_aceite_historico()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $fn$
DECLARE
  r record;
  v_aluno record;
  v_contrato record;
  v_tpl record;
  v_reg int;
  v_tplid uuid;
  v_cpf text;
  v_cpf_fmt text;
  v_cep text;
  v_end text;
  v_nasc text;
  v_conteudo text;
  v_vars jsonb;
  v_doc uuid;
  v_local timestamp;
BEGIN
  SELECT versao INTO v_reg FROM public.regulamento_interno_versoes
   WHERE ativo = true ORDER BY versao DESC LIMIT 1;

  FOR r IN
    SELECT * FROM (VALUES
      ('176bcc9d-7705-43e3-977f-2ab19cd00a4c'::uuid,'f5f3462a-a4e4-4762-8a87-951cc06ec64d'::uuid,'2026-08-03T23:05:00-03:00'::timestamptz),
      ('3641442f-8dc7-4e8d-a3de-8bd40a95fbe7','a3457f01-b0cf-4d3b-83c1-0815367888a1','2026-08-03T07:14:00-03:00'),
      ('c48cade4-5148-4552-b41b-c576f5496399','3ceb63a8-8bda-4bf8-99da-c9baa8eb1c06','2026-07-06T09:19:00-03:00'),
      ('d5952a8f-c66d-484f-b512-9ccb284a54c6','3b918267-5ec7-478c-8c2e-b3358cd33b04','2026-07-01T16:05:00-03:00'),
      ('b2ccaa3e-84f7-44f0-b915-3b9a03bdc29a','e59ffd4d-b6bc-45a7-8807-294d51b5e6c0','2026-08-03T13:23:00-03:00'),
      ('529f8f6d-64bd-4944-94d1-87f63fd9b817','bb2e7ca2-cdc1-4199-8a8d-dcf1af639627','2026-08-03T11:31:00-03:00'),
      ('fb78189b-e0c9-4d20-9d5b-018ac68d86d2','eb2e9e53-fa8e-49c2-80ea-531500cc7108','2026-08-04T00:02:00-03:00'),
      ('2d5b5f1f-22e2-4bf0-9e89-8d17f96e2416','7d91d6f8-1b48-415a-969e-4de561b412c6','2026-08-10T11:41:00-03:00'),
      ('d41841dc-010e-4687-9ff0-f9efe94cd285','542fbb9b-93be-46b8-b303-5e964324b706','2026-08-13T09:09:00-03:00'),
      ('828dd553-5e69-4ba5-87d4-1b227f43eb4a','6d93e875-74f3-46d7-acd1-16001daa33a6','2026-08-03T08:49:00-03:00'),
      ('bf1c493e-49b1-4e53-92dc-7134594aac92','7c9d15a4-47ac-4fe0-8a5f-e43e006af24b','2026-08-10T00:34:00-03:00'),
      ('2e0522b6-aa0f-468d-b292-fa440f0757f8','9299c88c-001d-4c02-8b2b-10b13b28edff','2026-08-03T10:50:00-03:00'),
      ('91167c28-07d4-4d26-8870-7e1a46d00a13','20afeb16-eb02-47d7-91ef-50e920461515','2026-08-18T09:28:00-03:00'),
      ('a33a56b7-3e9c-4205-a823-54ad717db7c0','b92ed4df-540a-433d-a3c5-a6bc268805b0','2026-07-07T10:53:00-03:00'),
      ('6b8e3b30-bbc9-4c3a-a03a-146a85b2a6f0','aa60a7c4-4527-4ef3-8408-d5613a2bccad','2026-08-11T00:14:00-03:00'),
      ('6b7afec8-0a9c-4832-92fc-73cfd85a8329','dc5242d5-b622-4b56-8a94-ad5b55546bae','2026-05-04T16:56:00-03:00'),
      ('dd1b77e3-56e9-435f-9655-8bdeb2d9eef2','7bec67a4-a051-4a83-942b-4dbce358f564','2026-08-05T12:18:00-03:00'),
      ('98f6ed4d-0ee0-4333-9b35-c3b54dcb9594','cd823d42-7a9d-43a1-ac62-2717f3ccb1b4','2026-08-03T08:38:00-03:00'),
      ('bad585e7-5dea-4d22-a519-2e8d3b1cbdcd','1820e855-e58d-4a2e-b409-be1ab636c57b','2026-04-23T10:46:00-03:00'),
      ('fb1f27d6-60ff-498c-aa35-4d0b45f6c29a','fe9300c9-6165-4e4a-be23-008628cfcca3','2026-08-15T10:58:00-03:00'),
      ('2ef6bc97-c15e-46b6-90f5-c9ccefe8ea09','0db189dd-1bc9-42b5-b0e1-fbe4014d4bf3','2026-08-05T09:43:00-03:00'),
      ('5a09db00-b2cb-466c-9eef-84215fe0c437','63eaae8e-9908-480a-9e3d-f5b5031a7d02','2026-08-07T17:43:00-03:00'),
      ('f3fd2e11-cf7a-45ff-b077-6707fe8be8be','cb337e44-8eb5-406a-a39e-28ce66b5c571','2026-08-10T11:03:00-03:00'),
      ('2f718296-0a6a-49d1-8438-aef3c7dac494','4cda3214-87ed-433e-8905-6cac79cc53b0','2026-08-03T20:21:00-03:00'),
      ('4c8fcfce-ed14-4699-be89-d3c38f5ab6d2','de87ae88-e1e5-45b8-8076-112cbccf9277','2026-08-03T17:41:00-03:00'),
      ('ece94b1a-54fb-4f70-887c-8dbc33cf9f76','8e7dcc8b-c0de-40ed-8778-06f0bef6fd8c','2026-08-06T21:16:00-03:00'),
      ('1dbde568-1a24-45d5-ac09-b0363d0f7559','ee37f52d-523f-49cc-b357-f3eefcedb0ee','2026-08-02T10:20:00-03:00'),
      ('8f420b2f-5ec9-4ad6-9101-3b6efdd3ba3e','adbc01d3-8301-4971-bab0-dd47763f6391','2026-08-04T09:05:00-03:00'),
      ('e54f37f6-59e2-4040-91ba-4d6aa94eeba9','08f76d22-59cb-4f65-8120-2bd3eb9e498a','2026-08-02T10:46:00-03:00'),
      ('8a948056-1ad1-4f45-a93b-e225e32d7128','17e26894-25bf-4622-b66f-640ddc2d9a4b','2026-08-05T18:35:00-03:00'),
      ('f644c8bf-a054-4392-a606-0cd2d0e61684','bbfc6d6d-6929-44ee-b169-f8c97d07917f','2026-08-02T11:24:00-03:00'),
      ('2cb779f9-40dc-4e8d-ac95-589cca273e8e','41d30f2d-3e2d-4336-8908-ad6883cc9d0a','2026-08-03T16:40:00-03:00'),
      ('955c2640-b2a5-45ff-9987-9746eda015aa','664ef6ae-78d9-45fd-ad36-726324f00c3d','2026-08-02T14:42:00-03:00'),
      ('12d7e39d-26c0-4c42-9dad-a51e3b6b2b89','8597569a-00d7-4f79-bebd-c863c1868c0b','2026-06-11T15:44:00-03:00'),
      ('b2346cf1-b4a3-4cf0-a44b-8946f7efaedc','13dadc9c-b981-4068-a9a8-c0eccecf6ef2','2026-07-23T16:00:00-03:00'),
      ('2ea9458b-542f-431b-90a1-0b383f134dce','7ac849fe-67fa-49fe-8820-9fd57ef95fd7','2026-06-01T14:37:00-03:00'),
      ('8dbfb877-eda8-47ab-b076-8cab2f53763b','dc91721b-5cf2-4499-a8bd-c0fa0f851b65','2026-08-01T13:45:00-03:00'),
      ('e5c6a870-3fd9-44bf-bd28-1c3224d13a7b','4d29d291-d439-4cd7-ae83-97aeec96075f','2026-08-06T21:09:00-03:00'),
      ('a321994a-b68d-4d57-a87a-2e5f3478689a','2ececd40-b16a-4bdc-9a7c-716b309d2a19','2026-05-14T11:02:00-03:00'),
      ('9cb9953b-400f-4680-bf93-79b2924f23d4','4c4e9c96-b0df-43d0-8330-b68fe0d4b0e0','2026-08-05T18:10:00-03:00'),
      ('6089c196-e8e6-46f9-b38d-70fcc525a38e','afd4c534-a5f0-4075-ad79-af35f53b93ef','2026-08-02T20:24:00-03:00'),
      ('3c0badb4-5296-46cc-9a76-7f6ae6c7392e','4edeecb2-5897-4ca4-bba8-8fc563ff526f','2026-08-03T16:27:00-03:00'),
      ('87d84270-f4ec-4871-8216-283a18563f55','5528f71b-f41c-4526-8bbb-36551108f52d','2026-05-15T13:23:00-03:00')
    ) AS t(aluno_id, contrato_id, data_aceite)
  LOOP
    BEGIN
      IF EXISTS (SELECT 1 FROM public.contratos_documentos d WHERE d.contrato_id = r.contrato_id) THEN
        INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, status, motivo)
        VALUES (r.aluno_id, r.contrato_id, 'ja_existia', 'Documento já existente para o contrato');
        CONTINUE;
      END IF;

      SELECT * INTO v_contrato FROM public.contratos WHERE id = r.contrato_id;
      IF v_contrato.id IS NULL OR v_contrato.aluno_id <> r.aluno_id THEN
        INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, status, motivo)
        VALUES (r.aluno_id, r.contrato_id, 'erro', 'Contrato inexistente ou aluno divergente');
        CONTINUE;
      END IF;

      v_tplid := CASE lower(coalesce(v_contrato.plano_tipo,''))
        WHEN 'start' THEN '5197281a-70fe-49ab-9879-acd4371b137f'::uuid
        WHEN 'gympass' THEN '67e1fc10-fa3f-452f-ba1e-ce53f5820b28'::uuid
        WHEN 'gympass/wellhub' THEN '67e1fc10-fa3f-452f-ba1e-ce53f5820b28'::uuid
        WHEN 'wellhub' THEN '352c1104-0c6a-4542-98d8-2ee6ca6bcbf6'::uuid
        WHEN 'totalpass' THEN '84317e7f-01b8-44d4-be36-2125c4949f90'::uuid
        WHEN 'total pass' THEN '84317e7f-01b8-44d4-be36-2125c4949f90'::uuid
        ELSE NULL END;

      IF v_tplid IS NULL THEN
        INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, status, motivo)
        VALUES (r.aluno_id, r.contrato_id, 'erro', 'Plano sem template mapeado: ' || coalesce(v_contrato.plano_tipo,'(nulo)'));
        CONTINUE;
      END IF;

      SELECT id, conteudo, versao, nome INTO v_tpl FROM public.contrato_templates WHERE id = v_tplid;
      IF v_tpl.id IS NULL THEN
        INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, status, motivo)
        VALUES (r.aluno_id, r.contrato_id, 'erro', 'Template não encontrado');
        CONTINUE;
      END IF;

      SELECT nome, email, rg, data_nascimento, logradouro, numero, complemento, bairro, cidade, uf, cep, cpf_encrypted
        INTO v_aluno FROM public.alunos WHERE id = r.aluno_id;
      IF v_aluno IS NULL THEN
        INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, status, motivo)
        VALUES (r.aluno_id, r.contrato_id, 'erro', 'Aluno não encontrado');
        CONTINUE;
      END IF;

      v_cpf := NULL;
      IF v_aluno.cpf_encrypted IS NOT NULL THEN
        v_cpf := extensions.pgp_sym_decrypt(
          v_aluno.cpf_encrypted,
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cpf_encryption_key'));
      END IF;
      v_cpf := regexp_replace(coalesce(v_cpf,''), '\D', '', 'g');
      v_cpf_fmt := CASE WHEN length(v_cpf) = 11
        THEN substr(v_cpf,1,3)||'.'||substr(v_cpf,4,3)||'.'||substr(v_cpf,7,3)||'-'||substr(v_cpf,10,2)
        ELSE v_cpf END;

      v_cep := regexp_replace(coalesce(v_aluno.cep,''), '\D', '', 'g');
      v_cep := CASE WHEN length(v_cep) = 8 THEN substr(v_cep,1,5)||'-'||substr(v_cep,6,3) ELSE coalesce(v_aluno.cep,'') END;

      v_end := CASE WHEN coalesce(v_aluno.logradouro,'') = '' THEN ''
        ELSE v_aluno.logradouro || ', ' || coalesce(v_aluno.numero,'')
             || CASE WHEN coalesce(v_aluno.complemento,'') <> '' THEN ' - ' || v_aluno.complemento ELSE '' END END;

      v_nasc := CASE WHEN v_aluno.data_nascimento IS NULL THEN '' ELSE to_char(v_aluno.data_nascimento, 'DD/MM/YYYY') END;

      v_local := (r.data_aceite AT TIME ZONE 'America/Sao_Paulo');

      v_vars := jsonb_build_object(
        'NOME', coalesce(v_aluno.nome,''),
        'DATA_NASCIMENTO', v_nasc,
        'CPF', v_cpf_fmt,
        'RG', coalesce(v_aluno.rg,''),
        'ENDERECO', v_end,
        'BAIRRO', coalesce(v_aluno.bairro,''),
        'CIDADE', coalesce(v_aluno.cidade,'Porto Alegre'),
        'UF', coalesce(v_aluno.uf,'RS'),
        'CEP', v_cep,
        'EMAIL', coalesce(v_aluno.email,''),
        'NOME_CONTRATO', v_tpl.nome,
        'VALOR_FINAL_CONTRATO', 'R$ ' || replace(replace(to_char(coalesce(v_contrato.valor_cobrado,0), 'FM999G999G990D00'), ',', '#'), '.', ','),
        'DIA', to_char(v_local, 'DD'),
        'MES', to_char(v_local, 'MM'),
        'ANO', to_char(v_local, 'YYYY')
      );

      v_conteudo := v_tpl.conteudo;
      v_conteudo := replace(v_conteudo, '%NOME%', v_vars->>'NOME');
      v_conteudo := replace(v_conteudo, '%DATA_NASCIMENTO%', v_vars->>'DATA_NASCIMENTO');
      v_conteudo := replace(v_conteudo, '%CPF%', v_vars->>'CPF');
      v_conteudo := replace(v_conteudo, '%RG%', v_vars->>'RG');
      v_conteudo := replace(v_conteudo, '%ENDERECO%', v_vars->>'ENDERECO');
      v_conteudo := replace(v_conteudo, '%BAIRRO%', v_vars->>'BAIRRO');
      v_conteudo := replace(v_conteudo, '%CIDADE%', v_vars->>'CIDADE');
      v_conteudo := replace(v_conteudo, '%UF%', v_vars->>'UF');
      v_conteudo := replace(v_conteudo, '%CEP%', v_vars->>'CEP');
      v_conteudo := replace(v_conteudo, '%EMAIL%', v_vars->>'EMAIL');
      v_conteudo := replace(v_conteudo, '%NOME_CONTRATO%', v_vars->>'NOME_CONTRATO');
      v_conteudo := replace(v_conteudo, '%VALOR_FINAL_CONTRATO%', v_vars->>'VALOR_FINAL_CONTRATO');
      v_conteudo := replace(v_conteudo, '%DIA%', v_vars->>'DIA');
      v_conteudo := replace(v_conteudo, '%MES%', v_vars->>'MES');
      v_conteudo := replace(v_conteudo, '%ANO%', v_vars->>'ANO');
      v_conteudo := replace(v_conteudo, '%ASSINATURA%', '');
      v_conteudo := replace(v_conteudo, '%ACEITE%', '');
      v_conteudo := replace(v_conteudo, '%DATA_ACEITE%', '');
      v_conteudo := replace(v_conteudo, '%FORMATO_ACEITE%', '');
      v_conteudo := replace(v_conteudo, '%IP_ACEITE%', '');

      INSERT INTO public.contratos_documentos(
        aluno_id, contrato_id, template_id, template_versao, regulamento_versao,
        conteudo_gerado, variaveis_utilizadas, aceite, data_aceite, formato_aceite, ip_aceite)
      VALUES (r.aluno_id, r.contrato_id, v_tpl.id, v_tpl.versao, v_reg,
        v_conteudo, v_vars, true, r.data_aceite,
        'Aceite registrado — importação de dados históricos', NULL)
      RETURNING id INTO v_doc;

      INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, documento_id, status)
      VALUES (r.aluno_id, r.contrato_id, v_doc, 'criado');
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.import_aceite_historico_log(aluno_id, contrato_id, status, motivo)
      VALUES (r.aluno_id, r.contrato_id, 'erro', SQLERRM);
    END;
  END LOOP;
END;
$fn$;

SELECT public.fn_tmp_importar_aceite_historico();

DROP FUNCTION public.fn_tmp_importar_aceite_historico();
