# Renovação antecipada de plano

## Situação atual (Ubirajara)
Plano Start mensal (legado), R$ 389, ciclo atual 13/10 a 13/11/2026, renovação automática todo dia 13 (cria o plano do mês seguinte e desativa o anterior).

## O que será feito
1. Na aba Plano/Contrato do aluno, novo botão **RENOVAR ANTECIPADAMENTE** (só admin), ao lado das ações do plano ativo.
2. Ao clicar, abre confirmação mostrando: ciclo atual, novo ciclo (hoje 06/11 a 06/12), valor e aviso de que o próximo vencimento passa do dia 13 para o dia 6.
3. Ao confirmar, o sistema:
   - encerra o ciclo atual hoje (fim em 06/11, inativo);
   - cria o novo ciclo de 06/11 a 06/12, mesmo tipo/valor/desconto, com próxima renovação em 06/12;
   - gera a nova mensalidade (cobrança) com vencimento hoje, no mesmo formato da renovação mensal automática, para a equipe usar "Cobrar" ou "Dar Baixa";
   - libera os créditos do novo ciclo como a renovação normal faz, sem duplicar se já existirem;
   - registra no histórico quem fez e quando.
4. Trava: não deixa renovar duas vezes no mesmo dia nem se o ciclo atual tiver começado hoje; a rotina automática do dia 13 não renova de novo porque o plano ativo passa a vencer em 06/12.
5. Aplicar no Ubirajara após você aprovar o resultado.

## Fora do escopo
Não muda a rotina automática de renovação nem planos 2027 (esses seguem o próprio cronograma); não cobra o cartão automaticamente.

## Detalhes técnicos
- Nova RPC `fn_plano_renovar_antecipado(_plano_id)`, security definer, só admin ativo; reaproveita a mesma lógica de criação de ciclo/cobrança/créditos do bloco legado de `renovar-planos-mensais` sem editar aquele bloco.
- Ensaio SQL revertido antes; teste no front em `StudentPlan`/aba contrato.
- Antes de implementar, conferir como o contrato/cobrança do ciclo 13/10 foi gerado para replicar exatamente.
