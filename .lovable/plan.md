## Ajuste — Comissionamento de Carteira

Alterar a regra de apuração mensal da carteira (R$ 5/aluno quando total global ≥ 150) para usar o **Professor Responsável** definido em `alunos.responsavel_id` (Carteira de Alunos), em vez do profissional de agendamento.

### Regra de elegibilidade do aluno
Conta no total apenas quando **todas** as condições forem verdadeiras:
- `alunos.status = 'ativo'`
- Possui `responsavel_id` definido (professor responsável da carteira)
- Possui plano ativo (`student_plans.ativo = true`) **que NÃO seja agregador** — excluir planos cujo nome/categoria seja Gympass, Wellhub, Total Pass (e similares marcados como agregador)
- **Não está em licença vigente** — sem registro em `aluno_licencas` com `data_inicio <= hoje <= data_fim`
- Possui venda paga vinculada (`vendas.status_pagamento = 'pago'`)

### Apuração
1. Filtra alunos elegíveis pelos critérios acima.
2. Soma global → se **≥ 150**, dispara comissão.
3. Agrupa por `alunos.responsavel_id` (não mais por profissional do agendamento).
4. Para cada responsável com ≥ 1 aluno elegível: cria registro em `comissionamentos`
   - `tipo = 'carteira_ativa'`
   - `profissional_id = responsavel_id`
   - `valor = qtd_alunos_do_responsavel × 5`
   - `data_referencia = primeiro dia do mês de referência`
   - `descricao = "Carteira ativa <mês/ano> — N alunos"`

### Mudanças técnicas
- **`fn_processar_comissao_carteira`** (migration): reescrever query usando `alunos.responsavel_id`, com JOIN/EXISTS em `student_plans` (ativo, não agregador), `vendas` (pago) e NOT EXISTS em `aluno_licencas` vigente.
- Identificar "plano agregador" via flag/coluna existente em `student_plans`/`planos` — verificar schema durante implementação; se não houver flag, usar lista de nomes (`ILIKE` em Gympass, Wellhub, Total Pass).
- **Frontend `Comissionamentos.tsx` (aba Carteira / Dashboard)**: atualizar contagem da meta e ranking para usar `responsavel_id` aplicando os mesmos filtros, garantindo que o preview da meta bata com a apuração do backend.
- **Hook `useCarteiraMeta`**: ajustar query Supabase com os mesmos critérios.
- Edge function `comissionar-carteira-mensal` permanece igual (só chama a função SQL atualizada).

### Sem mudanças
- Regras de Treino Experimental e Avaliação Funcional permanecem inalteradas (continuam usando `agenda_servicos.profissional_id`).
- Estrutura de tabelas, status e fluxo de aprovação não mudam.
