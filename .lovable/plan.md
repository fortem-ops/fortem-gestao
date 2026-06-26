## Diagnóstico

- A venda está sendo criada e o plano fica ativo porque o trigger de vendas cria registro em `planos` e crédito de treino.
- O contrato não aparece em Perfil do Aluno > Contrato porque a RPC `fn_criar_contrato_recorrencia` ainda falha depois da venda, então nada é gravado em `contratos`/`cobrancas`.
- Os créditos adicionais não aparecem porque há incompatibilidade de chaves:
  - Frontend envia `servicos_inclusos` como `{ avaliacao_funcional, nutricao, reabilitacao, definir_depois }`.
  - A RPC lê `consultas_nutricao` e `consultas_reabilitacao`, então recebe zero para Nutrição/Reabilitação.
- Além disso, existe uma versão antiga da RPC sem `p_servicos_inclusos`, que pode causar chamadas ambíguas ou manutenção confusa.

## Plano de correção

1. **Corrigir a RPC de recorrência**
   - Atualizar `fn_criar_contrato_recorrencia` para ler os campos corretos: `nutricao` e `reabilitacao`.
   - Manter compatibilidade aceitando também `consultas_nutricao` e `consultas_reabilitacao` como fallback.
   - Garantir que o contrato use o `plano_id` real do aluno vindo da venda (`vendas.plano_id`), não o ID do catálogo.
   - Preservar as correções já feitas para `plano_tipo`, `frequencia_semanal`, `forma_pagamento` e criação das 12 cobranças.

2. **Remover ambiguidade da função antiga**
   - Eliminar a overload antiga de `fn_criar_contrato_recorrencia` sem `p_servicos_inclusos`, ou substituí-la por wrapper explícito que encaminha para a versão nova com `{}`.
   - Isso evita que chamadas futuras usem a versão sem serviços por engano.

3. **Criar movimentos de crédito para serviços adicionais**
   - Para cada crédito bônus criado pela RPC (Avaliação Funcional, Nutrição, Reabilitação), também registrar o respectivo movimento em `creditos_movimentos`, seguindo o padrão do trigger atual.
   - Isso deixa os créditos consistentes com o restante do sistema.

4. **Ajustar o frontend para cache correto**
   - Corrigir a invalidação de cache do contrato do aluno para bater com o hook atual (`['contratos', alunoId]`).
   - Após venda recorrente pendente, invalidar também cobranças e créditos para a aba Contrato atualizar sem depender de reload.

5. **Validar com os dados reais do aluno atual**
   - Conferir a última venda recorrente do aluno.
   - Verificar que, após a correção, uma nova venda pendente cria:
     - 1 contrato em `contratos`;
     - 12 cobranças em `cobrancas`;
     - créditos de treino + serviços adicionais selecionados em `creditos_aluno`.

## Resultado esperado

- Ao finalizar recorrência como pagamento pendente, a tela não exibirá erro.
- O plano continuará ativo.
- O contrato aparecerá em Perfil do Aluno > Contrato.
- Os serviços adicionais selecionados serão transformados automaticamente em créditos do aluno.