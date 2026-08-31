# Registro retroativo de aceite de contrato (64 alunos)

## O que a verificação prévia já confirmou (somente leitura, nada foi alterado)

- **Grupo 1 (20 doc_ids):** todos os 20 existem em `contratos_documentos`, todos com `aceite = false` e `data_aceite = null`. Nenhum já aceito, nenhum ausente.
- **Grupo 2 (44 pares):** os 44 contratos existem, o `aluno_id` informado bate com o `aluno_id` do contrato em todos os casos, e **nenhum** deles tem linha em `contratos_documentos` (nem por `contrato_id`, nem por `aluno_id`). Não há risco de duplicação hoje — a checagem será repetida na hora da execução.
- **Distribuição de planos do Grupo 2:** 32 Gympass, 9 Totalpass, 3 Start (todos `forma_pagamento = cartao_recorrencia`, vigência mensal). Templates ativos correspondentes:
  - Gympass → `67e1fc10…` (versão 2, ativo)
  - Totalpass → `84317e7f…` (versão 3, ativo)
  - Start → `5197281a…` (versão 2, ativo)
  Esses são exatamente os IDs que o `TEMPLATE_MAP` de `src/lib/contratosDocumentos.ts` resolve para esses planos, então o documento gerado será idêntico ao do fluxo normal.
- **Regulamento interno:** existe uma única versão ativa (versão 1) — será gravada em `regulamento_versao`.
- **Ponto de atenção:** 1 dos 44 contratos (Gympass) está com `status = cancelado`; os outros 43 estão `ativo`. Confirme se ele deve entrar no lote mesmo assim (a premissa atual é que sim, por ser registro histórico).

## Como a geração vai acontecer (ponto técnico importante)

`gerarDocumentoContrato` roda no navegador e chama `fn_reveal_cpf`, que exige uma sessão de admin/coordenador — não é executável a partir de um script de servidor ou Edge Function. Para gerar os 44 documentos com o mesmo resultado, será criada uma **função temporária no banco** que reproduz fielmente a mesma lógica:

- resolve o mesmo `template_id` por plano (mapa fixo, idêntico ao do código);
- lê os dados do aluno e decifra o CPF pelo mesmo mecanismo do `fn_reveal_cpf` (mesma chave do cofre), sem afrouxar nenhuma permissão para o app;
- preenche as mesmas variáveis (`%NOME%`, `%CPF%`, `%RG%`, `%ENDERECO%`, `%BAIRRO%`, `%CIDADE%`, `%UF%`, `%CEP%`, `%EMAIL%`, `%DATA_NASCIMENTO%`, `%NOME_CONTRATO%`, `%VALOR_FINAL_CONTRATO%`, `%DIA%`, `%MES%`, `%ANO%`) com a mesma formatação (CPF 000.000.000-00, CEP 00000-000, datas dd/MM/yyyy, valor `R$ 0.000,00`) e zera os marcadores de assinatura;
- **`%DIA%/%MES%/%ANO%` usarão a data de aceite histórica informada** (não a data de hoje), por se tratar de importação retroativa — confirme se concorda;
- insere a linha em `contratos_documentos` com `template_versao`, `regulamento_versao`, `variaveis_utilizadas`, e já com `aceite = true`, `data_aceite = <data informada>`, `formato_aceite = 'Aceite registrado — importação de dados históricos'`, `ip_aceite = null`.

Nenhum campo de `contratos` (ou de qualquer outra tabela) é tocado.

## Ordem de execução

1. **Pré-checagem (2 consultas de leitura, sem alteração):**
   - Grupo 1: reconfirmar que os 20 ids seguem com `aceite = false`.
   - Grupo 2: reconfirmar que os 44 contratos seguem sem documento e que o vínculo aluno↔contrato continua igual.
   Qualquer divergência é listada e a linha correspondente é **excluída do lote** (não aborta o resto).
2. **Grupo 1 — 1 UPDATE em lote** (`WHERE id IN (...) AND aceite = false`), com `data_aceite` vindo de uma lista de valores por id. Retorna as linhas afetadas para conferência.
3. **Grupo 2 — 1 execução da função temporária**, que percorre os 44 pares em laço com `BEGIN … EXCEPTION WHEN OTHERS` por item: cada falha (aluno sem CPF, template inexistente, documento criado no meio-tempo) é registrada em uma tabela de resultado com o motivo e o laço segue. Um item com erro **não** desfaz os anteriores.
4. **Remoção da função temporária** logo após o uso.
5. **Conferência final (1 consulta):** total de documentos com `formato_aceite = 'Aceite registrado — importação de dados históricos'`, esperado 64; mais a lista de eventuais falhas.

Total: 2 consultas de pré-checagem + 1 update + 1 rotina em lote + 1 limpeza + 1 conferência.

## Tratamento de erros

- Grupo 1: update idempotente (só afeta linhas ainda pendentes); reexecução não causa efeito duplicado.
- Grupo 2: geração idempotente — antes de inserir, cada item verifica novamente se já existe documento para aquele `contrato_id` e, se existir, é pulado com status `ja_existia`.
- Ao final é apresentada uma tabela item a item: `aluno_id`, `contrato_id`, `status` (`criado` / `ja_existia` / `erro`), motivo do erro quando houver.

## Confirmações antes de executar

1. Incluir o contrato Gympass com status `cancelado`?
2. Usar a data de aceite histórica em `%DIA%/%MES%/%ANO%` do corpo do contrato (em vez da data de hoje)?
