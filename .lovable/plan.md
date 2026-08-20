# Pontos editáveis: adicionar e remover livremente

Hoje cada forma nasce com 6 pontos (hexágono). Existe um duplo-clique escondido que insere ponto e um botão "Remover ponto selecionado", mas isso não fica evidente e o duplo-clique é pouco confiável (concorre com o arraste). O objetivo é tornar adicionar/remover pontos uma ação óbvia e direta na tela de configuração do mapa corporal.

## O que muda na tela `/bodymap-config`

1. **Alças "+" entre os pontos**
   Ao selecionar uma forma, aparece um pequeno círculo "+" no meio de cada segmento do contorno. Um clique nele insere um novo ponto exatamente ali (na posição correta da sequência), que já fica selecionado e pronto para arrastar.

2. **Remover ponto direto no ponto**
   - Duplo-clique sobre um ponto o remove.
   - O botão "Remover ponto selecionado" continua existindo, com atalho de teclado `Delete`/`Backspace` quando há ponto selecionado.
   - Mínimo de 3 pontos preservado (botão e ações desabilitados abaixo disso).

3. **Adicionar ponto no fim do contorno**
   Botão "Adicionar ponto" no painel lateral, que insere um ponto no maior segmento do contorno — útil quando não se quer mirar numa alça pequena.

4. **Densidade inicial escolhível**
   No diálogo de criação de forma, um seletor de número de pontos iniciais (6 / 8 / 12 / 16), em vez de sempre 6. Continua sendo um polígono regular, só com mais vértices.

5. **Ajuda em tela**
   Texto de rodapé atualizado: arrastar move, "+" insere, duplo-clique no ponto remove.

## Detalhes técnicos

- Arquivo alterado: `src/pages/BodyMapShapesConfig.tsx` (apenas frontend).
- `hexagon()` vira `polygon(cx, cy, r, n)` com `n` configurável.
- Alças "+": derivadas de `editingPoints` como pontos médios entre `i` e `i+1` (fechando o ciclo); clique faz `splice(i+1, 0, ponto)`.
- Remoção por duplo-clique no `<circle>` com `stopPropagation` para não disparar o `onDoubleClick` do SVG.
- Atalho de teclado via `useEffect` com listener em `window`, ativo só quando há ponto selecionado e o foco não está num campo de texto.
- Nenhuma mudança de banco de dados: `bodymap_shapes.points` já é uma lista de tamanho variável.
