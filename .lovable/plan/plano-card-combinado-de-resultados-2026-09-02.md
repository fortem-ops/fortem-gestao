# Plano: Card combinado de Resultados

## Objetivo
Transformar a área de Resultados em um único card combinado: o seletor de seções (Assimetria / Composição / Pliometria / Evolução / Comparativo / Recomendações) vira o cabeçalho do card, e o conteúdo muda dentro dele. Quando qualquer seção diferente de Assimetria estiver ativa, o mapa corporal some e o respectivo conteúdo ocupa o mesmo card.

## Mudanças

1. **ResultadosNav.tsx**
   - Adicionar botão explícito **"Assimetria"** como primeira opção do seletor, deixando as 6 opções visíveis e claras.
   - Clicar em uma seção inativa seleciona ela; clicar em "Assimetria" volta para `view = "assimetria"`.

2. **BodyMap.tsx**
   - Remover a prop `navSlot` e seu posicionamento na barra de controles (limpeza do ajuste anterior).
   - O componente volta a conter apenas os controles próprios (modo Assimetria + camadas Mobilidade/Flexibilidade/Força/Tudo).

3. **PremiumBodyMap.tsx**
   - Remover a moldura externa `bio-card` (borda e glow podem ser mantidos sem a classe de card, ou passados para o pai).
   - O componente passa a renderizar **apenas** o mapa corporal premium + seus controles internos, para poder ser inserido dentro do novo card combinado sem bordas aninhadas.

4. **AvaliacoesPremium.tsx (modo Resultados)**
   - Criar um único `bio-card` que envolve:
     - **Header:** `ResultadosNav` centralizado/alinhado.
     - **Body condicional:**
       - `view === "assimetria"` → renderiza `PremiumBodyMap` (com `layer` e `onLayerChange`).
       - `view === "composicao"` → `ComposicaoTab` (readOnly).
       - `view === "pliometria"` → `PliometriaTab` (readOnly).
       - `view === "evolucao"` → `EvolucaoTab`.
       - `view === "comparativo"` → `ComparativoTab`.
       - `view === "recomendacoes"` → `RecomendacoesTab`.
   - Manter o `ResultadosDateSelect` e o card de resumo geral **acima** do card combinado (fora dele), sem alterar comportamento.
   - Modo **Lançamento** permanece inalterado.

## Estrutura visual esperada

```text
[Resumo geral]
[Seletor de data]
┌─────────────────────────────────────────────┐
│  [Assimetria] [Composição] [Pliometria] ... │  ← header do card combinado
│                                             │
│  Se Assimetria:                             │
│    ┌─────────────────────────────────────┐  │
│    │  Modo: Assimetria                   │  │
│    │  Camadas: Mobilidade | Flexibilidade│  │
│    │  [Mapa corporal]                    │  │
│    └─────────────────────────────────────┘  │
│                                             │
│  Se outra seção:                            │
│    [Conteúdo da seção selecionada]          │
└─────────────────────────────────────────────┘
```

## Riscos e cuidados
- Evitar cards aninhados: `PremiumBodyMap` não deve mais trazer sua própria borda.
- O seletor de camadas (Mobilidade/Flexibilidade/Força/Tudo) continua aparecendo apenas quando Assimetria está ativa, pois faz parte do mapa.
- Estados vazios de cada seção são preservados; o card combinado exibe o mesmo conteúdo que hoje, só dentro de uma única moldura.
- Lançamento não é afetado.

## Validação
- Typecheck (`bunx tsc --noEmit`).
- Build do Vite.
- Preview no modo Resultados: testar troca entre Assimetria (mapa visível) e as demais seções (mapa oculto, conteúdo correto).
