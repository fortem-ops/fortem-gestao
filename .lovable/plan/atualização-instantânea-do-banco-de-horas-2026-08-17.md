# Atualização instantânea do Banco de Horas

## O problema

Ao lançar um crédito/débito (ex.: −15h para a Thaís), a tabela continua mostrando o valor antigo (0m) até você recarregar a tela.

Causa confirmada: o diálogo de lançamento avisa o cache com a chave `admin-banco`, mas a tabela que exibe os saldos usa a chave `admin-banco-lancamentos-mes`. Como as chaves não coincidem (a comparação é exata por elemento, não por texto parcial), a tabela nunca é notificada e não recarrega. O mesmo vale para o Relatório de Ponto (`relatorio-banco-lancamentos`), para o resumo mensal do profissional (`meu-relatorio-banco-resumo`) e para o Relatório de Equipe (`relatorios-equipe-banco`).

## O que será feito

1. Padronizar a invalidação de cache do banco de horas em um único helper (ex.: `invalidateBancoHoras(qc)`), que dispara todas as chaves relacionadas:
   - `admin-banco-lancamentos-mes`
   - `admin-banco-historico`
   - `relatorio-banco-lancamentos`
   - `meu-relatorio-banco-resumo`
   - `meu-banco-saldo`, `meu-banco-resumo`, `meu-banco-lancamentos`, `banco-mais-antigo`
   - `relatorios-equipe-banco`
2. Usar esse helper em todos os pontos que alteram banco de horas:
   - `LancamentoBancoHorasDialog` (criar lançamento)
   - `HistoricoBancoHorasDialog` (excluir lançamento)
   - `AdminSubstituicoes` e `AdminAtividadesEspeciais` (que hoje também usam a chave errada `admin-banco`)
3. Após o lançamento, aguardar a revalidação antes de fechar o diálogo, para que a linha já apareça atualizada quando a tela voltar.

## Detalhes técnicos

- Novo helper em `src/lib/query-invalidation.ts` (arquivo já existente com o mesmo padrão de helpers por domínio), usando `invalidateQueries` por prefixo de chave para cobrir variações de mês/usuário.
- Sem mudanças de banco de dados, RPC ou regra de negócio — apenas sincronização de cache no frontend.
