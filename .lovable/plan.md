## Objetivo
Padronizar o subtítulo do PDF exportado dos treinos para refletir corretamente o tipo:
- **Personalizado** ou **qualquer modelo** (ex.: "3 TREINOS (2X3) - MARÍLIA") → `TREINO PERSONALIZADO`
- **Fases** → `FASE 1`, `FASE 2`, `FASE 3` ou `FASE 4` (conforme o `template_fase`)

Hoje o subtítulo monta `(templateFase || descricao || "PLANILHA DE TREINO")`, então quando o treino vem de um modelo o nome do modelo vaza para o cabeçalho (como na imagem enviada).

## Alteração
**Arquivo:** `src/components/student/workout/exportWorkoutPDF.ts`

Antes de montar `subtitleText` (linha ~121), aplicar normalização:

```ts
const normalizeSubtitle = (raw?: string | null): string => {
  const s = (raw || "").trim();
  // Aceita "Fase 1".."Fase 4" (com ou sem acento/caixa)
  const m = s.match(/^fase\s*([1-4])\b/i);
  if (m) return `Fase ${m[1]}`;
  return "Treino Personalizado";
};

const subtitleText = normalizeSubtitle(templateFase || descricao).toUpperCase();
```

Isso garante que:
- `templateFase = "Personalizado"` → `TREINO PERSONALIZADO`
- `templateFase = "Fase 2"` → `FASE 2`
- `templateFase = "3 TREINOS (2X3) - MARÍLIA"` (modelo) → `TREINO PERSONALIZADO`
- Sem `templateFase` e com `descricao` qualquer → `TREINO PERSONALIZADO`

Nenhuma outra parte do PDF é afetada (nome do aluno, frequência, blocos de treino seguem iguais).
