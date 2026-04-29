## Objetivo

Em **Banco de Treinos > Métodos > Personalizado**, deixar a área de prescrição com o mesmo layout das Fases: cada treino fica em sua própria **aba** (Treino 1 | Treino 2 | Treino 3 | Treino 4...), e apenas o treino ativo aparece com seus blocos e exercícios. Hoje todos os treinos ficam empilhados verticalmente, o que polui a tela.

Nenhuma regra atual do Personalizado é alterada — apenas a apresentação dos treinos muda de lista vertical para abas.

## O que fica igual (NÃO MUDAR)

- Adicionar/remover **treinos**
- Adicionar/remover **blocos** dentro de cada treino (Bloco A, B, C...)
- Adicionar **exercícios** dentro de cada bloco, dos dois tipos: **simples** e **dinâmico**
- Edição de nome de treino, nome de bloco, categoria, séries, reps, vídeo, dias
- Aquecimento (LIB/MOB/ATI), Observações, Auto-save (rascunho), Exportação PDF/Imprimir, Salvar modelo / Aplicar a aluno
- Estrutura do dado salvo (`PersonalizadoConteudo`) permanece intacta

## O que muda (apenas visual)

Card "FORÇA" passa a ter:

```text
┌──────────────────────────────────────────────────────┐
│ FORÇA                            [+ Treino]          │
├──────────────────────────────────────────────────────┤
│ [ Treino 1 ] Treino 2  Treino 3  Treino 4   [✎] [🗑] │
├──────────────────────────────────────────────────────┤
│  ↳ apenas o conteúdo do treino ativo:                │
│    Bloco A  [+ Exercício] [🗑]                       │
│      • exercícios...                                 │
│    Bloco B  [+ Exercício] [🗑]                       │
│      • exercícios...                                 │
│                              [+ Bloco]               │
└──────────────────────────────────────────────────────┘
```

Detalhes:

- A `TabsList` lista todos os treinos, com aba ativa controlada por estado local.
- Botão **+ Treino** continua no topo do card; ao adicionar, a nova aba é selecionada automaticamente.
- O nome do treino vira editável **dentro da aba ativa** (input, mesmo componente atual), no topo do conteúdo da aba — junto com os botões **+ Bloco** e **🗑 remover treino**.
- Ao remover o treino ativo, troca-se para a aba anterior.
- Em tela estreita, a `TabsList` quebra com `flex-wrap h-auto` (mesmo padrão de `BancoTreinos.tsx` linha 578).

## Arquivos afetados

**`src/components/student/workout/PersonalizadoEditor.tsx`** (único arquivo editado)

1. Importar `Tabs, TabsContent, TabsList, TabsTrigger` de `@/components/ui/tabs`.
2. Adicionar estado `const [activeTreino, setActiveTreino] = useState<number>(0)`.
3. Em `addTreino`: após inserir, fazer `setActiveTreino(data.treinos.length)`.
4. Em `removeTreino`: ajustar `activeTreino` para não ficar fora do range.
5. Substituir o bloco `data.treinos.map((tr, ti) => ( <div ...> ... </div> ))` (linhas ~719–779) por:
   - Uma `<Tabs value={String(activeTreino)} onValueChange={v => setActiveTreino(Number(v))}>` envolvendo:
     - `<TabsList className="flex-wrap h-auto">` com um `TabsTrigger` por treino (label = `tr.nome`).
     - Um `<TabsContent>` por treino contendo o **mesmo JSX** de hoje (input do nome + botão Bloco + botão remover treino + lista de blocos com seus exercícios). Nada do conteúdo interno é alterado.
6. Manter o botão **+ Treino** no header do card "FORÇA" (já existe).

## Pontos de cuidado

- **Não mudar** a estrutura de `PersonalizadoConteudo` nem o serializador `flattenPersonalizado` — a aba é puramente UI local, não persiste.
- O auto-save (`useEffect` em `data, name`) continua reagindo a qualquer edição dentro da aba ativa, sem mudanças.
- Esta tela não afeta Fases nem outros Métodos (Planilha 5RM, 5-3-1, M102) — esses já usam `TemplateDetail` em `BancoTreinos.tsx`, que já tem abas.
- Não há mudanças de banco, RLS, edge functions ou rotas.

## Validação após implementar

1. Abrir Banco de Treinos > Métodos > **Personalizado** (novo).
2. Conferir que aparece "Treino 1" como aba ativa única.
3. Clicar **+ Treino** → nova aba "Treino 2" criada e ativa.
4. Renomear, adicionar Bloco, adicionar Exercício (simples e dinâmico) na aba ativa — funciona igual.
5. Trocar de aba — conteúdo do outro treino aparece intacto.
6. Salvar como modelo → reabrir → as abas voltam com os mesmos treinos.
