# Regularizar Nathália, Tainá, Carla e Vitor (e revisar Fernanda)

## O que encontrei
- **Nathália Nunes da Conceição**: 9 planos Power ativos, todos criados em 10/07. Só um está ligado ao contrato ativo (10/07/2026 a 10/07/2027), e é esse que fica. Existem também 9 vendas do Power (6 "pagas" e 3 "pendentes"), uma para cada plano repetido.
- **Tainá Mafalda dos Santos**: há dois cadastros com o mesmo nome.
  - O cadastro **LEAD** (de 2025) tem um plano Total Pass, 2 contratos, 3 vendas pendentes e 2 cobranças de R$ 0,00 marcadas como atrasadas.
  - O cadastro correto (de 06/2026) está marcado como **inativo**. O plano Total Pass dele começa em 01/09, mas a próxima renovação está em **24/10**, e deveria ser em 01/10. O contrato também vai até 24/10.
- **Carla Cimone** (Start, início 30/09) e **Vitor da Silva Barbosa** (Total Pass, início 01/10): parece tudo certo na tela, mas há um problema que não aparece. A próxima renovação foi gravada igual ao dia de início. Por isso, a renovação automática rodaria **um dia depois do início** (Carla em 01/10, Vitor em 02/10) e criaria plano e venda repetidos. É o mesmo problema da Rafaela.
- **Fernanda Gallas**: o Total Pass está certo (renova em 01/10). Mas o plano Start+ antigo, que terminou em 13/07/2026, ainda aparece como ativo.

## O que será feito
1. **Nathália**: deixar ativo só o Power ligado ao contrato e desativar os outros 8. Contrato e mensalidades não mudam.
2. **Tainá**:
   - excluir o cadastro LEAD e tudo que está ligado a ele (plano, contratos, vendas e as 2 cobranças de R$ 0,00);
   - no cadastro correto, mudar para **ativo**, próxima renovação em **01/10/2026**, e o contrato vigente de 01/09 a 01/10.
   - A partir daí, o Total Pass renova todo dia 1.
3. **Carla**: próxima renovação passa para 30/10/2026.
4. **Vitor**: próxima renovação passa para 01/11/2026.
5. **Proteção extra na renovação automática**: nunca renovar um plano cuja próxima renovação seja igual ou anterior ao dia de início. Nesse caso, a rotina corrige a data para início + 1 mês, em vez de renovar.
6. Conferir no banco e no perfil de cada um.

## Precisa da sua confirmação
- **Vendas repetidas da Nathália**: as 8 vendas extras (5 "pagas" e 3 "pendentes") inflam os relatórios de vendas. Remover ou manter?
- **Start+ antigo da Fernanda**: desativar?

## O que NÃO será feito
- Nenhuma cobrança ou estorno no cartão. O cron 28 e a cobrança automática continuam desligados.

## Detalhes técnicos
- Nathália 74bc8b71: manter plano bc6cfb40 (contrato ativo); desativar ca819f74, 2bf14f9c, 504edb5e, 138a1ef9, 0f391cae, 447e132d, 856332c0, 7c0db834.
- Tainá: remover aluno e1403c77 e seus dependentes (plano a6e46048/429e2af8, contratos, vendas, cobranças ec380e19/28019837 com inadimplências, pipeline). Aluno c6af4eb0: status ativo; plano 5b7e2a48 proxima_renovacao 2026-10-01; contrato ativo data_inicio 2026-09-01, data_fim 2026-10-01.
- Carla: plano d1393ade proxima_renovacao 2026-10-30. Vitor: plano 62fc9766 proxima_renovacao 2026-11-01.
- `renovar-planos-mensais`: se proxima_renovacao <= data_inicio, atualizar para data_inicio + 1 mês e pular; deploy.
