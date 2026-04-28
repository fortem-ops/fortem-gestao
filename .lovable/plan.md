# Limite total na vigência (sem renovação por período)

Hoje, em "Novo benefício", o `Limite por período` reinicia a cada janela do campo `Periodicidade` (dia/semana/mês). O usuário quer que o limite seja **total dentro da vigência do benefício** — uma vez atingido, não renova.

## Mudanças

### Banco — `fn_clube_validar_token`
- Substituir o cálculo de `_periodo_inicio` (hoje baseado em `date_trunc(periodicidade, now())`) por:
  - Contar `uso_beneficios` válidos do mesmo aluno + benefício desde `_beneficio.data_inicio` (sem upper bound — vigência aberta) ou até `_beneficio.data_fim + 1 dia` se preenchida.
- Mensagem de recusa: `"Limite de usos do benefício atingido"`.
- Manter colunas `periodicidade` e `limite_por_periodo` no schema (sem mudança estrutural) para não quebrar tipos gerados.

### `src/components/clube/AdminBeneficiosTable.tsx`
- Remover o campo "Periodicidade" do diálogo.
- Renomear o label de `limite_por_periodo` para **"Limite total de usos"** (input numérico, opcional → ilimitado).
- Texto auxiliar abaixo do campo: "Limite válido para toda a vigência do benefício; não renova."
- No `save()`, enviar `periodicidade: 'livre'` por padrão (campo segue existindo no banco, apenas não é mais editável).
- Na tabela de listagem, trocar a coluna **"Limite"** para mostrar `"5 usos"` (ou `"Livre"`), sem mais o sufixo `/Mensal` etc.

## Fora do escopo
- Não adicionamos DatePickers de vigência (pedido cancelado anteriormente).
- Não removemos colunas do banco — só ajustamos a função de validação e a UI do admin.
- `PartnersList.tsx` não exibe periodicidade hoje; nada a alterar lá.
