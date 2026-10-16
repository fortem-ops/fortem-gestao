# Previsibilidade: botões de mês em Recebíveis e Calendário ligado aos recebíveis

## O que muda para você
1. **Aba Recebíveis:** acima dos filtros, uma fileira de botões com os meses. Começa em **Outubro/26** e segue com Novembro/26, Dezembro/26, Janeiro/27... até o último mês que tem recebimento previsto. Há também o botão **Todos**.
   - Ao tocar num mês, os campos "De" e "Até" são preenchidos com o primeiro e o último dia desse mês, e a lista e o total mostram só esse mês.
   - Os filtros atuais (De/Até, Origem, Forma, busca por aluno) continuam funcionando. Se você mudar as datas à mão, nenhum botão de mês fica marcado.
   - Cada botão mostra o total líquido previsto daquele mês.
2. **Aba Calendário:**
   - Cada dia do calendário vai mostrar o mesmo valor que a lista de Recebíveis mostra para aquela data, incluindo as parcelas de cartão marcadas como "Já cobrado". Ao tocar no dia, a lista que abre soma exatamente o valor da célula.
   - O Calendário ganha os mesmos botões de mês, para pular direto para Novembro/26, Março/27 etc., além das setas.
   - Ao escolher um mês na aba Recebíveis, o Calendário abre nesse mesmo mês, e o contrário também vale.

## Detalhes técnicos
- Todo o trabalho fica em `src/components/financeiro/PrevisibilidadeFase2.tsx` e `src/pages/financeiro/Previsibilidade.tsx`.
- A lista de meses sai de `useRecebiveisPrevistos`: o primeiro é o mês atual e o último é o maior `data_recebimento_prevista`.
- O valor de cada dia do Calendário passa a ser a soma de `valor_liquido` dos recebíveis agrupados por `data_recebimento_prevista`, a mesma fonte usada no detalhe do dia. `fn_previsibilidade_dia_a_dia` continua sendo usada só para dizer se o dia é útil.
- O mês selecionado fica num estado compartilhado na página, passado como prop para as duas abas.
- Não mexe no banco, nas cobranças, nas vendas, nas flags nem nos Planos 1 e 2.
