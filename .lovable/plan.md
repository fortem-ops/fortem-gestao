## Problema

A RPC `fn_criar_contrato_recorrencia` (versão com `p_servicos_inclusos`) deriva `plano_tipo` a partir da string de frequência do plano (`'1x'`, `'2x'`, `'3x'`, `'livre'`). Nenhum desses valores satisfaz o CHECK constraint `contratos_plano_tipo_check`, que aceita apenas: `start, start_plus, power, pro, max, corrida, gympass, wellhub, totalpass, outro`.

Resultado: qualquer venda recorrência (cartão online, pix automático, boleto, ou "finalizar pendente") falha ao inserir o contrato.

Bug adicional: o mapeamento de `frequencia_semanal` para `'livre'` retorna `7`, mas o CHECK aceita apenas `(1, 2, 3, 5)`.

## Correção

Migração ajustando a função `fn_criar_contrato_recorrencia` (assinatura com `p_servicos_inclusos jsonb`):

1. Derivar `v_plano_tipo` a partir de `v_plano.nome` (lower/trim), mapeando:
   - `start` → `'start'`
   - `start+` / `start plus` → `'start_plus'`
   - `power` → `'power'`
   - `pro` → `'pro'`
   - `max` / `vip` → `'max'`
   - `corrida` → `'corrida'`
   - `gympass` (contém) → `'gympass'`
   - `wellhub` (contém) → `'wellhub'`
   - `total pass` / `totalpass` → `'totalpass'`
   - fallback → `'outro'`
2. Ajustar `frequencia_semanal` para `'livre'` de `7` → `5` (valor aceito pelo CHECK).

Sem alterações em frontend ou edge functions — todos já chamam a RPC com os mesmos parâmetros.

## Validação

- Tentar venda recorrência → "Finalizar pagamento pendente" no aluno atual.
- Conferir que `contratos` e 12 `cobrancas` foram criados.
- Conferir aba Contrato no perfil do aluno.
