
## 1. Mover "Histórico de Vendas" para a aba Pagamentos

**`src/components/student/StudentPlan.tsx`**
- Remover o `<HistoricoVendas alunoId={student.id} />` dos dois retornos (caso "sem plano" e retorno principal).
- Remover o import `HistoricoVendas` se ficar sem uso.

**`src/pages/alunos/ContratoFinanceiro.tsx`**
- Importar `HistoricoVendas` de `@/components/student/venda/HistoricoVendas`.
- Renderizar `<HistoricoVendas alunoId={alunoId} />` como **última seção** da página, dentro de um card com título **"Histórico de Pagamentos"**.
- Mantém visibilidade tanto quando há contrato quanto quando não há (aluno pode ter vendas avulsas sem contrato ativo).

## 2. Renovação vs Novo contrato no fluxo de venda de plano

Objetivo: ao vender um plano para aluno que já tem plano ativo, o usuário escolhe se a venda **renova/substitui** o vigente ou se é um **contrato adicional/futuro** que mantém o atual intacto.

### Frontend — `src/components/student/venda/VendaDialog.tsx`

**Detecção de plano vigente**: nova query `planoVigente` em `planos` (ativo=true, mais recente) — só roda quando `tab === "planos"` e `open`.

**Novo estado**:
```ts
const [modoContrato, setModoContrato] = useState<"substituir" | "renovacao" | "adicional">("substituir");
```
- `"substituir"` (padrão quando não há plano vigente): comportamento atual.
- `"renovacao"`: novo plano começa **após o término do vigente** (sugere `data_inicio = data_fim do vigente + 1 dia`); vigente permanece `ativo=true` até a data de término natural.
- `"adicional"`: novo contrato independente, data de início escolhida livremente; vigente permanece intocado.

**UI**: novo bloco na etapa "Resumo" (acima do `PagamentoStep`), só aparece quando existe `planoVigente`. Três `RadioCard`s explicando cada opção, mostrando o plano vigente e sua data de término. Ao escolher "renovacao", `dataInicio` é forçada para o dia seguinte ao fim do vigente.

**`sincronizarPlano`**: deixa de desativar planos anteriores quando `modoContrato !== "substituir"`. Apenas insere o novo registro em `planos` com `ativo=true` e a `data_inicio` correta. Comentário documentando o porquê.

**`StudentPlan.tsx` query `plano_ativo`**: já filtra por `ativo=true` e ordena `created_at desc limit 1`. Para garantir que o aluno continue vendo o plano **em vigência hoje** quando houver um futuro registrado, alterar a ordenação para priorizar registros cuja `data_inicio <= hoje` antes do `created_at desc` (ou filtrar `data_inicio <= today`). Sem isso, o widget mostraria o plano futuro em vez do atual.

**Recorrência + modo "renovacao"/"adicional"**: a RPC `fn_criar_contrato_recorrencia` recebe `p_data_inicio` — basta passar a nova data. O contrato e as 12 cobranças são gerados a partir dela. Nenhuma alteração de banco necessária — múltiplos contratos `ativo` por aluno já são suportados pela tabela `contratos`.

**Cartão online (recorrência)**: a 1ª parcela é cobrada na hora independentemente do modo; as 11 restantes ficam pendentes a partir da nova `data_inicio`. Sem mudança.

### Backend
Nenhuma migração necessária. Apenas validar (read-only) que `contratos` não tem unique constraint impedindo dois contratos ativos para o mesmo aluno.

## 3. Validação
- Abrir um aluno com plano ativo → "Nova venda" → plano → na etapa Resumo aparece o seletor com vigente listado.
- Escolher "Renovação" → data_inicio preenche automaticamente para dia após término do vigente.
- Finalizar → aba Plano/Serviços continua mostrando o plano atual (não o futuro); aba Pagamentos lista o novo contrato no card de contratos e mostra a venda no Histórico de Pagamentos no rodapé.
- Repetir com "Adicional" e confirmar que ambos coexistem.

## Arquivos alterados
- `src/components/student/StudentPlan.tsx` (remoção do histórico + ajuste de ordenação da query)
- `src/components/student/venda/VendaDialog.tsx` (modo contrato + sincronização condicional)
- `src/pages/alunos/ContratoFinanceiro.tsx` (adição do Histórico de Pagamentos no fim)
