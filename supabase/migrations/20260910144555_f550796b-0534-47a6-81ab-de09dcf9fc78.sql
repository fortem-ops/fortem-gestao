-- ============ PEDIDOS ============
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES public.alunos(id),
  nome text NOT NULL,
  cpf text NOT NULL,
  telefone text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando_pagamento' CHECK (status IN ('aguardando_pagamento','pago','cancelado','expirado')),
  valor_total numeric NOT NULL,
  desconto numeric NOT NULL DEFAULT 0,
  valor_final numeric NOT NULL,
  promocao_id uuid REFERENCES public.promocoes(id),
  forma_pagamento text,
  cobranca_id uuid,
  nota_fiscal_status text NOT NULL DEFAULT 'nao_emitida',
  retirado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_aluno ON public.pedidos(aluno_id);
CREATE INDEX idx_pedidos_status ON public.pedidos(status);
CREATE INDEX idx_pedidos_promocao ON public.pedidos(promocao_id);
CREATE INDEX idx_pedidos_created_at ON public.pedidos(created_at DESC);

GRANT INSERT ON public.pedidos TO anon;
GRANT INSERT ON public.pedidos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_public_insert" ON public.pedidos
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "pedidos_admin_read" ON public.pedidos
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "pedidos_admin_write" ON public.pedidos
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));

CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PEDIDO ITENS ============
CREATE TABLE public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  variante_id uuid NOT NULL REFERENCES public.produtos_variantes(id),
  quantidade integer NOT NULL CHECK (quantidade > 0),
  preco_unitario_snapshot numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedido_itens_pedido ON public.pedido_itens(pedido_id);
CREATE INDEX idx_pedido_itens_variante ON public.pedido_itens(variante_id);

GRANT INSERT ON public.pedido_itens TO anon;
GRANT INSERT ON public.pedido_itens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT ALL ON public.pedido_itens TO service_role;

ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedido_itens_public_insert" ON public.pedido_itens
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "pedido_itens_admin_read" ON public.pedido_itens
  FOR SELECT TO authenticated USING (public.is_coordinator_or_admin(auth.uid()));

CREATE POLICY "pedido_itens_admin_write" ON public.pedido_itens
  FOR ALL TO authenticated
  USING (public.is_coordinator_or_admin(auth.uid()))
  WITH CHECK (public.is_coordinator_or_admin(auth.uid()));
