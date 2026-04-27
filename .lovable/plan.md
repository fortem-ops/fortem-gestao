## Mudanças no PDF de treino

Ajustar `src/components/student/workout/exportWorkoutPDF.ts` aplicando 6 alterações coordenadas para liberar espaço, manter tudo em uma única página A4 e melhorar a leitura dos nomes dos exercícios.

### 1. Remover o QR Code do cabeçalho

- Apagar todo o bloco `if (qrUrl) { ... QRCode.toDataURL ... doc.addImage ... "VÍDEOS NO APP" ... }` (linhas ~89–107).
- Remover o `import QRCode from "qrcode"`.
- Manter o parâmetro `qrUrl` na assinatura por compatibilidade (chamada em `WorkoutDetail.tsx` continua válida) mas marcá-lo como ignorado.

### 2. Trocar o wordmark "FORTEM" pelo logo enviado

- Copiar a imagem enviada para `src/assets/fortem-logo-pdf.png`.
- Importar o asset: `import fortemLogo from "@/assets/fortem-logo-pdf.png"`.
- Substituir o trecho que escreve `"F" + "ORTEM"` em texto (linhas 75–81) por `doc.addImage(fortemLogo, "PNG", mainX, margin + 1, 32, 8)` — proporção mantida.

### 3. Remover a tagline "TREINAMENTO · PLANILHA TÉCNICA"

- Apagar as linhas 84–87 (o `doc.text("TREINAMENTO  ·  PLANILHA TÉCNICA", ...)` e seu setup de fonte).
- O cabeçalho fica apenas com: logo à esquerda, identidade do aluno à direita, e a hairline vermelha embaixo.

### 4. Reduzir Observações de 5 para 3 linhas

- Em `OBS_LINES`: trocar `5` por `3`.
- Recalcular `obsBlockH = obsTitleH + 2 + OBS_LINE_GAP * 3` (~21 mm em vez de ~31 mm).
- Libera ~10 mm de altura útil para o corpo.

### 5. Aumentar a fonte dos nomes dos exercícios

- Criar `EX_NAME_FONT = Math.max(8.0, 11.0 * scale)` (piso 8 pt; nominal 11 pt).
- Aplicar via `columnStyles` apenas na coluna do exercício (índice `1` em ambas as tabelas — aquecimento e força), com `fontStyle: "bold"`.
- Demais colunas mantêm `ROW_FONT`.
- Ajustar `FLOOR_ROW` para `5.0` (era 4.6) para acomodar a fonte maior no pior caso.

### 6. Garantir página única após as mudanças

- Recalcular `NOM_ROW` de `7.2` para `7.6` no orçamento otimista (reflete a fonte maior do nome).
- Os ~10 mm liberados pelas Observações + a remoção da tagline compensam o aumento de fonte.
- A rede de segurança `deletePage` continua como última linha de defesa.
- Atualizar `exportWorkoutPDF.test.ts` com 2 asserções extras:
  - Garantir que o texto "ORTEM" não aparece como string no PDF (confirma uso do logo como imagem).
  - Garantir que o texto "TREINAMENTO" não aparece (tagline removida).
- Os testes existentes continuam validando: 1 página, Treino 4 / Bloco B completo, sem sobreposição vertical, "FREQUÊNCIA" presente, sem "v" textuais.

## Arquivos afetados

- `src/components/student/workout/exportWorkoutPDF.ts` — alterações 1–6.
- `src/assets/fortem-logo-pdf.png` — novo arquivo (cópia do upload).
- `src/components/student/workout/exportWorkoutPDF.test.ts` — 2 asserções adicionais.

## Critérios de aceite

- [ ] Cabeçalho mostra o logo FORTEM (imagem) à esquerda e dados do aluno à direita; sem QR Code e sem tagline.
- [ ] "OBSERVAÇÕES" tem exatamente 3 linhas de escrita manual.
- [ ] Nomes dos exercícios visivelmente maiores e em negrito.
- [ ] PDF gerado tem exatamente 1 página no cenário cheio (14 aquecimentos + 4 treinos × 5 exercícios), com Treino 4 / Bloco B completo.
- [ ] `bunx vitest run src/components/student/workout/exportWorkoutPDF.test.ts` passa.
