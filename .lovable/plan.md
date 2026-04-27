## Concluído — Ajustes no PDF de treino

Aplicado em `src/components/student/workout/exportWorkoutPDF.ts`:

1. **QR Code removido** — bloco do header e import `qrcode` apagados; param `qrUrl` mantido por compatibilidade.
2. **Logo FORTEM como imagem** — `src/assets/fortem-logo-pdf.png` importado e renderizado via `doc.addImage` no canto superior esquerdo (32×8mm).
3. **Tagline removida** — "TREINAMENTO · PLANILHA TÉCNICA" não aparece mais.
4. **Observações 3 linhas** — `OBS_LINES = 3`, libera ~10mm.
5. **Fonte dos exercícios maior** — `EX_NAME_FONT = max(7.6, 11.0 × scale)` em **bold**, aplicado só na coluna do exercício (índice 1) tanto em aquecimento quanto em força.
6. **Página única garantida** — `NOM_ROW` ajustado para 9.5 (orçamento otimista mais conservador) para que `scale` aperte o suficiente; rede de segurança `deletePage` permanece.

### Testes
`src/components/student/workout/exportWorkoutPDF.test.ts` — 7 testes passando, incluindo 2 novos:
- Não renderiza o texto "ORTEM" (validando que o logo é imagem).
- Não renderiza o texto "TREINAMENTO" (tagline removida).

### QA visual
PDF gerado e inspecionado: 1 página A4, todos 4 treinos completos (Bloco A + B do Treino 4 visível), Frequência à direita, dots vermelhos T1-T4, Observações com 3 linhas, sem QR, sem tagline, nomes dos exercícios destacados em bold maior.
