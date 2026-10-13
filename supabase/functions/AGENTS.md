# Edge functions

- Pagamentos Pix (Inter Banking v2) só saem pela função `enviar-pagamentos-pix`, Admin-only e após confirmação na tela; a baixa vem de `verificar-pagamentos-pix-diario` (agendada, só consulta). Por quê: nenhum dinheiro sai sem confirmação humana e o status do Inter é a fonte da verdade.
- Pix Automático (Inter) usa o conjunto de credenciais escolhido por `CRED_PIX_AUTOMATICO` em `_shared/inter.ts` (padrão INTER_COB_*), com cache em `inter_tokens` filtrado por `credencial` e só reaproveitado se o escopo pedido estiver contido no do token; Loja/Corrida seguem em `inter-cob.ts`/`inter_cob_tokens`. Por quê: a integração antiga não tem Pix Automático liberado e tokens de escopos diferentes não podem se misturar.
