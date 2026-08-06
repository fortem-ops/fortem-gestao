# Relatório — Mapa Corporal Biomecânico (somente leitura)

## 1. O componente é compartilhado? SIM — atenção crítica

`PremiumBodyMap.tsx` é apenas um wrapper fino: ele importa e renderiza o `BodyMap` de
`src/components/student/assessment/funcionalV2/BodyMap.tsx`, que é o mesmo componente usado em:

- `FuncionalV2Assessment.tsx` (formulário legado de Avaliação Funcional v2, em `/avaliacoes`) — linha 184
- `FuncionalV2Viewer.tsx` (visualizador), que por sua vez é renderizado em:
  - `src/pages/portal/PortalAssessments.tsx` (**Portal do Aluno**) — linha 272
  - `AssessmentViewerDialog.tsx` (painel admin)

Ou seja: qualquer mudança direta em `BodyMap.tsx`, `BodyMapSVG.tsx`, `RegionListPanel.tsx` ou nos
utilitários `.bodymap-*` / tokens `--bodymap-*` do `index.css` **afeta o Portal do Aluno e o
formulário antigo**. Só é seguro mexer de forma escopada (via seletor pai) ou no wrapper Premium.

## 2. De onde vêm as cores hoje

Três camadas:

1. **Tokens globais `--bodymap-*` no `:root`** (`index.css`, linhas 51–58): `--bodymap-bg: 220 28% 7%`,
   `--bodymap-silhouette`, `--bodymap-muscle-*`, `--bodymap-line`, `--bodymap-skin`.
2. **Utilitários globais** (`index.css`, linhas ~195–225): `.bodymap-surface` (fundo escuro + borda
   `hsl(0 0% 100% / 0.06)` + `color: hsl(0 0% 95%)`), `.anatomy-*`, `.bodymap-pulse`, `.bodymap-chain`.
   O container do mapa é `<div className="bodymap-surface rounded-xl p-5 md:p-6">` (BodyMap.tsx:138).
3. **Classes fixas dentro do TSX**: ~21 ocorrências de `text-white`, `text-white/50`, `text-white/60`,
   `hsl(0 0% 100% / 0.08)` em `BodyMap.tsx`; 3 em `BodyMapSVG.tsx`; 4 em `RegionListPanel.tsx`.

Escopar é tecnicamente viável (mesmo padrão do `--bio-*`): redefinir `--bodymap-*` e sobrescrever
`.bodymap-surface` / textos dentro de `[data-bio-theme="light"]`, sem tocar no `:root`. As classes
fixas `text-white*` dentro do TSX exigiriam overrides CSS escopados (ou props de tema), já que o
arquivo é compartilhado.

## 3. A silhueta é imagem raster com fundo escuro embutido — este é o bloqueio

`AnatomyFront.tsx` / `AnatomyBack.tsx` não são SVG vetorial: eles renderizam
`src/assets/bodymap/anatomy-front.png` e `anatomy-back.png` dentro de um `<image>` do SVG.

Verificação das imagens:

- Modo **RGB (sem canal alpha)**, 1024×1024
- Pixels de canto: ~`rgb(38, 37, 37)` — ou seja, **fundo cinza-quase-preto opaco embutido no PNG**

Conclusão: clarear o CSS ao redor **não funciona** — a silhueta continuaria como um retângulo escuro
colado sobre fundo claro. As alternativas reais são:

| Opção | Esforço | Resultado |
|---|---|---|
| A. Fundo preto puro escopado na Premium | Baixo | Mapa vira bloco preto sólido, imagem "casa" melhor (o fundo do PNG é quase preto). Zero risco fora da Premium. |
| B. Remover fundo do PNG (gerar versões com alpha) + tema claro | Alto | Fica realmente claro, mas exige regenerar/tratar as 2 imagens e reescrever cores dos halos, textos e legendas para fundo claro. |
| C. Filtro CSS `invert()` | Baixo | Inviável: inverte também as cores de severidade e deixa a anatomia com aparência de negativo. |

**Recomendação:** Opção A, exatamente como o usuário previu — trocar o cinza escuro por preto puro
escopado em `[data-bio-theme="light"] .bodymap-surface`, mais moldura/legenda ajustadas ao entorno
claro, sem alterar `:root` nem os arquivos compartilhados.

## Próximo passo

Se aprovado, implemento a Opção A:
- bloco CSS novo escopado a `[data-bio-theme="light"] .bodymap-surface` (fundo `hsl(0 0% 0%)`,
  borda clara sutil, remoção dos halos radiais coloridos)
- ajuste do wrapper `PremiumBodyMap.tsx` (moldura clara, glow removido/atenuado)
- nenhum arquivo dentro de `funcionalV2/` alterado; Portal do Aluno e `/avaliacoes` intactos.
