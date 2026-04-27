## Objetivo

Atualizar o PDF exportado em **Treinos** com duas mudanças:

1. **Mover "Observações"** do rodapé para o topo (entre nome do aluno e Aquecimento).
2. **Limpar visualmente as tabelas de Treino**: remover colunas/cabeçalhos `#` e `EXERCÍCIO` (e os rótulos `BLOCO A`/`BLOCO B`), mantendo apenas `SÉRIES`, `REP` e `KG`.

Tudo continua em **uma única página A4 retrato, sem sobreposições**.

## Layout final

```text
┌────────────────────────────────────────────────────────────┐
│ FORTEM   [QR]                          ALUNO: NOME         │
│                                        Descrição · data    │
├────────────────────────────────────────────────────────────┤
│ OBSERVAÇÕES (anotações manuais)            <- NOVO TOPO    │
│ _____________________________________________              │
│ _____________________________________________  (5 linhas)  │
│ _____________________________________________              │
├────────────────────────────────────────────────────────────┤
│ AQUECIMENTO  · Liberação · Mobilidade · Ativação           │
│ [LIB] tabela ...                                           │
│ [MOB] tabela ...                                           │
│ [ATI] tabela ...                                           │
├────────────────────────────────────────────────────────────┤
│ TREINO 1  · FORÇA                                          │
│   Nome do exercício            SÉRIES   REP   KG           │
│   Nome do exercício            SÉRIES   REP   KG           │
│   ...                                                      │
│ TREINO 2 / 3 / 4                                           │
├────────────────────────────────────────────────────────────┤
│ FORTEM Treinamento — gerado automaticamente   data         │
└────────────────────────────────────────────────────────────┘
                       (Coluna Frequência permanece à direita)
```

## Mudanças no código

Arquivo único: **`src/components/student/workout/exportWorkoutPDF.ts`**

### 1. Observações no topo
- **Remover** o bloco `OBSERVAÇÕES` desenhado no fim da função.
- **Renderizar Observações imediatamente após o cabeçalho** (após `y = margin + headerH + 3;`):
  - Título **"OBSERVAÇÕES"** + sublinha vermelha (mesmo estilo atual).
  - **5 linhas horizontais** equiespaçadas (5 mm entre linhas), totalizando ~31 mm.
  - Avançar `y` para o início do Aquecimento com gap de ~2 mm.
- **Recalcular o budget de página única**:
  - `bodyBottom = pageH - margin - footerReserve` (não desconta mais o bloco de observações).
  - `bodyTop` passa a ser o `y` após Observações; o `scale` adaptativo continua impedindo overflow para uma 2ª página.

### 2. Tabelas de Treino (Força) mais limpas
Na função `renderForcaBlock`:
- **Remover o badge `BLOCO A` / `BLOCO B`** e o subtítulo `(2 exercícios)` / `(3 exercícios)` — deixar de desenhar esse bloco visual antes da tabela.
- **Remover, do `head` da tabela, as colunas `#` e `EXERCÍCIO`** (deixando o cabeçalho como `CAT  SÉRIES  REP  KG`).
- **Manter o nome do exercício na linha** — apenas o cabeçalho "EXERCÍCIO" é removido; a coluna do nome continua existindo (sem rótulo no topo) para que o aluno saiba o que executar.
- **Remover a coluna `#`** (numeração) por completo — sem cabeçalho e sem dados.
- Recalibrar `columnStyles` para distribuir a largura entre `CAT` (estreita), `EXERCÍCIO sem header` (larga), `SÉRIES`, `REP`, `KG`.
- Renomear cabeçalhos visíveis: `SÉRIES`, `REP`, `KG` (já presentes hoje).
- **Aquecimento permanece igual** (mantém `T1..T4` e numeração interna do bloco) — a remoção pedida vale só para os blocos de Força/Treino.
- Ajustar as constantes nominais usadas no cálculo de altura (`NOM_BADGE`, `forcaBlocosTotal` etc.) para refletir que os badges `BLOCO A/B` deixaram de existir, garantindo que o `scale` continue cabendo tudo na página.

### 3. Sem alterações
- Cabeçalho FORTEM + QR + dados do aluno.
- Coluna lateral **Frequência** (T1..T4 por semana).
- Blocos de **Aquecimento** (LIB/MOB/ATI) — mantêm numeração e cabeçalhos atuais.
- Rodapé.

## Critérios de aceite

- [ ] PDF tem **Observações no topo**, entre nome do aluno e Aquecimento.
- [ ] Tabelas de Treino **não exibem** mais `#`, `EXERCÍCIO`, `BLOCO A`, `BLOCO B`.
- [ ] Tabelas de Treino **mantêm** `SÉRIES`, `REP`, `KG` (e o nome do exercício na linha).
- [ ] Aquecimento permanece com seu layout atual (LIB/MOB/ATI + T1..T4).
- [ ] Continua em **uma única página**, sem sobreposições e sem colidir com a coluna Frequência.
