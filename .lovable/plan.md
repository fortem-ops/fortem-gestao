# Créditos errados no portal da Bruna Meyer

## Causa (confirmada no banco)
- O Pro 3x anual dela está ativo, com ciclo de 156 créditos (32 usados, 124 restantes).
- Em 11/11 foi feito o teste real do Pro Semestral (R$ 1,00). O contrato foi cancelado, mas o ciclo de créditos dele (12 créditos, 1 usado, até 10/12) continuou "ativo".
- O início do portal mostra o ciclo ativo com data de início mais recente. Por isso aparece o ciclo do teste: "11 de 12".
- Outros 2 ciclos estão na mesma situação (ativos, mas de contratos cancelados).

## O que será feito
1. Fechar os 3 ciclos ativos de contratos cancelados (incluindo o do teste da Bruna). O plano anual dela e os seus 156 créditos não mudam.
2. Impedir que volte a acontecer: quando um contrato for cancelado, os ciclos ativos dele são encerrados na hora.
3. Portal: o card de créditos considera só ciclos de contratos ativos e, se houver mais de um, mostra o principal (o de maior saldo contratado ou soma, ver abaixo), em vez do mais recente.
4. Rever a mesma suposição na agenda do portal e nas telas da equipe que leem "o ciclo ativo", para que nenhuma use ciclo de contrato cancelado.

## Detalhes técnicos
- Migration: `UPDATE ciclos_credito SET status='cancelado'` onde o contrato está `cancelado` e o ciclo `ativo`; gatilho AFTER UPDATE OF status em `contratos` fazendo o mesmo. Conferir antes os 2 outros alunos afetados.
- `PortalHome.tsx`: filtro `contratos.status = 'ativo'` na consulta de `ciclos_credito`.
- Teste de regressão: ciclo de contrato cancelado não aparece e gatilho encerra ciclos.
- Rodar vitest, eslint e build; frontend precisa de Publish.
