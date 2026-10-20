# Cobrança mensal 2027 (planos-recorrencia-diario)

- Manual 2027 recurring sales join `planos_2027_mensalidades` via `venda_origem_id` (null proposta), each row tied to a normal contract `cobranca`; generated after cycle 1 settles (Start: next cycle only, renewed by `fn_renovar_start_2027`). Why: one charging path with the same locks, no double charge, team edits on the charge still sync.
- O cron planos-recorrencia-diario autentica por `x-cron-secret` (valor só no cofre do banco, hash em `planos_recorrencia_cron_hash`), válido apenas para o modo real; por quê: a chave de serviço não fica disponível para o job e o cron nunca pode simular nem fazer teste real.
