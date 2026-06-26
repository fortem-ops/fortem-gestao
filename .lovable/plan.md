# Correção: duplicação na venda e créditos não exibidos

## Diagnóstico

Cada venda de plano hoje cria **dois registros em `planos`**:

1. O trigger `fn_processar_venda` (BEFORE INSERT em `vendas`) insere o plano com `servicos: []` e seta `NEW.plano_id`.
2. `sincronizarPlano` em `VendaDialog.tsx` insere um **segundo** plano com `servicos: ["1 Avaliação Funcional", ...]` preenchido.

O `contrato`/`venda` aponta para o plano #1 (vazio), então:
- "Plano Contratado → Créditos de Serviços" não mostra Avaliação Funcional, pois lê de `planos.servicos` do plano linkado (vazio).
- A aba mostra duas linhas em `planos` ativos do mesmo aluno (origem da duplicidade percebida).

Em `creditos_aluno` a duplicidade vem de dois pontos:
- O trigger possui um bloco "Bônus Start+: 1 Avaliação Funcional" hard-coded que insere automaticamente.
- A etapa "Serviços do Plano" do dialog selecionaria os mesmos créditos (Start+ default = 1 AF) — hoje só é gravada na recorrência cartão online via `sincronizarPlano` no plano errado; em vendas tradicionais o `criarCreditosServicos` insere os créditos da etapa também. Quando os dois caminhos passam a coexistir (ex.: futura execução da RPC pós-cobrança), AF aparece duas vezes. Já hoje, vendas antigas deixam `creditos_aluno.ativo=true` e somam-se aos novos.

Além disso, `fn_processar_venda` desativa **todos** os planos ativos do aluno, ignorando o seletor "Renovação / Novo contrato / Substituir" do UI.

## Mudanças

### 1. Migration — `fn_processar_venda`

- Continuar criando o registro em `planos` (necessário para `NEW.plano_id` e FKs), com `servicos: []`, `ativo=true`, datas do catálogo — mas **sem** desativar planos anteriores.
- Remover o bloco "Bônus Start+ → Avaliação Funcional" (passa a ser responsabilidade do frontend, que já lê `getRegrasServicosPorPlano`).
- Manter inserção do crédito de **Treino** + movimento de compra.

### 2. `src/components/student/venda/VendaDialog.tsx`

- Substituir `sincronizarPlano` por `atualizarPlanoDaVenda`: faz `UPDATE` no `vendas.plano_id` recém-criado preenchendo `tipo`, `valor`, `data_inicio`, `data_fim`, `duracao_meses`, `servicos`, `renovacao_automatica`, `forma_pagamento_padrao`, `parcelas_padrao`. Sem `INSERT` novo em `planos`.
- Respeitar `modo`:
  - `substituir` (ou ausência de plano vigente): desativar (`ativo=false`, `data_fim = hoje`) os outros planos ativos do aluno, exceto o novo `plano_id`. Desativar também os `creditos_aluno` (`ativo=false`) com `origem_tipo='plano'` cujo plano foi desativado, para limpar a tabela "Serviços e Créditos Contratados".
  - `renovacao` / `adicional`: não tocar nos planos vigentes nem nos créditos antigos.
- Chamar `criarCreditosServicos(servicosInclusos)` sempre que `hasServicos`, inclusive para `recorrencia` (hoje só roda em `tradicional`). Como o trigger não cria mais o bônus, não há duplicação.

### 3. Dados existentes (sem migração destrutiva)

Sem backfill automático. Para a Marilza, a tela vai estabilizar na próxima venda; se preferir, fazemos limpeza pontual depois.

## Fora de escopo

- `fn_criar_contrato_recorrencia`, `trg_auto_criar_contrato_ciclo`, edge functions Rede.
- Aba Pagamentos e tabela `contratos`.
- Visual/UX da aba Plano/Serviços.
