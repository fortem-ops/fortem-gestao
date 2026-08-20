# Ocultar pontos temporariamente no editor do Mapa Corporal

Objetivo: conseguir ver o contorno sobre a anatomia sem as bolinhas de edição atrapalhando a conferência do tracejado.

## Como vai funcionar

1. **Tecla H (segurar)** — enquanto a tecla estiver pressionada, os pontos somem; ao soltar, voltam. Ideal para uma conferência rápida.
2. **Botão "Ocultar pontos" / "Mostrar pontos"** — no painel lateral, junto às ações da forma selecionada, para deixar escondido de forma fixa.
3. Com os pontos ocultos, o contorno continua visível (preenchimento + linha), e o duplo-clique para adicionar ponto fica desativado para evitar edições acidentais. Ao voltar a mostrar, tudo funciona como hoje.
4. Uma legenda curta abaixo da imagem lembra o atalho: "Segure H para ocultar os pontos".

## Detalhes técnicos

Arquivo único: `src/pages/BodyMapShapesConfig.tsx`

- Novo estado `pointsHidden` (fixo, via botão) e `peeking` (temporário, via tecla H).
- `useEffect` com listeners `keydown`/`keyup` no `window`, ignorando eventos quando o foco está em `input`/`textarea` (diálogo de criação) e respeitando `e.repeat`.
- Renderização dos `<circle>` condicionada a `!pointsHidden && !peeking`; `onDoubleClick` do SVG retorna cedo nesse estado.
- Nenhuma mudança de dados, SQL ou de comportamento de salvar.
