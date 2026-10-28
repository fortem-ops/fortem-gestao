-- Rollback da etapa 5 (migração 0209): trava o envio real de novo.
UPDATE public.msg_config SET valor = 'false'::jsonb, atualizado_em = now() WHERE chave = 'real_liberado';
