ALTER TABLE public.conciliacoes_bancarias DROP CONSTRAINT conciliacoes_bancarias_tabela_origem_check;
ALTER TABLE public.conciliacoes_bancarias ADD CONSTRAINT conciliacoes_bancarias_tabela_origem_check
  CHECK (tabela_origem = ANY (ARRAY['receitas','despesas','despesas_multiplas','ignorado']));