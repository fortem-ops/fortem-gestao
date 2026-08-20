ALTER TABLE public.whatsapp_disparos_config
  DROP CONSTRAINT whatsapp_disparos_config_destinatario_check;

ALTER TABLE public.whatsapp_disparos_config
  ADD CONSTRAINT whatsapp_disparos_config_destinatario_check
  CHECK (destinatario = ANY (ARRAY['aluno'::text, 'profissional'::text, 'consultor'::text]));