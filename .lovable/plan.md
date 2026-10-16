# Previsibilidade: Total (1 ano), cartões clicáveis e projeção de vendas

## 1. Novo cartão "Total (1 ano)"
- Soma o que será cobrado nos próximos 365 dias, já sem a taxa. A regra é a mesma dos cartões de 30, 60 e 90 dias.

## 2. Clicar nos cartões
- Os cartões "A receber este mês", "Próximos 30/60/90 dias", "Total (1 ano)" e "Em atraso" ficam clicáveis.
- Ao clicar, abre uma janela com a lista do período: aluno, data, descrição, origem, marca "Já cobrado" e valor líquido.
- A janela traz o total, que fecha com o número do cartão, e um botão para exportar.

## 3. Botão "Projeção de vendas"
Fica desligado por padrão. Quando você liga, os cartões e o gráfico somam a projeção, que aparece separada numa cor própria e com a marca "Projeção". O valor certo e o projetado nunca se misturam sem a marca.

A projeção soma duas partes:
- **Renovações:** contratos que vencem nos próximos 12 meses e ainda não têm renovação lançada.
  - Taxa de renovação: dos contratos que venceram nos últimos 12 meses, a parte cujo aluno fez um novo contrato até 30 dias depois.
  - Valor de cada renovação: valor mensal do contrato × taxa de renovação, a partir do mês seguinte ao vencimento, até completar 12 meses.
- **Vendas novas:** média mensal das vendas pagas a alunos novos nos últimos 12 meses, repetida em cada mês futuro.

Embaixo do botão aparece a memória do cálculo, por exemplo: "Taxa de renovação 68% · Média de vendas novas R$ X/mês".

## Antes de construir
Vou conferir no banco se dá para medir com segurança a taxa de renovação e as vendas a alunos novos, com o histórico que existe hoje. Se algum dado faltar ou estiver incoerente, eu te mostro os números antes de ligar a projeção.

## Detalhes técnicos
- `fn_previsibilidade_kpis` ganha `proximos_365_liquido`, filtrado por `data_vencimento`.
- A lista de cada cartão é filtrada no cliente a partir de `useRecebiveisPrevistos`, usando o mesmo critério de data da função: vencimento para 30/60/90/365 e atraso, recebimento para "este mês".
- Nova função `fn_previsibilidade_projecao()`, só de leitura, que devolve por mês: `renovacao_liquido`, `vendas_novas_liquido`, `taxa_renovacao`, `media_vendas_novas`. Ela ignora gympass/wellhub/totalpass/outro e `teste_2027`.
- O estado do botão fica só na tela, não é salvo.
- Teste: um contrato de R$ 400/mês, com taxa de 50%, gera R$ 200/mês de projeção depois do vencimento.
- Rollback das funções recriadas. Não altera cobranças, vendas, flags nem os Planos 1 e 2.
