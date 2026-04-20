
## Goal
Aumentar a fonte dos nomes dos exercícios para que o **Treino 4 encoste no topo da área de Observações**, sem invadi-la, mantendo tudo em **uma única página A4**.

## Análise

Arquivo único: `src/components/student/workout/exportWorkoutPDF.ts`.

Hoje:
- `scale = clamp(0.46, 0.9, availH / totalEst)` — teto travado em **0.9** impede ocupar todo o espaço útil mesmo quando sobra.
- `ROW_FONT = max(4.8, 6.8 * scale)` → entre 4.8 e ~6.1pt (muito pequeno).
- Estimadores `NOM_ROW=5.2`, `NOM_HEAD=5.0`, `layoutSafety=10` são conservadores.
- Bloco de Observações (5 linhas, ~31mm) e footer já são **fixos** no fundo via `obsBottom = pageH - margin - footerReserve` e `obsTop = obsBottom - obsBlockH` — ou seja, Observações não se move; só precisamos fazer os treinos crescerem para preencher `availH`.

Conclusão: basta **liberar o teto do `scale`** e **subir piso/base de fonte e padding**, recalibrando os nominais para que o estimador continue confiável e nada vaze para a página 2 nem invada Observações.

## Mudanças (apenas constantes em `exportWorkoutPDF.ts`)

1. **Liberar `scale`**: teto `0.9 → 1.6`. Piso `0.46` mantido.
2. **Aumentar fontes/paddings de corpo de tabela**:
   - `ROW_FONT`: `max(4.8, 6.8*scale)` → `max(7.0, 9.5*scale)`
   - `HEAD_FONT`: `max(4.6, 5.8*scale)` → `max(5.8, 7.2*scale)`
   - `ROW_PAD`: `max(0.18, 0.8*scale)` → `max(0.6, 1.3*scale)`
   - `HEAD_PAD`: `max(0.22, 0.85*scale)` → `max(0.5, 1.1*scale)`
3. **Recalibrar nominais** (estimador conservador, evita overflow):
   - `NOM_ROW`: 5.2 → **7.2**
   - `NOM_HEAD`: 5.0 → **6.2**
   - `NOM_BADGE`: 5.2 → **6.0**
   - `NOM_TREINO_BAR`: 6.5 → **7.2**
   - `layoutSafety`: 10 → **8**
4. **Demais escalados** (badge, barra, labels) ficam como estão — já acompanham `scale` e crescem proporcionalmente.

## Garantia de página única
- Observações permanece ancorada ao rodapé (intacta).
- `availH` continua sendo o espaço entre header e topo das Observações.
- Como o estimador agora é fiel ao novo tamanho de linha, no pior caso (4 treinos × 5 + aquecimento cheio + 12 semanas) `scale` fica próximo de **0.75–0.85** → `ROW_FONT ≈ 7.1–8.1pt` (vs 4.8pt atual).
- No melhor caso (treinos pequenos) `scale` sobe até **1.6** → `ROW_FONT ≈ 15pt`, fazendo o Treino 4 encostar nas Observações.

## Fora do escopo
Cores, layout, QR code, número de linhas das Observações, rota pública.

## Arquivo alterado
- `src/components/student/workout/exportWorkoutPDF.ts` (somente constantes).
