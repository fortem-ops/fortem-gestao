
## Goal
Adjust the workout PDF so that:
1. **Observações** has exactly **5 writing lines** (no more, no less).
2. **Exercise tables (Força blocks A and B)** span the **full width of the red "TREINO X · FORÇA" bar** — currently the table sums to ~121mm but the red bar is ~144mm wide, so columns look narrower than the header.

## Current state (from `exportWorkoutPDF.ts`)

- Red bar `TREINO X` uses full `mainW` (≈144mm with current margins/gutter).
- Força tables column widths sum: `5 + 10 + 74 + 12 + 10 + 10 = 121mm` → leaves ~23mm gap on the right, making the table look narrower than the red bar.
- Observações draws lines with `lineGap = 4.5` filling all remaining vertical space — variable line count (often 8–15 lines).

## Changes (single file: `src/components/student/workout/exportWorkoutPDF.ts`)

### 1. Force exercise tables to match the red bar width
- Replace the fixed column widths with **proportional widths that sum to `mainW`**, so the table edges align perfectly with the red `TREINO` bar.
- Same fix applied to the **warm-up table** (LIB/MOB/ATI) for consistency, since its red-bordered header already targets the same `mainW`.
- Approach: keep narrow fixed widths for `#`, `CAT`, numeric columns; give all leftover space (`mainW - sumOfFixed`) to the `EXERCÍCIO` column.

### 2. Lock Observações to exactly 5 lines
- Replace the "fill remaining space" loop with a **fixed 5-line block**:
  - Title row + 5 evenly-spaced writing lines (`lineGap ≈ 5mm`).
  - Total Observações height becomes a known constant (~32mm).
- Update the single-page height budget (`obsMinH` / `bodyBottom`) to reserve exactly this fixed block, so the adaptive scaling for warm-up + frequency + 4 treinos accounts for the new fixed footer area.
- This guarantees the 5 lines never collapse and never expand.

### 3. Keep single-page A4 guarantee
- Recompute `availH` using the new fixed Observações height.
- Scaling logic (`scale`, `ROW_FONT`, paddings) remains unchanged in shape, just fed the updated budget — content still fits on one page.

## Out of scope
- No color, typography, or content changes.
- No changes to public `/treino/:id` route, QR code, or weeks selector.

## Files touched
- `src/components/student/workout/exportWorkoutPDF.ts` (only)
