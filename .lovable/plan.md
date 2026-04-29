## Objetivo

1. **Corrigir/normalizar dados**: padronizar duas subcategorias do grupo "Força" que estão com erros de digitação herdados.
2. **Melhorar UX do picker** na prescrição (Banco de Treinos): apresentar os exercícios disponíveis **agrupados por subcategoria** dentro do popover, em vez de uma lista plana — facilita o professor encontrar variações quando há muitos exercícios em um mesmo grupo.

## 1. Correção de nomes (banco + código)

Subcategorias afetadas em `Força`:

| Atual (incorreto) | Novo (correto)  | Exercícios | 
|-------------------|-----------------|------------|
| Plioetria         | Pliometria      | 12         |
| Isoiniercial      | Isoinercial     | 6          |

### 1a. Migração de dados (UPDATE)

Atualizar a coluna `grupos` (jsonb) de `exercicios_personalizados` substituindo `subcategoria: "Plioetria"` por `"Pliometria"` e `"Isoiniercial"` por `"Isoinercial"`. Também atualizar `banco_treinos_escolhas.subcategoria_override` se houver linhas com esses valores.

```sql
UPDATE exercicios_personalizados
SET grupos = (
  SELECT jsonb_agg(
    CASE
      WHEN g->>'subcategoria' = 'Plioetria'    THEN jsonb_set(g, '{subcategoria}', '"Pliometria"')
      WHEN g->>'subcategoria' = 'Isoiniercial' THEN jsonb_set(g, '{subcategoria}', '"Isoinercial"')
      ELSE g
    END
  )
  FROM jsonb_array_elements(grupos) g
)
WHERE grupos::text ~ '(Plioetria|Isoiniercial)';

UPDATE banco_treinos_escolhas
SET subcategoria_override = CASE subcategoria_override
  WHEN 'Plioetria' THEN 'Pliometria'
  WHEN 'Isoiniercial' THEN 'Isoinercial'
END
WHERE subcategoria_override IN ('Plioetria','Isoiniercial');
```

### 1b. Atualizar listas no código

- `src/components/student/StudentExerciseBank.tsx` — array `CATEGORIES` → grupo `Força`: trocar `"Plioetria"` por `"Pliometria"` e `"Isoiniercial"` por `"Isoinercial"`.
- `src/lib/exerciseMapping.ts` — `GRUPO_SUBCATEGORIAS["Força"]`: idem.

Nenhuma outra discrepância foi encontrada entre os 54 distintos `subcategoria` da base e as listas em código (validado via query).

## 2. Picker agrupado por subcategoria

Arquivo: `src/pages/BancoTreinos.tsx`, componente `ExercisePicker`.

Hoje o popover lista `filtered` (BankExercise[]) plano. Vamos agrupar.

### Comportamento

- Quando a linha tem **subcategoria definida** (override ou padrão do código): mantém comportamento atual (lista plana, já filtrada por aquela subcategoria).
- Quando o professor escolhe **"— qualquer —"** (subcategoria vazia) ou estamos numa linha de aquecimento sem subcategoria definida: o popover mostra os exercícios candidatos do grupo **agrupados por subcategoria**, com cabeçalho sticky por subcategoria e contador.
- Busca por texto continua funcionando: ao digitar, o agrupamento é mantido mas só subcategorias que tenham match aparecem.

### Estrutura visual (popover, ~320px largura, max-h 64)

```text
┌─ [🔍 Buscar em Força...]            ┐
├─────────────────────────────────────┤
│ Anti-Rotação · 12                   │  ← sticky header, text-[10px] uppercase
│   • Pallof Press                  ▶ │
│   • ...                              │
│ Anti-Hiperextensão · 18              │
│   • ...                              │
│ Dominante de Joelho Simétrico · 15   │
│   ...                                │
└─ [✕ Remover escolha] (se houver)    ┘
```

### Implementação

- Criar `groupedCandidates = useMemo(() => Map<string, BankExercise[]>, ...)` agrupando `filtered` por `grupos[i].subcategoria` (a do grupo alvo). Ordenar subcategorias alfabeticamente; ordenar exercícios por nome dentro de cada uma.
- Renderizar `Array.from(groupedCandidates.entries()).map(([sub, items]) => ...)` com cabeçalho `<div class="sticky top-0 bg-popover px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground border-b">{sub} · {items.length}</div>` e itens reusando o markup atual (botão com nome + ícone de vídeo).
- Habilitar o agrupamento somente quando `subcategoriaOverride` é falsy E há mais de uma subcategoria entre os candidatos; caso contrário, manter o render plano atual.

## 3. Fora de escopo

- Renomear/auditar exercícios individualmente, remover duplicatas ou popular vídeos faltantes (527 ainda sem vídeo) — pode ser tratado em outra rodada.
- Mudar a estrutura da tabela `exercicios_personalizados`.
- Alterar a aba "Banco de Exercícios" do aluno (já organizada por categoria/subcategoria).

## Arquivos alterados

- `supabase/migrations/<timestamp>_normalize_forca_subcategorias.sql` (novo) — UPDATEs descritos.
- `src/components/student/StudentExerciseBank.tsx` — ajuste no array `CATEGORIES`.
- `src/lib/exerciseMapping.ts` — ajuste em `GRUPO_SUBCATEGORIAS["Força"]`.
- `src/pages/BancoTreinos.tsx` — agrupamento por subcategoria no `ExercisePicker`.
