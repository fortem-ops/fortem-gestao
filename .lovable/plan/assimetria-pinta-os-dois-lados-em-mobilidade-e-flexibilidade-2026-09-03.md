# Assimetria pinta os dois lados em Mobilidade e Flexibilidade

## Objetivo
Quando houver assimetria em Mobilidade ou Flexibilidade, AMBOS os lados da articulação/músculo recebem a MESMA cor do gradiente de assimetria (amarelo/vermelho), em vez de só o lado mais fraco ficar colorido.

## Mudança (um arquivo: `src/components/student/assessment/funcionalV2/BodyMapSVG.tsx`)

### Mobilidade
- Calcular a assimetria do PAR uma única vez: `assimetriaPar = |maior - menor| / maior * 100`.
- Aplicar `corGradienteAssimetria(assimetriaPar)` como `fill` de TODOS os shapes do par (esquerdo e direito iguais).
- Sem assimetria (0%) ou lado único: comportamento atual preservado (verde/neutro do gradiente).

### Flexibilidade
- Hoje os dois lados são sempre cinza `#7A8B99`. Passar a calcular a assimetria do par (mesma fórmula) e:
  - Assimetria ≥ limiar de atenção (alinhado ao gradiente, ex.: ≥10% — amarelo/vermelho): ambos os lados com `corGradienteAssimetria(assimetriaPar)`.
  - Abaixo do limiar: manter o cinza neutro atual (evita mapa todo verde na camada Flexibilidade).

### Fora de escopo
- Camada Força: mantém lógica atual (lado mais fraco colorido, lado forte neutro).
- Camada "Tudo": inalterada.
- `bodyMapLogic.ts` e `corGradienteAssimetria`: sem alterações.
- Lançamento e demais consumidores do BodyMap recebem o mesmo comportamento automaticamente (mudança é no renderer do SVG).

## Validação
- `bunx tsc --noEmit` + build.
- Conferência visual no mapa com aluno que tenha assimetria de mobilidade/flexibilidade.
