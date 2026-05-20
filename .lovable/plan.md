# Modo Calibração — arrastar halos (admin) + gravar no banco

Visível apenas para admin. As coordenadas ficam salvas no banco e passam a valer para todos imediatamente.

## UX

1. Acima do Mapa Corporal, botão **"Calibrar mapa"** renderizado só se `is_admin = true` (RPC já existente).
2. Ao ativar:
   - Cada halo ganha um **handle arrastável** (anel branco + ponto central, cursor `move`).
   - Arrastar atualiza `cx`/`cy` em tempo real (conversão pixel→viewBox via `getBoundingClientRect` + pointer events com `setPointerCapture`).
   - Mudanças ficam em estado local "rascunho" — não salvam a cada drag.
3. Painel lateral mostra:
   - **Salvar alterações** → grava no banco (upsert por região). Toast de confirmação.
   - **Descartar** → volta para os valores salvos.
   - **Resetar para o padrão do código** → remove overrides do banco (volta a usar `REGION_GEOMETRY` do código).
4. Ao desligar o modo, halos voltam ao visual normal.

## Banco

Nova tabela `bodymap_region_overrides`:

- `region_id text primary key` — uma das 12 regiões (`shoulder-l`, `thoracic`, etc.).
- `cx numeric not null`, `cy numeric not null` — coordenadas no viewBox 360×800.
- `updated_at`, `updated_by uuid`.

**RLS**:
- `SELECT` liberado para qualquer usuário autenticado (todos precisam ler para renderizar).
- `INSERT`/`UPDATE`/`DELETE` apenas para admin (`has_role(auth.uid(), 'admin')`).

## Código

- **`BodyMapSVG.tsx`** — aceita prop opcional `overrides?: Partial<Record<RegionId, {cx:number;cy:number}>>` e funde com `REGION_GEOMETRY` antes de renderizar halos, hits, cadeias e linhas de assimetria.
- **`useBodyMapGeometry.ts`** (novo hook) — `useQuery` que lê `bodymap_region_overrides` e devolve o objeto de overrides + funções `save(region, cx, cy)`, `saveAll(draft)`, `reset()`.
- **`BodyMapCalibrator.tsx`** (novo) — overlay com handles arrastáveis + painel de ações. Recebe `geometry` mesclada e callback de save.
- Onde `BodyMapSVG` é usado hoje (`StudentAssessments` / `AssessmentViewerDialog` / `funcionalV2` painel), envolver com wrapper que:
  - Carrega overrides via hook.
  - Renderiza botão "Calibrar mapa" se admin.
  - Alterna entre `BodyMapSVG` normal e `BodyMapSVG` + `BodyMapCalibrator` por cima.

## Fora do escopo

- Edição do raio (`r`) das regiões — só posição.
- Calibração por aluno — overrides são globais.
- Histórico de alterações.
