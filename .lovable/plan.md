# Corrigir "Não foi possível consultar os créditos" na Agenda de Treinos

## Causa (confirmada)
Ao selecionar um aluno em "Incluir aluno", o banco responde com erro: a consulta tenta ler a frequência semanal no registro do plano, mas essa informação não existe ali — ela fica no contrato. Toda consulta falha, para qualquer aluno. A mesma leitura errada existe na inclusão do aluno no horário, então incluir também falharia.

## O que muda
- O saldo volta a aparecer ao selecionar o aluno (créditos restantes, Plano Livre ou Agregadora).
- O botão de incluir passa a funcionar com a mesma regra.
- Nada muda na tela nem nas regras de permissão.

## Detalhes técnicos
- Nova migration recriando `fn_saldo_creditos_treino_aluno` e `fn_agendar_treino_equipe`, removendo `_plano.frequencia_semanal` (coluna inexistente em `planos`) e identificando Plano Livre só por `contratos.frequencia_semanal = 5` em contrato ativo e vigente.
- Teste de regressão em `src/test/` garantindo que as funções não referenciam `_plano.frequencia_semanal`; ensaio SQL revertido chamando as duas funções como coordenador com aluno de créditos, livre e agregadora.
- Rodar `bunx vitest run` e eslint; conferir na prévia.
