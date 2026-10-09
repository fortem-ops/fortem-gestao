# Rosane (e outros 3) aparecem com plano inativo mesmo com contrato ativo

## O que encontrei nos dados

Rosane Baur tem um contrato ativo (Start+, 11/09/2026 a 11/09/2027, renovação automática). Mas o plano ligado a esse contrato está **desligado**. No lugar dele ficou ativo um **registro duplicado** do Start+, sem data de fim, sem renovação automática e com início em **20/02/2025**. Pela duração de 12 meses, esse registro venceu em 02/2026, por isso o sistema mostra Rosane como "Inativo".

Pelo histórico:
- **18/09, 16:29**: na mesma operação do cadastro dela, o plano verdadeiro foi desligado e o registro duplicado foi criado (com início em 11/09).
- **23/09, 11:13**: o início do registro duplicado foi alterado para 20/02/2025. Isso bate com a edição da data na trajetória do aluno. Essa edição altera o plano mais antigo, que por acaso era o duplicado.

**Outros alunos no mesmo caso** (contrato ativo, plano do contrato desligado, um registro duplicado ativo sem data de fim):

| Aluno | Plano do contrato (fim) | Registro duplicado ativo |
|---|---|---|
| Rosane Baur | Start+ até 11/09/2027 | Início 20/02/2025, já vencido, por isso aparece Inativo |
| Pedro Hoerlle de Oliveira | Power até 21/08/2027 | Início 18/11/2022, já vencido, por isso aparece Inativo |
| Lisheng Zheng | Start+ até 10/09/2027 | Início 10/09/2026, ainda aparece Ativo, mas sem fim nem renovação |
| Rosane da Silva Barbosa | Start+ até 17/08/2027 | Início 17/08/2026, ainda aparece Ativo, mas sem fim nem renovação |

Não achei no código atual o trecho que desliga o plano e cria a cópia. Pode ter vindo de uma versão antiga da edição do aluno, mas a causa exata ainda não está confirmada.

## O que fazer

1. **Corrigir os 4 alunos (só dados):**
   - Religar o plano ligado ao contrato ativo, com as datas originais.
   - Desligar o registro duplicado.
   - Nenhum contrato, cobrança ou crédito é alterado. Os créditos do plano desligados em 18/09 são religados só se pertencerem ao plano verdadeiro.
2. **Achar a origem da cópia:**
   - Ver o histórico do mesmo usuário nesses quatro horários (17/08, 17/09, 18/09).
   - Reproduzir a edição do cadastro do aluno para identificar qual tela gera a cópia.
   - Corrigir essa tela para nunca desligar o plano do contrato.
3. **Proteção extra:** a edição da data de início na trajetória do aluno não deve mexer em um plano ativo ligado a contrato. A data passa a ser gravada só quando o registro não for o plano em vigor.
4. **Conferir:** abrir os 4 perfis e confirmar o status "Ativo" e o plano correto na aba Plano.

## Detalhes técnicos

- Planos a religar: 3ba6d778 (Rosane B.), c708e870 (Pedro), 5ce41442 (Lisheng), c9e4e457 (Rosane S.B.).
- Planos duplicados a desligar: 8fa68214, 09a749a5, 84a750d5, e83f2b60.
- Correção feita com UPDATE pontual por id, sem mudar a estrutura do banco.
- O critério de detecção (contrato ativo cujo `plano_id` está com `ativo=false`) vira uma consulta de verificação, para a lista ser rodada de novo depois.
