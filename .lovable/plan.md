# Ajustes no PDF de treino prescrito

Apenas alterações em `src/components/student/workout/exportWorkoutPDF.ts`.

## 1. Garantir 1 página (sem quebra)

O loop iterativo de fit já existe, mas em casos densos (como o Marcelo) a estimativa otimista é alta demais e o "grow" empurra o conteúdo para uma 2ª página. Vou:

- Aumentar o `footerReserve` e o `slack` global no `floorEst` (margem de segurança maior).
- Reduzir o `FILL_TOLERANCE` e o teto de `growthFactor` para que o passo de crescimento seja mais conservador e raramente provoque overflow.
- Reduzir levemente o `attemptMul` inicial (0.97) para que a primeira tentativa já caiba com folga, e aumentar `MAX_ATTEMPTS` para 18.
- Garantir que o caminho de "revert para bestFitMul" sempre re-renderize antes de cair no "drop spillover" — atualmente um overflow após o grow só reverte uma vez; vou permitir múltiplas reversões com decaimento adicional (×0.92) caso ainda estoure.

Resultado: o PDF do Marcelo (e qualquer outro plano denso) sempre cabe em uma única folha A4.

## 2. Aumentar fonte de rótulos

Alvos (todos no mesmo arquivo):

- **AQUECIMENTO** (barra vermelha de seção) → `SECTION_FONT` base de `9.0 * scale` → `11.5 * scale`, piso `7.0`.
- **TREINO 1/2/3/4** (barras vermelhas dos treinos) → `TREINO_LABEL_FONT` base `7.4 * scale` → `10.5 * scale`, piso `6.5`. `BAR_H` sobe de `5.1 * scale` para `6.2 * scale` (piso 3.4) para acomodar.
- **LIB / MOB / ATI / PREV** (badges pretos) → `BADGE_FONT` base `5.9 * scale` → `8.0 * scale`, piso `5.0`. Largura do badge (`badgeW`) sobe de 12 → 15mm; `BADGE_H` base `3.8 * scale` → `4.8 * scale` (piso 2.4).
- **LIBERAÇÃO / MOBILIDADE / ATIVAÇÃO / PREVENTIVOS** (texto ao lado do badge) → fonte sobe de `Math.max(5.1, 6.2 * scale)` para `Math.max(6.5, 8.2 * scale)`.
- **Números 1,2,3,4,5** (coluna `#` da tabela de aquecimento) → `SMALL_FONT` aplicado nessa coluna sobe para `Math.max(6.0, 8.5 * scale)` e cor muda de `INK_MUTED` para `INK_SOFT` para melhor leitura.

Os pisos garantem que mesmo no menor `scale` (quando o conteúdo é muito denso) os rótulos continuam legíveis e claramente maiores que hoje. A etapa 1 (margens maiores no fit) compensa o ganho de altura desses elementos para manter a página única.

## Validação

- Testar com o aluno Marcelo Luiz Nunes Melim (caso reportado) e conferir: 1 página + rótulos visivelmente maiores.
- Conferir com planos menores que os rótulos não fiquem grandes demais (os pisos são módicos, o teto vem do `scale`).
- `src/components/student/workout/exportWorkoutPDF.test.ts` já existe — rodar para garantir que segue passando.
