-- ============ PRODUTOS ============
CREATE TABLE public.produtos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  categoria text,
  imagem_url text,
  preco_base numeric NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.produtos_catalogo TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_catalogo TO authenticated;
GRANT ALL ON public.produtos_catalogo TO service_role;

ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_catalogo_public_read_ativos" ON public.produtos_catalogo
  FOR SELECT TO anon, authenticated USING (ativo = true);

CREATE POLICY "produtos_catalogo_admin_read" ON public.produtos_catalogo
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "produtos_catalogo_admin_write" ON public.produtos_catalogo
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_produtos_catalogo_updated_at BEFORE UPDATE ON public.produtos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VARIANTES ============
CREATE TABLE public.produtos_variantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.produtos_catalogo(id) ON DELETE CASCADE,
  tamanho text,
  cor text,
  sku text,
  preco numeric,
  estoque_atual integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_produtos_variantes_produto ON public.produtos_variantes(produto_id);
CREATE UNIQUE INDEX uq_produtos_variantes_sku ON public.produtos_variantes(sku) WHERE sku IS NOT NULL;

GRANT SELECT ON public.produtos_variantes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_variantes TO authenticated;
GRANT ALL ON public.produtos_variantes TO service_role;

ALTER TABLE public.produtos_variantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_variantes_public_read_ativos" ON public.produtos_variantes
  FOR SELECT TO anon, authenticated
  USING (
    ativo = true
    AND EXISTS (SELECT 1 FROM public.produtos_catalogo p WHERE p.id = produto_id AND p.ativo = true)
  );

CREATE POLICY "produtos_variantes_admin_read" ON public.produtos_variantes
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "produtos_variantes_admin_write" ON public.produtos_variantes
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_produtos_variantes_updated_at BEFORE UPDATE ON public.produtos_variantes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MOVIMENTOS DE ESTOQUE ============
CREATE TABLE public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variante_id uuid NOT NULL REFERENCES public.produtos_variantes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('entrada','saida','ajuste','reserva','cancelamento_reserva')),
  quantidade integer NOT NULL,
  motivo text,
  pedido_id uuid,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estoque_movimentos_variante ON public.estoque_movimentos(variante_id, created_at DESC);

GRANT SELECT, INSERT ON public.estoque_movimentos TO authenticated;
GRANT ALL ON public.estoque_movimentos TO service_role;

ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_movimentos_admin_read" ON public.estoque_movimentos
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "estoque_movimentos_admin_insert" ON public.estoque_movimentos
  FOR INSERT TO authenticated WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

-- ============ PROMOCOES ============
CREATE TABLE public.promocoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text,
  tipo text NOT NULL CHECK (tipo IN ('percentual','valor_fixo')),
  valor numeric NOT NULL,
  valido_de timestamptz,
  valido_ate timestamptz,
  uso_maximo integer,
  uso_atual integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_promocoes_codigo ON public.promocoes(upper(codigo)) WHERE codigo IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promocoes TO authenticated;
GRANT ALL ON public.promocoes TO service_role;

ALTER TABLE public.promocoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promocoes_admin_read" ON public.promocoes
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "promocoes_admin_write" ON public.promocoes
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_promocoes_updated_at BEFORE UPDATE ON public.promocoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUDITORIA AUTOMATICA DE ESTOQUE ============
CREATE OR REPLACE FUNCTION public.fn_estoque_log_automatico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _delta integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estoque_atual <> 0 THEN
      INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, created_by)
      VALUES (NEW.id, 'entrada', NEW.estoque_atual, 'Estoque inicial da variante', auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.estoque_atual IS DISTINCT FROM OLD.estoque_atual THEN
    -- movimentos feitos pela funcao oficial ja gravam o historico
    IF coalesce(current_setting('app.estoque_mov', true), '') <> 'on' THEN
      _delta := NEW.estoque_atual - OLD.estoque_atual;
      INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, created_by)
      VALUES (
        NEW.id,
        CASE WHEN _delta > 0 THEN 'entrada' ELSE 'saida' END,
        abs(_delta),
        'Alteracao direta de estoque',
        auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_estoque_log_insert AFTER INSERT ON public.produtos_variantes
  FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_log_automatico();

CREATE TRIGGER trg_estoque_log_update AFTER UPDATE ON public.produtos_variantes
  FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_log_automatico();

-- ============ MOVIMENTACAO OFICIAL ============
CREATE OR REPLACE FUNCTION public.fn_estoque_movimentar(
  p_variante_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_motivo text,
  p_pedido_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _novo integer;
  _delta integer;
BEGIN
  IF NOT public.is_coordinator_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissao para movimentar estoque';
  END IF;

  IF p_tipo NOT IN ('entrada','saida','ajuste','reserva','cancelamento_reserva') THEN
    RAISE EXCEPTION 'Tipo de movimento invalido: %', p_tipo;
  END IF;

  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo e obrigatorio';
  END IF;

  IF p_quantidade IS NULL OR (p_tipo <> 'ajuste' AND p_quantidade <= 0) THEN
    RAISE EXCEPTION 'Quantidade invalida';
  END IF;

  PERFORM set_config('app.estoque_mov', 'on', true);

  IF p_tipo = 'ajuste' THEN
    UPDATE public.produtos_variantes
      SET estoque_atual = p_quantidade
      WHERE id = p_variante_id
      RETURNING estoque_atual INTO _novo;
  ELSE
    _delta := CASE WHEN p_tipo IN ('entrada','cancelamento_reserva') THEN p_quantidade ELSE -p_quantidade END;
    UPDATE public.produtos_variantes
      SET estoque_atual = estoque_atual + _delta
      WHERE id = p_variante_id
      RETURNING estoque_atual INTO _novo;
  END IF;

  IF _novo IS NULL THEN
    PERFORM set_config('app.estoque_mov', 'off', true);
    RAISE EXCEPTION 'Variante nao encontrada';
  END IF;

  IF _novo < 0 THEN
    PERFORM set_config('app.estoque_mov', 'off', true);
    RAISE EXCEPTION 'Estoque nao pode ficar negativo';
  END IF;

  INSERT INTO public.estoque_movimentos (variante_id, tipo, quantidade, motivo, pedido_id, created_by)
  VALUES (p_variante_id, p_tipo, p_quantidade, p_motivo, p_pedido_id, auth.uid());

  PERFORM set_config('app.estoque_mov', 'off', true);

  RETURN _novo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_estoque_movimentar(uuid, text, integer, text, uuid) TO authenticated;