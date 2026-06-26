## Problema

Ao selecionar **"Novo contrato (adicional)"** em uma nova venda:

1. A data de início está sendo forçada para "dia seguinte ao fim do plano vigente" — o `useEffect` em `VendaDialog.tsx` (linhas 212‑218) hoje só checa `modo === "renovacao"`, mas o estado padrão quando há plano vigente também é `"renovacao"`, e mesmo trocando para `"adicional"` a data fica desalinhada porque nunca volta para "hoje".
2. Em **Pagamentos** (`ContratoFinanceiro.tsx`, linha 94) só é exibido **um** contrato ativo (`contratos.find(c => c.status === "ativo")`), escondendo o contrato adicional recém‑criado.

## Correções

### 1. `src/components/student/venda/VendaDialog.tsx`

- No `useEffect` que ajusta `dataInicio` em função de `modoContrato`:
  - `renovacao` → continua: `fimVigente + 1 dia`.
  - `adicional` → setar `dataInicio` para **hoje** (permitindo override manual pelo usuário).
  - `substituir` → manter hoje (já é o default).
- Garantir que, ao alternar entre os três modos, a data se reajusta corretamente (resetar para hoje quando sair de "renovacao").
- Sem nenhuma outra mudança de lógica de venda.

### 2. `src/pages/alunos/ContratoFinanceiro.tsx`

Refatorar a página para suportar **N contratos ativos simultâneos**:

- Trocar `const ativo = contratos.find(...)` por `const ativos = contratos.filter(c => c.status === 'ativo' || c.status === 'inadimplente' || c.status === 'suspenso')`.
- Ordenar `ativos` por `data_inicio` ascendente — assim o **plano vigente atual aparece em cima** e os **adicionais/renovações futuros aparecem logo abaixo**.
- Extrair o bloco hoje renderizado para o "ativo" em um subcomponente local `ContratoAtivoCard` que recebe `contrato` e renderiza:
  - Cabeçalho (badges, datas, valor mensal, próxima cobrança, créditos do ciclo).
  - Bloco de **Inadimplências** específicas daquele contrato.
  - Tabela de **Cobranças** específicas daquele contrato.
  - Botão de cancelar contrato (mantém RBAC `podeCancelar`).
- Hoje há `useQuery` para `cobrancas`, `ciclo` e `inadimplencias` atrelados a um único `ativo`. Mover essas queries para dentro do subcomponente, indexadas pelo `contrato.id`, para que cada card carregue seus próprios dados.
- Adicionar um pequeno rótulo visual quando houver mais de um contrato ativo:
  - O primeiro (data_inicio mais antiga) recebe badge "Vigente".
  - Os demais recebem badge "Futuro" (data_inicio > hoje) ou "Adicional" (data_inicio ≤ hoje).
- Histórico (contratos não‑ativos) e Histórico de Pagamentos continuam intactos no fim da página.

### 3. Sem alterações de banco / RPC

Nenhuma migração necessária. A RPC `fn_criar_contrato_recorrencia` e o trigger `trg_auto_criar_contrato_ciclo` continuam criando o contrato corretamente; a página passa a apenas **exibir** todos os ativos.

## Validação

- Aluno com plano Start+ vigente → abrir Nova venda → marcar **Novo contrato (adicional)** → data de início deve voltar para **hoje** (editável).
- Após finalizar, a aba **Pagamentos** deve mostrar **dois cards** de contrato ativo, na ordem: vigente em cima, novo logo abaixo, cada um com suas próprias cobranças.
- Alternar para "Renovação" continua deslocando a data para o dia seguinte ao fim do plano atual.
- "Substituir" continua desativando o anterior (volta a um único card ativo).
