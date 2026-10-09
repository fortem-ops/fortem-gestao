# Próxima renovação igual ao término (planos mensais)

## Escopo
- Planos ativos, com renovação automática e ciclo mensal: Start, VIP (todas as variações) e outros planos de 1 mês (ex.: Corrida mensal).
- Fora: Gympass/Wellhub e Total Pass (ficam como estão) e planos anuais/semestrais (Start+, Power, Consultoria 6 meses).

## O que será feito
1. **Conferir a lista** de alunos afetados (nome, início, término e renovação atuais) antes de gravar.
2. **Recalcular pelo início**: término = início + ciclos de 1 mês até a primeira data de hoje em diante; próxima renovação = essa mesma data. Vale também para os 21 planos sem término.
3. **Contrato vigente** de cada plano ajustado para terminar na mesma data, quando estiver diferente.
4. **Daqui em diante**: em novas vendas, renovações automáticas e edição do plano, a próxima renovação dos planos mensais é gravada igual ao término.
5. Conferir no banco e no perfil de um aluno.

## O que NÃO muda
Nenhum valor, nenhuma cobrança gerada ou enviada para a Rede.

## Detalhes técnicos
- Mensal = `planos.duracao_meses = 1` (ou tipo Start/VIP*), excluindo tipo ~* gympass|wellhub|total pass.
- Ajuste por SQL em `planos` (data_fim, proxima_renovacao) e `contratos` ativos (data_fim).
- Trigger `fn_planos_autorenew_defaults`: para mensais não-agregadora, forçar `proxima_renovacao = data_fim` (preenchendo data_fim pelo ciclo quando nulo).
- `renovar-planos-mensais` (Corrida) e `StudentPlan.tsx` (edição de término) seguem a mesma regra; deploy da função.
- Teste unitário da regra de cálculo da data.
