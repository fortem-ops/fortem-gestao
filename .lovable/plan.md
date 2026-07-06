Relatório de investigação + desenho da aba de mobilidade. Sem código aplicado.

## 1. Já existe painel interno de pendências?

**Sim, dois candidatos — o certo é `/comissionamentos`.**

**`/comissionamentos` (`src/pages/Comissionamentos.tsx`, hook `useComissaoPendencias`)**
- Lê da tabela `comissionamento_pendencias`.
- Alimentada automaticamente por trigger (`supabase/migrations/20260706072104_...sql`) toda vez que uma avaliação `funcional_v2` é inserida ou atualizada:
  - Se faltam métricas OU falta força → cria/mantém pendência `concluir_avaliacao_funcional` com descrição já falando "avaliação funcional v2" e vinculada à `avaliacao_id`.
  - Quando ambos preenchem → a pendência é marcada `concluido = true` automaticamente (é o próprio trigger de "comissão liberada" que já implementamos nesta sessão).
- Escopada por `profissional_id`, com filtros já existentes.
- **Conclusão:** o "aguardando força / aguardando mobilidade" já é rastreado ali sem retrabalho. Só precisaria (opcionalmente) refinar a `descricao` do trigger para dizer *qual dos dois lados* está faltando ("aguardando força", "aguardando mobilidade", "aguardando ambos") — hoje o texto é genérico.

**`/tarefas` (`src/pages/TaskCenter.tsx`)**
- Tabela `tarefas` (com `automatica`/`tipo_auto`), aba "Automáticas", mais focada em ações comerciais (`gravar_video`, etc.). Não conversa com `comissionamento_pendencias`. Encaixar avaliação incompleta aqui exigiria inventar um `tipo_auto` novo e sincronizar via trigger — retrabalho desnecessário quando `comissionamento_pendencias` já resolve.

**Recomendação:** usar `/comissionamentos` como destino da informação "avaliação v2 incompleta". Zero linha de código no lado da UI se aceitarmos o texto genérico atual da pendência; **1 migration curta** se quisermos que a descrição diga exatamente qual metade falta.

## 2. Refatoração do chip em `PremiumBodyMap.tsx`

Hoje (`PremiumBodyMap.tsx:37-41`):
```text
"Aguardando força — comissão não liberada"
"Aguardando mobilidade/flexibilidade — comissão não liberada"
```

Aluno enxerga esse componente na `/avaliacoes-premium`. Referência a comissão nunca deveria aparecer pra ele.

**Proposta (só troca de texto, mesma lógica):**
```text
"Avaliação incompleta — força pendente"
"Avaliação incompleta — mobilidade/flexibilidade pendente"
```
A informação "comissão não liberada" some do cliente e continua visível pra equipe em `/comissionamentos`.

## 3. Nova aba "Mobilidade" na `/avaliacoes-premium`

### Arquitetura

Novo arquivo: `src/components/avaliacoes-premium/tabs/MobilidadeTab.tsx`.
Adicionar `<TabsTrigger value="mobilidade">Mobilidade</TabsTrigger>` em `AvaliacoesPremium.tsx` entre "Força" e "Composição".

### Reaproveitamento

A tabela de métricas de `FuncionalV2Assessment.tsx` (linhas 186-228, `ALL_FUNCTIONAL_METRICS` iterando com `<Input>` de esquerda/direita e classificação via `classifyAngle`) é o único bloco que a nova aba precisa. Extrair essa tabela para um componente puro reutilizável — nome sugerido `MobilidadeMetricsTable`, arquivo em `src/components/student/assessment/funcionalV2/MobilidadeMetricsTable.tsx` — com props `{ values, onChange, readOnly? }`. `FuncionalV2Assessment.tsx` passa a consumir esse mesmo componente (sem mudança de comportamento). `MobilidadeTab.tsx` também.

Sem duplicação de lógica; `classifyAngle`, `ALL_FUNCTIONAL_METRICS` e `analyze()` continuam onde estão em `bodyMapLogic.ts` e `mock-data.ts`.

### Fluxo de salvar (espelho do Kinology)

Igual ao que já fizemos em `src/lib/kinologyImport.ts` para força, só que ao contrário:

