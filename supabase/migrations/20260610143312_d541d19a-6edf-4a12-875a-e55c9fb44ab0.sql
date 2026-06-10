ALTER TABLE public.planos DROP CONSTRAINT IF EXISTS planos_tipo_check;

ALTER TABLE public.planos ADD CONSTRAINT planos_tipo_check
CHECK (tipo = ANY (ARRAY[
  'Start','Start+','Power','Pro','Max',
  'Gympass/Wellhub','Total Pass',
  'VIP','VIP Livre',
  'VIP 1x/semana','VIP 2x/semana','VIP 3x/semana',
  'VIP 4x/semana','VIP 5x/semana','VIP 6x/semana','VIP 7x/semana'
]));