
## Goal
Aumentar a fonte do nome dos exercícios no PDF até que as tabelas se aproximem da área de "Observações", mantendo tudo em **uma única página A4**.

## Análise do estado atual (`exportWorkoutPDF.ts`)

- `ROW_FONT = Math.max(4.8, 6.8 * scale)` → fonte muito pequena (4.8–6.8pt) no corpo das tabelas.
- `scale` varia entre **0.46 e 0.9**, calculado por `availH / totalEst`.
- Como `totalEst` é uma estimativa **conservadora** (margem de segurança grande via `NOM_ROW = 5.2`, `layoutSafety = 10`), o `scale` quase sempre fica abaixo de 1.0 mesmo quando há espaço sobrando.
- Resultado: sobra espaço em branco entre o último Treino 4 e o bloco de Observações, com fonte minúscula.

## Mudanças (apenas `src/components/student/workout/exportWorkoutPDF.ts`)

### 1. Aumentar a fonte mínima e máxima dos nomes de exercícios
- Subir o piso e o teto de `ROW_FONT` para que o nome do exercício fique legível mesmo no pior caso (4 treinos cheios + aquecimento completo + 12 semanas de frequência):
  - `ROW_FONT`: piso **6.5pt**, base **9.0 * scale** (atual 4.8 / 6.8).
  - `HEAD_FONT`: piso **5.5pt**, base **7.0 * scale**.
  - `ROW_PAD`: piso **0.55mm**, base **1.2 * scale** (linhas mais altas acompanham a fonte).
- Manter `overflow: "ellipsize"` para que nomes muito longos não quebrem o layout.

### 2. Permitir `scale` chegar a 1.0+ quando sobra espaço
- Elevar o teto de `scale` de `0.9` para **`1.15`**, para que em treinos com poucos exercícios o conteúdo realmente preencha a página até a área de Observações.
- Manter o piso em `0.46` para garantir caber no pior caso.

### 3. Ajustar nominais para refletir as fontes maiores
- Subir `NOM_ROW` (5.2 → **6.4**) e `NOM_HEAD` (5.0 → **5.8**) para que o estimador continue conservador e nunca empurre conteúdo para a página 2.
- Reduzir `layoutSafety` de `10` para **6**, já que o estimador agora é mais fiel.

### 4. Garantia de página única
- A área de Observações (5 linhas, ~31mm) e o footer continuam fixos.
- Pior caso testado mentalmente: aquecimento (até 12 itens) + 4 treinos × 5 exercícios = ~32 linhas de corpo. Com `NOM_ROW = 6.4` e `availH ≈ 230mm`, o `scale` resultante fica próximo de **0.75–0.85**, o que dá `ROW_FONT ≈ 7.0–7.6pt` — significativamente maior que os 4.8pt atuais.
- Melhor caso (poucos exercícios): `scale` sobe até **1.15**, dando `ROW_FONT ≈ 10pt`, preenchendo a página até as Observações.

## Fora do escopo
- Sem mudanças de cor, layout, QR code, rota pública ou número de linhas das Observações.

## Arquivo alterado
- `src/components/student/workout/exportWorkoutPDF.ts` (apenas constantes de fonte/padding e limites do `scale`).
