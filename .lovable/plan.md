# Ajustes finais no PDF do treino

Alterações em `src/components/student/workout/exportWorkoutPDF.ts`:

## 1. Remover rodapé
Apagar o bloco do footer que escreve:
- "FORTEM Treinamento — documento gerado automaticamente"
- A data atual à direita

Isso libera ~5mm de espaço vertical, então também reduzir `footerReserve` de `5` para `1` para o conteúdo poder respirar mais.

## 2. Aumentar fontes (exercícios, séries, repetições, CAT)
Subir os valores nominais e os pisos (floors) usados na lógica de scaling:

- `EX_NAME_FONT`: nominal **11.0 → 12.5**, floor **7.6 → 9.0**
- `NUM_FONT` (séries / repetições): nominal **10.5 → 12.0**, floor **7.4 → 8.6**
- Coluna **CAT** (atualmente usa `SMALL_FONT` ~5.4pt): trocar para `EX_NAME_FONT` com `fontStyle: "bold"` para igualar exercícios/repetições.

Como o scaling de página única é dirigido pelos pisos, ajustar também:
- `FLOOR_ROW`: **5.6 → 6.4** (linhas precisam acomodar fontes maiores)
- `NOM_ROW`: **9.5 → 10.2**

A lógica de duas passadas (`optimisticScale` × `floorScale`) continua garantindo que tudo cabe em uma única página A4.

## 3. Escurecer as linhas (réguas) mantendo cinza
Atualmente:
- `RULE: [228, 228, 231]` (zinc-200) — usado nos divisores horizontais entre linhas das tabelas e no traço sob "OBSERVAÇÕES".

Trocar `RULE` para um cinza mais escuro mantendo a família zinc:
- `RULE: [228, 228, 231] → [113, 113, 122]` (zinc-500)

Isso escurece automaticamente:
- Divisores entre linhas das tabelas (aquecimento + força)
- Linha sob o título "OBSERVAÇÕES" (na verdade essa já é vermelha, sem efeito)
- Linhas manuais de escrita das observações
- Bordas dos slots da coluna "FREQUÊNCIA"
- Régua fina sob os labels das seções

As linhas alternadas de fundo (`SURFACE` zinc-100) e o texto cinza claro (`INK_MUTED`) permanecem como estão para preservar hierarquia visual.

## 4. Validação
Rodar `src/components/student/workout/exportWorkoutPDF.test.ts` para confirmar que:
- O PDF continua em **uma única página A4**
- Treino 4 / Bloco B continua presente
- Não há regressão na geração

## Resumo dos arquivos editados
- `src/components/student/workout/exportWorkoutPDF.ts` (única alteração)
