-- Função batch para re-sincronizar todos os membros do Clube FORTEM
CREATE OR REPLACE FUNCTION public.fn_clube_resync_todos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _aluno_id uuid;
  _count int := 0;
BEGIN
  FOR _aluno_id IN SELECT id FROM public.alunos LOOP
    PERFORM public.fn_clube_sync_membro(_aluno_id);
    _count := _count + 1;
  END LOOP;
  RETURN jsonb_build_object('sincronizados', _count, 'executado_em', now());
END $$;

-- Habilitar pg_cron (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remover job anterior se existir e agendar novamente
DO $$
BEGIN
  PERFORM cron.unschedule('clube-fortem-resync-diario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'clube-fortem-resync-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'clube-fortem-resync-diario',
  '0 3 * * *',
  $$ SELECT public.fn_clube_resync_todos(); $$
);