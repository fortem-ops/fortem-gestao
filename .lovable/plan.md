# Pagamentos Pix — separar a lista por mês

## Contexto

A tela Financeiro → Pagamentos Pix (`src/pages/financeiro/PagamentosPix.tsx`) hoje mostra a lista "Prontas para enviar" como uma tabela única, ordenada por competência. Com a folha e outras despesas acumulando meses, fica difícil enxergar o que pertence a cada mês.

## Mudança

Agrupar as linhas por mês (mês/ano da **competência** da despesa), mantendo a ordem cronológica:

1. **"Prontas para enviar"** — dentro do card, entre um mês e outro, renderizar uma linha de cabeçalho de grupo (ex.: **Setembro 2026**) com:
   - nome do mês em destaque (estilo dos cabeçalhos existentes, tokens semânticos — nada hardcoded);
   - quantidade de despesas e somatório do valor líquido previsto daquele mês, à direita;
   - checkbox do grupo: marca/desmarca só as despesas daquele mês.
2. **"Sem chave Pix cadastrada"** — mesmo agrupamento por mês de competência (mesmo componente de cabeçalho de grupo, sem checkbox, pois essa lista não é selecionável).
3. **"Acompanhamento"** — permanece como está (ordenado por data de pagamento/agendamento, mais recente primeiro).

O checkbox global "Selecionar todos" do cabeçalho da tabela continua selecionando tudo (todos os meses). O modal de confirmação, as datas editáveis "Pagar em" e o envio em lote não mudam — é apenas uma reorganização visual da renderização das linhas.

## Implementação

- Em `src/pages/financeiro/PagamentosPix.tsx`:
  - Adicionar um `useMemo` que agrupa `elegiveis` (e `semChave`/`semFornecedor`) por `data_competencia.slice(0,7)` (YYYY-MM), com rótulo em pt-BR (ex.: "Setembro 2026") e total por grupo.
  - Extrair um pequeno componente de linha de grupo (`MonthHeaderRow`) usado pelas duas tabelas, com `colSpan` adequado a cada uma.
  - Checkbox do grupo controla somente os ids daquele mês no `Set` de seleção; o estado global `sel` permanece único (sem risco de inconsistência ao enviar).
- Nenhuma mudança de banco, edge function ou lógica de envio.

## Validação

- Typecheck (`tsgo --noEmit -p tsconfig.app.json`).
- Verificar no preview que os grupos aparecem por mês, o checkbox de mês e o global funcionam, e o envio segue montando o lote correto.
