# Perfil no modo claro e aba ativa do menu inferior

## O que muda
1. **Perfil (e Reconhecimento facial) no modo claro**: essas telas passam a seguir a aparência escolhida em Configurações do App. Hoje elas forçam o fundo escuro mesmo no modo claro.
2. **Aba ativa do menu inferior**: hoje a aba selecionada fica branca (some no modo claro). Passa a ficar **vermelha** (#E73C3E, cor da marca), no modo claro e no escuro, mantendo o traço vermelho em cima.

## Detalhes técnicos
- Causa confirmada: `PortalProfile.tsx` (linha 100) e `PortalFacial.tsx` (linhas 166, 327, 337) têm um `data-portal="true"` próprio sem `data-portal-tema`, o que reaplica as variáveis do tema escuro dentro da tela. Correção: ler `usePortalTema()` e passar `data-portal-tema={tema}` nesses elementos (inclusive no painel inferior e no alerta do facial, que abrem fora do layout).
- `PortalLayout.tsx` linha 221: trocar `text-white` por `text-[#E73C3E]` na aba ativa.
- Teste de regressão em `src/test/portalTema.test.ts`: telas com `data-portal="true"` no portal devem repassar `data-portal-tema`; aba ativa não usa `text-white`.
- Rodar vitest, eslint nos arquivos alterados e conferir no celular (393px) com o modo claro.
