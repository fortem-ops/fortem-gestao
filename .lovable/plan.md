## Objetivo

Adicionar, dentro do card **FORÇA** do editor Personalizado, um pequeno painel chamado **"PADRÕES DE MOVIMENTO"** que conta quantas vezes cada categoria (CAT) aparece nos exercícios prescritos — agregando todos os treinos e blocos. Isso ajuda o profissional a equilibrar a prescrição (ex.: garantir presença de DJS, DQ, PH, PV, EH, EV, etc.).

## Onde aparece

- Arquivo: `src/components/student/workout/PersonalizadoEditor.tsx`
- Localização: dentro do card **FORÇA** (`glass-card` que começa em ~linha 724), logo abaixo do header "FORÇA / + Treino" e acima do componente `<Tabs>`.
- O painel é puramente visual/derivado do estado — nada novo persiste no banco.

## Regras de contagem

- Iterar `data.treinos[*].blocos[*].exercicios[*]` e somar por `ex.categoria`.
- **Simples** → conta 1 ocorrência da categoria.
- **Dinâmico** → conta 1 ocorrência da categoria (todas as variantes compartilham a mesma CAT, então não duplica).
- Categorias possíveis: as listadas em `FORCA_CATEGORIAS` (`DJS, DJA, DQ, DQ_P, PH, PV, EH, EV, EP, EEF, EE, AH, AF, AR, PREV, COND`).
- **Modos de visualização** via toggle no canto direito do painel:
  - **Total** (default): soma agregada de todos os treinos.
  - **Por treino**: respeita a aba ativa (`activeTreino`) e mostra apenas os exercícios daquele treino.

## Layout do painel

```text
┌─ PADRÕES DE MOVIMENTO ───────────────── [Total | Treino atual] ┐
│ [DJS 3] [DJA 1] [DQ 2] [PH 2] [PV 1] [EH 2] [EV 0] [EP 1] ...  │
│ Total: 12 exercícios                                            │
└─────────────────────────────────────────────────────────────────┘
```

- Cada CAT vira um `Badge` compacto: `CAT n`.
- Categorias com contagem **0** ficam atenuadas (`opacity-40`) — útil para enxergar lacunas.
- Categorias com contagem **≥ 1** usam `variant="default"` (verde primário).
- `title` (tooltip nativo) com o nome completo via `CATEGORY_LABELS[c]`.
- Rodapé curto com total de exercícios contabilizados.

## Detalhes técnicos

1. Calcular contagens com `useMemo` dependendo de `data.treinos`, `activeTreino` e do modo selecionado.
2. Adicionar estado local `const [padraoMode, setPadraoMode] = useState<"total" | "treino">("total")`.
3. Renderizar o painel apenas quando `data.treinos.length > 0` (mesma condição usada para mostrar as abas).
4. Reutilizar componentes já importados: `Badge`, `ToggleGroup`/`ToggleGroupItem`. Sem novas dependências.
5. Não altera tipos, persistência, PDF, nem auto-save.

## Fora do escopo

- Nenhuma alteração no PDF de exportação.
- Nenhuma mudança em modelos do Banco de Treinos (a estrutura é a mesma; o painel aparece em qualquer uso do `PersonalizadoEditor`, inclusive no banco).
- Sem novas categorias nem renomeações.
