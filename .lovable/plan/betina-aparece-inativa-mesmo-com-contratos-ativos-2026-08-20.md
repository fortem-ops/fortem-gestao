# Betina aparece inativa mesmo com contratos ativos

## O que aconteceu (confirmado nos dados)

A aluna Betina Schneider de Lima tem **3 contratos ativos** (Start+ até 27/01/2027, Corrida 18/08→02/09/2026 e Corrida 02/09/2026→02/09/2027), mas **nenhum plano ativo** — por isso o status mostra "Inativo" e a aba Plano/Serviços aparece zerada (ela lê `planos` com `ativo = true`).

O histórico de auditoria mostra dois planos sendo desligados no mesmo instante (20/08 13:45:24), logo após o cancelamento de um contrato antigo (13:45:21). A causa é a rescisão de contrato em `src/pages/alunos/ContratoFinanceiro.tsx`: ao cancelar **um** contrato, o espelhamento no plano roda um update filtrado apenas por `aluno_id` + `ativo = true`, ou seja, **desativa todos os planos ativos do aluno**, inclusive os de outros contratos, e ainda sobrescreve a `data_fim` deles com a data do cancelamento. O mesmo padrão já tinha ocorrido em 19/08 12:07 com outros dois planos dela.

## Correção

1. **Escopar o espelhamento ao contrato cancelado** (`ContratoFinanceiro.tsx`): atualizar apenas o plano vinculado ao contrato (`contrato.plano_id`), nunca todos os planos do aluno. Se o contrato não tiver `plano_id`, não mexer em plano nenhum.
2. **Reparar os dados da Betina** (migração pontual): reativar os planos que têm contrato ativo e restaurar suas datas de fim originais:
   - Start+ (início 27/01/2026) → ativo, fim 27/01/2027
   - Corrida Start+ (18/08/2026) → ativo, fim 02/09/2026
   - Corrida Start+ (renovação antecipada, 02/09/2026) → ativo, fim 02/09/2027
   Os planos de contratos já cancelados permanecem inativos.
3. **Verificar outros alunos atingidos pelo mesmo bug**: consultar alunos que tenham contrato ativo sem nenhum plano ativo e listar os casos. Se houver poucos, corrigir junto na mesma migração; se houver muitos, apresento a lista antes de alterar.

## Detalhes técnicos

- Arquivo alterado: `src/pages/alunos/ContratoFinanceiro.tsx`, bloco "Espelha no plano" da função de rescisão — trocar `.eq("aluno_id", alunoId).eq("ativo", true)` por `.eq("id", alvo.plano_id)`.
- Correção de dados via migração (UPDATE em `planos` por id), sem alterar schema.
- Nenhuma mudança na lógica de status (`studentStatus.ts`): ela já está correta, o problema era o dado.
