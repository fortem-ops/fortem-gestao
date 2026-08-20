UPDATE public.whatsapp_disparos_config
SET modo_teste = false
WHERE id IN ('5bea44df-d0f6-4cdc-9226-e6b6a187113b', '7d0b6545-bb5f-43fd-afab-02dc171c2054');

UPDATE public.whatsapp_disparos_log
SET status = 'reprocessado_teste'
WHERE id IN (
  'e4dad46c-4b1b-4878-9468-037bdaa4f002',
  'b32a7adf-c484-47bd-9b87-6dda1f2150a1',
  '213cf8b5-39ba-4229-a035-1055b7fb1b03',
  '8dd76b28-9c50-41c5-a451-464e75a020ef'
) AND status = 'bloqueado_teste';