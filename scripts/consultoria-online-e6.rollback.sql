-- Rollback E6: desliga os 3 itens da Consultoria Online 2027 (não toca legado nem outras famílias)
UPDATE planos_catalogo SET ativo = false
WHERE familia = 'consultoria_2027' AND versao = 2027
  AND id IN ('c958faf4-f3ba-4b8f-960a-019b4c31aa38','00291601-fca1-4dfe-9c6f-c42062589ecb','864959d4-0836-4fa1-b81a-44563fa771d9');
