# Gympass/Wellhub e Total Pass: início no dia 1, fim no último dia do mês

## O que encontrei (62 planos ativos de plataforma)
- **4 alunos começam fora do dia 1**: Rafaella Fonseca da Silva Sena (03/09), Mauricio Gomes de Queiroz (07/09), Stefano Aita (10/09) e Hector Heinz (19/09). A próxima renovação deles também está errada (dia 03, 07, 10 e 19/10).
- **Data final do plano**: 55 planos estão sem data final e 5 terminam em 01/10 (ex.: Alice Mueller, Denise dos Reis Vieira). Nenhum termina em 30/09.
- **Contratos**: 60 dos 62 terminam em 01/10, e não em 30/09. Os 4 casos acima também têm contrato começando fora do dia 1.

## O que será feito
1. **Todos os 62 planos**: início em 01/09/2026, fim em 30/09/2026 e próxima renovação em 01/10/2026.
2. **Contratos vigentes desses planos**: de 01/09/2026 a 30/09/2026.
3. **Daqui em diante**:
   - Na venda de Gympass/Wellhub e Total Pass, o fim passa a ser o último dia do mês. O início no dia 1 já existe.
   - Na renovação automática do dia 1, cada novo mês desses planos também vai do dia 1 ao último dia do mês (ex.: 01/10 a 31/10).
   - A desativação diária de planos vencidos não pega esses planos, porque eles têm renovação automática.
4. Conferir no banco e no perfil de um aluno.

## O que NÃO muda
- Nenhum valor e nenhuma cobrança (esses planos são R$ 0,00). Os outros planos continuam como estão.

## Detalhes técnicos
- Regularização por SQL: `planos` com tipo ~* gympass|wellhub|total pass e ativo → data_inicio = date_trunc('month', data_inicio), data_fim = último dia desse mês, proxima_renovacao = dia 1 do mês seguinte. `contratos` ativos/suspensos/inadimplentes desses planos → mesmas datas.
- `VendaDialog.tsx`: ramo agregadora envia data_fim = último dia do mês.
- `renovar-planos-mensais` e `fn_auto_criar_contrato_ciclo`: para agregadora, ciclo = dia 1 até o último dia do mês; próxima renovação = dia 1 do mês seguinte. Deploy da função.
- A exibição de "Cancelamento agendado" no perfil deve ignorar data_fim em planos de plataforma com renovação automática (conferir antes de gravar data_fim).
