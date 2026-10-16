# Recebíveis de outubro: incluir o que já foi pago no mês

## Por que outubro parece errado
A lista de Recebíveis só mostra o que **ainda falta receber**. Nos meses futuros nada foi pago ainda, então aparece tudo. Outubro já está na metade, então tudo o que foi pago de 1 a 16/10 saiu da lista:
- Já pagas em outubro: 74 cobranças, cerca de R$ 35.973.
- Ainda a receber com vencimento em outubro: 34 cobranças pendentes, cerca de R$ 14.182, mais 3 serviços.
- Há também 63 cobranças de outubro marcadas como "atrasado" com valor R$ 0,00. Por isso elas não entram em nenhum total, e vou listá-las para você conferir.

## O que muda
1. Em Recebíveis, entra a chave **"Incluir já recebidos"**, ligada por padrão.
2. Com a chave ligada, as cobranças, as parcelas de serviço e as parcelas de cartão já pagas no mês aparecem com a marca **"Recebido"**, na data em que foram pagas ou caíram na conta.
3. O botão **Outubro/26** passa a mostrar o mês inteiro, separado em recebido e a receber, por exemplo "R$ 50,2 mil · R$ 36,0 mil recebido".
4. Com a chave desligada, a tela volta a ser como hoje, só com o que falta.
5. Os cartões "Próximos 30/60/90 dias", "Total (1 ano)", o Calendário e a projeção não mudam.

## Detalhes técnicos
- Nova view somente leitura `vw_recebidos_periodo`: cobranças `status='pago'` (mesmos filtros de contrato/plano/teste da view de mensalidades, taxa pela mesma regra), parcelas de cartão parcelado já passadas (a parte de `vw_recebiveis_previstos_cartao_parcelado` com data anterior a hoje) e parcelas de serviço pagas, com `recebido=true`. Período: a partir do 1º dia do mês atual. Permissões iguais às das views atuais.
- Novo hook `useRecebidosMes` em `usePrevisibilidade.ts`. `RecebiveisList` junta as duas listas quando a chave está ligada. `useMesesFuturos` soma recebido e a receber separados.
- Mostrar as 63 cobranças "atrasado" com R$ 0,00 só para conferência, sem alterar nada.
- Sem mudanças em cobranças, vendas, flags ou nos Planos 1 e 2.
