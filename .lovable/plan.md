# Recebíveis de outubro: mostrar por data de cobrança ou de recebimento

## Por que outubro aparece quase vazio
Os botões de mês filtram pela **data em que o dinheiro cai na conta**. As cobranças no cartão que vencem em outubro só caem cerca de 30 dias depois (prazo da Rede):
- Vencem em outubro: 41 cobranças, cerca de R$ 15.402 líquidos.
- Caem na conta em outubro: só 5, cerca de R$ 1.058 (a maioria cai em novembro).

Nada está faltando no sistema: os valores estão em Novembro/26.

## O que muda
1. Na aba Recebíveis, ao lado dos botões de mês, entra a escolha **"Ver por: Vencimento | Recebimento"**. O padrão é **Vencimento**, que bate com os cartões "Próximos 30/60/90 dias".
2. Os botões de mês, os totais de cada mês, os campos De/Até e o total da lista seguem a escolha.
3. A lista mostra as duas datas (vencimento e recebimento), como hoje.
4. O Calendário continua mostrando quando o dinheiro cai na conta, com um aviso curto explicando isso.

## Detalhes técnicos
- Só em `src/components/financeiro/PrevisibilidadeFase2.tsx`: `useMesesFuturos` e o filtro De/Até passam a usar `data_vencimento` ou `data_recebimento_prevista` conforme a escolha. Parcelas "Já cobrado" usam a data da parcela nos dois modos.
- Sem mudanças no banco, nas cobranças, nas vendas, nas flags ou nos Planos 1 e 2.
