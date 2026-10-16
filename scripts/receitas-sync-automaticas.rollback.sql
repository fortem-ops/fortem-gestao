-- Desfaz a sincronização automática de Receitas
SELECT cron.unschedule('receitas-sync-diario');
DROP TRIGGER IF EXISTS trg_cobrancas_sync_receitas ON public.cobrancas;
DELETE FROM public.receitas WHERE origem = 'automatico';
