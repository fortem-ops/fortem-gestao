# Rosca de assimetria no card "Tornozelo" — diagnóstico

## O que foi verificado (leitura de código + banco)

1. **Não há valor hardcoded.** Em `MobilidadeTab.tsx`, `AssimetriaDonut` só usa as props `left`, `right` e `unit`; a assimetria é calculada como `(maior - menor) / maior * 100`. Uma busca por `35.5`, `30.4` e `14.4` em todo o `src/` não encontra nenhuma dessas constantes. O card passa `donut={readOnly ? { left: c.left, right: c.right } : undefined}`, e `c.left`/`c.right` são exatamente os mesmos `m.left`/`m.right` que geram os marcadores do rodapé ("E 45° · P45 / D 35° · P15"). Ou seja: com o código atual, rosca e rodapé leem a mesma fonte e não podem divergir.

2. **`unit` está correto.** O mesmo `unit` (`"°"`) é usado no rodapé e dentro da rosca (`{left}{unit}`). Se na tela a rosca aparece sem o símbolo de grau, isso indica que o que está sendo exibido **não é** a versão atual do componente.

3. **Os dados do banco confirmam 45/35.** Consultando as métricas "Mobilidade Tornozelo" gravadas em `avaliacoes`, todos os valores são inteiros (ex.: 45/35 em 05/08/2026, 50/53, 49/50...). Não existe nenhum registro com 35.5 ou 30.4 — nem nessa métrica nem em formato decimal.

## Causa raiz provável

O bundle exibido no preview está **desatualizado** (build antiga em cache do navegador / service worker do PWA — o projeto registra `public/sw.js`). Os números 35.5 / 30.4 / 14.4% não existem nem no código nem no banco; batem apenas com a imagem de referência usada como modelo visual, o que é coerente com uma renderização que não corresponde ao código atual.

Não é um problema específico do card "Tornozelo": como a ligação de dados é a mesma para todas as métricas, ou todos os cards estão corretos, ou todos vêm da mesma renderização antiga.

## Próximos passos propostos

1. **Confirmar antes de mexer no código:** recarregar o preview com hard refresh (e limpar o service worker) e reabrir Avaliações Premium → Resultados → Mobilidade. Se os cards passarem a mostrar os valores reais com `°` (ex.: 45° / 35° / 22.2%), era cache e nada precisa ser alterado.
2. **Se ainda reproduzir após o refresh:** capturar a tela com Playwright na rota real e inspecionar o DOM do card para identificar de onde vêm os números, antes de qualquer correção.
3. **Ajuste defensivo (opcional, independente do resultado acima):** exibir os valores da rosca com o mesmo formato do rodapé (`{valor}{unit}`, já é o caso) e adicionar rótulo da métrica na rosca, para que qualquer divergência futura fique visualmente evidente.

Nenhuma alteração de código foi feita.