```text
1. usuário digita as métricas na nova aba e clica "Salvar mobilidade"
2. buscar avaliação funcional_v2 mais recente do aluno que tenha `dados.forca.exercicios.length > 0`
   MAS `dados.metricas` ausente/vazio  → "aguardando mobilidade"
3a. se encontrar essa linha → UPDATE em `dados.metricas` (mescla, mantém forca)
    → trigger de comissão libera automaticamente
3b. se NÃO encontrar → INSERT nova linha funcional_v2 com só métricas
    (usuário verá aparecer chip "força pendente" no PremiumBodyMap até completar)
4. invalidar as mesmas queries do PremiumKinologyImport
   (`aluno-avaliacoes-consolidadas`, `avaliacoes-aluno`, `avaliacoes-global`)
```

Simetria exata com `findFuncionalV2AguardandoForca` / `PremiumKinologyImport.handleFile`. Nome sugerido para o helper: `findFuncionalV2AguardandoMobilidade(alunoId)` em `src/lib/mobilidadeSave.ts` (ou juntar num `funcionalV2Save.ts` que exporta os dois helpers).

**Resposta à pergunta 4c/b/a:** deve seguir **(b)** — tentar completar linha existente e só criar nova se não houver espera. Mesma regra do Kinology, mesmo trigger, mesma UX de "libera comissão automaticamente quando fecha o par".

### Cálculo de scores

Ao inserir/atualizar, o backend não recalcula scores no trigger — a UI premium recalcula tudo em runtime via `useAlunoAvaliacoesConsolidadas` + `computePremiumScores` a partir de `dados.metricas` e `dados.forca`. Ou seja, basta gravar `metricas: rows` no mesmo shape que `FuncionalV2Assessment` já usa (linhas 146-155) e as demais métricas premium se atualizam sozinhas.

### Anexos e observações

`AvaliacaoAnexos` e o textarea de observações da `FuncionalV2Assessment` **não** precisam entrar na aba nova nesta iteração — o escopo pedido é "digitar mobilidade/flexibilidade". Podem entrar depois se necessário.

## Riscos

| Risco | Mitigação |
|---|---|
| Extrair `MobilidadeMetricsTable` quebrar `FuncionalV2Assessment` | Refactor puro sem mudar shape das props internas; testar salvando uma avaliação nova pelo formulário antigo depois. |
| Se a linha "aguardando mobilidade" foi criada muito antes (semanas), pode haver múltiplas linhas força-only — precisamos escolher a mais recente | Igual `findFuncionalV2AguardandoForca`: `order data desc limit 10` e pega a primeira sem métricas. |
| UPDATE do `dados` sobrescrever chaves não previstas | Fazer merge no cliente: `{ ...existing.dados, metricas, score...: analyze(...) }` — nunca substituir o objeto inteiro. |
| Chip refatorado ainda ambíguo para aluno | Texto proposto ("Avaliação incompleta — X pendente") deixa claro sem revelar dado interno. |

## Escopo de implementação futura (quando aprovado)

1. `PremiumBodyMap.tsx` — trocar strings do chip (2 linhas).
2. Extrair `MobilidadeMetricsTable` de `FuncionalV2Assessment.tsx` e apontar o formulário antigo pra ela (sem mudança de comportamento).
3. Criar `src/lib/mobilidadeSave.ts` com `findFuncionalV2AguardandoMobilidade(alunoId)` e função de salvar (INSERT vs UPDATE mesclando `metricas`).
4. Criar `src/components/avaliacoes-premium/tabs/MobilidadeTab.tsx` consumindo o item 2 e chamando o item 3.
5. Adicionar `<TabsTrigger value="mobilidade">` em `AvaliacoesPremium.tsx`.
6. (Opcional) Migration ajustando descrição da pendência no trigger para dizer qual metade falta.

Sem nova tabela, sem nova policy, sem nova edge function.

## Perguntas pra você antes de eu propor plano de implementação

- **Chip do PremiumBodyMap**: OK trocar por "Avaliação incompleta — X pendente" e mover "comissão não liberada" só pra `/comissionamentos`? Ou prefere outro texto?
- **Descrição da pendência em `/comissionamentos`**: manter genérica ("Avaliação funcional v2 pendente") ou eu ajusto o trigger para detalhar "força pendente" vs "mobilidade pendente"?
- **Ordem da nova aba** em Avaliações Premium: entre Força e Composição, ou como primeira aba? Nome "Mobilidade" ou "Mobilidade/Flexibilidade"?
- **Escopo da aba nova**: só a tabela de métricas, ou já embutir observações + anexos também?