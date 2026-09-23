DROP INDEX IF EXISTS public.uniq_auditoria_aberta;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_auditoria_achado
  ON public.auditoria_inconsistencias (categoria, subtipo, md5((registros_afetados)::text));