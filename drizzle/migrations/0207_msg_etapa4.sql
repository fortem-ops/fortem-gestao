REVOKE ALL ON TABLE public.msg_modelos, public.msg_optout, public.msg_campanhas, public.msg_campanha_destinatarios, public.msg_testes FROM anon;

CREATE TABLE public.msg_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.msg_config TO authenticated;
GRANT ALL ON public.msg_config TO service_role;
REVOKE ALL ON public.msg_config FROM anon;
ALTER TABLE public.msg_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_config admin select" ON public.msg_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
-- Trava do envio real: só migração/service_role altera. Etapa 5 libera por migração separada.
INSERT INTO public.msg_config (chave, valor) VALUES ('real_liberado', 'false'::jsonb);

ALTER TABLE public.msg_campanhas
  ADD COLUMN total_preparado int,
  ADD COLUMN preparado_em timestamptz,
  ADD COLUMN confirmado_total int,
  ADD COLUMN confirmado_por uuid,
  ADD COLUMN confirmado_em timestamptz,
  ADD COLUMN lote_limite int NOT NULL DEFAULT 50,
  ADD COLUMN deduplicados int DEFAULT 0;

CREATE OR REPLACE FUNCTION public.fn_msg_destinatarios(p_filtro jsonb, p_selecao jsonb)
RETURNS TABLE(aluno_id uuid, nome text, telefone_norm text, status text, duplicado boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text[];
  v_busca text := coalesce(trim(p_filtro->>'busca'),'');
  v_conf boolean := coalesce((p_filtro->>'exclConfirmados')::boolean, true);
  v_sem boolean := coalesce((p_filtro->>'exclSemContato')::boolean, true);
  v_modo text := coalesce(p_selecao->>'modo','ids');
  v_ids uuid[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT s), '{}') INTO v_status FROM (
    SELECT unnest(CASE c WHEN 'ativos' THEN ARRAY['ativo'] WHEN 'ex_alunos' THEN ARRAY['inativo','cancelado']
      WHEN 'leads' THEN ARRAY['lead'] WHEN 'prospects' THEN ARRAY['prospect'] WHEN 'avulsos' THEN ARRAY['avulso'] ELSE ARRAY[]::text[] END) s
    FROM jsonb_array_elements_text(coalesce(p_filtro->'chips','[]'::jsonb)) c) x;
  SELECT coalesce(array_agg(e::uuid), '{}') INTO v_ids FROM jsonb_array_elements_text(
    CASE WHEN v_modo = 'todos' THEN coalesce(p_selecao->'removidos','[]'::jsonb) ELSE coalesce(p_selecao->'ids','[]'::jsonb) END) e;

  RETURN QUERY
  WITH base AS (
    SELECT a.id, a.nome, a.status, a.is_equipe, public.fn_msg_norm_tel(a.telefone) AS tel
    FROM alunos a
    WHERE a.status = ANY(v_status)
      AND (v_busca = '' OR a.nome ILIKE '%'||v_busca||'%' OR a.email ILIKE '%'||v_busca||'%'
           OR (length(regexp_replace(v_busca,'\D','','g')) >= 3 AND regexp_replace(coalesce(a.telefone,''),'\D','','g') LIKE '%'||regexp_replace(v_busca,'\D','','g')||'%'))
  ), conf AS (
    SELECT DISTINCT public.fn_msg_norm_tel(whatsapp) t FROM festa_confirmacoes WHERE whatsapp IS NOT NULL
  ), m AS (
    SELECT b.*, CASE
        WHEN b.is_equipe THEN 'equipe'
        WHEN EXISTS (SELECT 1 FROM msg_optout o WHERE o.canal = 'whatsapp' AND (o.aluno_id = b.id OR o.telefone_norm = b.tel)) THEN 'optout'
        WHEN v_conf AND length(coalesce(b.tel,'')) >= 12 AND b.tel IN (SELECT t FROM conf) THEN 'confirmou'
        WHEN v_sem AND length(coalesce(b.tel,'')) < 12 THEN 'sem_contato'
      END AS motivo
    FROM base b
  ), sel AS (
    SELECT m.* FROM m
    WHERE m.motivo IS NULL AND length(coalesce(m.tel,'')) >= 12
      AND CASE WHEN v_modo = 'todos' THEN NOT (m.id = ANY(v_ids)) ELSE m.id = ANY(v_ids) END
  )
  SELECT s.id, s.nome, s.tel, s.status,
    (row_number() OVER (PARTITION BY s.tel ORDER BY s.nome, s.id)) > 1
  FROM sel s ORDER BY s.nome, s.id;
END $$;
REVOKE ALL ON FUNCTION public.fn_msg_destinatarios(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_msg_destinatarios(jsonb, jsonb) TO service_role;

-- Reserva atômica de um lote (impede envio duplicado em chamadas concorrentes).
CREATE OR REPLACE FUNCTION public.fn_msg_reservar_lote(p_campanha uuid, p_limite int)
RETURNS SETOF public.msg_campanha_destinatarios
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE msg_campanha_destinatarios d SET status = 'enviando'
  WHERE d.id IN (
    SELECT id FROM msg_campanha_destinatarios
    WHERE campanha_id = p_campanha AND status = 'pendente'
    ORDER BY nome, id LIMIT greatest(1, least(p_limite, 200))
    FOR UPDATE SKIP LOCKED)
  RETURNING d.*;
$$;
REVOKE ALL ON FUNCTION public.fn_msg_reservar_lote(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_msg_reservar_lote(uuid, int) TO service_role;

-- Revalidação no momento do envio: devolve o motivo de bloqueio ou NULL.
CREATE OR REPLACE FUNCTION public.fn_msg_revalidar(p_aluno uuid, p_tel text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM alunos a WHERE a.id = p_aluno AND a.is_equipe) THEN 'Cadastro passou a ser da equipe'
    WHEN EXISTS (SELECT 1 FROM msg_optout o WHERE o.canal = 'whatsapp' AND (o.aluno_id = p_aluno OR o.telefone_norm = p_tel)) THEN 'Pediu para não receber (opt-out)'
    WHEN EXISTS (SELECT 1 FROM festa_confirmacoes f WHERE f.whatsapp IS NOT NULL AND public.fn_msg_norm_tel(f.whatsapp) = p_tel) THEN 'Já confirmou presença na festa'
  END;
$$;
REVOKE ALL ON FUNCTION public.fn_msg_revalidar(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_msg_revalidar(uuid, text) TO service_role;