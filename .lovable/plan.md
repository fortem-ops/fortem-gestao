# Plano — Refletir subcategoria editada no PDF (Aquecimento → CAT)

## Contexto

O exportador `exportWorkoutPDF.ts` já imprime `ex.subcategoria` na coluna **CAT** do bloco de Aquecimento (linha 297). O problema atual é que a **subcategoria editada em Banco de Treinos** (gravada em `banco_treinos_escolhas.categoria_override` para linhas LIB/MOB/ATI) **não está sendo aplicada** ao prescrever o treino para o aluno via "Importar do Banco de Treinos". Por isso o PDF sai com a subcategoria padrão do template (ou em branco), em vez da subcategoria escolhida pelo Coordenador/Admin.

## O que muda (visão do usuário)

Quando o professor importa um modelo do Banco de Treinos para um aluno, as **subcategorias de LIB/MOB/ATI** definidas em Banco de Treinos passam a aparecer corretamente:
- Na tela de revisão de prescrição.
- Na coluna **CAT** do PDF do treino do aluno.

Sem nenhuma alteração na aparência do PDF — apenas o texto da coluna CAT do aquecimento passa a refletir a subcategoria editada.

## Como vai funcionar (técnico)

Arquivo único alterado: `src/components/student/workout/ImportFromBankDialog.tsx`.

1. **Trazer `categoria_override` do banco** na query `banco-treinos-escolhas-import`:
   - `select("template_fase, treino_nome, ordem, exercicio_id, categoria_override")`.
   - Atualizar a interface `Escolha`: adicionar `categoria_override: string | null` e tornar `exercicio_id` nullable (já é no schema).

2. **Indexar overrides por linha** em `applyEscolhas`:
   - Construir um segundo mapa `overrideMap: Map<string, string>` com `${treino_nome}|${ordem}` → `categoria_override` (quando presente). Hoje só temos `escolhaMap` para o exercício.
   - Para incluir overrides mesmo quando não há `exercicio_id`, percorrer `escolhas.filter(e => e.template_fase === template.fase)` ao montar `overrideMap`.

3. **Aplicar override no `applyToList`**:
   - Para o aquecimento (`treinoNome === "__aquecimento__"`), se houver `overrideMap.get(key)`, esse valor (string da subcategoria, ex.: "Quadril") substitui `ex.subcategoria` no objeto retornado.
   - Manter o restante intacto (vídeo, exercício escolhido, fallback por nome).
   - O loop precisa rodar mesmo quando não há `link` no banco — hoje a função faz `if (!link) return { ...ex }`. Trocar para sempre aplicar o override de subcategoria, e só os campos de exercício/vídeo dependem de `link`.

## Fora do escopo

- Não altera `exportWorkoutPDF.ts` (já lê `ex.subcategoria`).
- Não altera schema do banco.
- Não altera o editor de Banco de Treinos nem a tela `WorkoutDetail`.
- Não muda a coluna CAT dos blocos de Treinos (apenas Aquecimento).
