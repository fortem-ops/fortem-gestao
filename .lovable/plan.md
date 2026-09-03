# Plano: deixar lado Direito/Esquerdo mais claro nas Avaliações Premium

## Objetivo
Reduzir a confusão sobre qual lado é Direito (D) e qual é Esquerdo (E) nos gráficos, tabelas e no mapa corporal do modo Resultados das Avaliações Premium, sem alterar o modo Lançamento.

## Decisões já confirmadas com o usuário
- **Local principal do problema:** gráficos e tabelas.
- **Formato preferido:** siglas (E/D) com legenda visual fixa.
- **Mapa corporal:** manter siglas, mas adicionar tooltip ao passar o mouse indicando "Lado esquerdo" / "Lado direito".

## Escopo
Alterações somente no modo **Resultados** das Avaliações Premium. O modo Lançamento permanece inalterado.

## Mudanças propostas

### 1. Componente reutilizável de legenda de lados
Criar `src/components/avaliacoes-premium/LadoLegend.tsx` com:
- Quadrado azul + "E = Esquerdo".
- Quadrado laranja + "D = Direito".
- Variante compacta (só ícones coloridos com tooltip) e expandida (texto visível).
- Usar as mesmas cores já adotadas no donut de assimetria (`#378ADD` esquerdo, `#E8843C` direito).

### 2. Gráficos de Evolução (`EvolucaoTab.tsx`)
- Manter as siglas `(E)` e `(D)` nos nomes das séries, pois o usuário prefere siglas.
- Adicionar o componente `LadoLegend` expandido logo abaixo do seletor de datas/itens e acima do primeiro gráfico.
- Garantir que a legenda fique visível mesmo quando houver vários gráficos.

### 3. Tabela e cards de Mobilidade/Flexibilidade (`MobilidadeTab.tsx`)
- Os headers das tabelas já usam "Esquerdo" / "Direito" por extenso — manter.
- Adicionar `LadoLegend` compacta no topo do card de histórico e do card "Distribuição vs. base Fortem".
- No card de distribuição, manter os labels `E`/`D` sobre as linhas do gráfico, pois a legenda fixa já explica o significado.

### 4. Tabela de Força (`ForcaTab.tsx`)
- Os headers já usam "Direito" / "Esquerdo" por extenso — manter.
- Adicionar `LadoLegend` compacta no topo da tabela "Principais Assimetrias de Força" para reforçar a correlação com as cores usadas nos outros componentes.

### 5. Mapa Corporal (`BodyMapSVG.tsx`)
- Atualizar o `<title>` das formas musculares e articulares para incluir a indicação de lado:
  - Exemplos: "Mobilidade Ombro — Lado esquerdo: 45°", "Força Extensão de Quadril — Lado direito".
- Garantir que o tooltip nativo do SVG apareça ao passar o mouse sobre qualquer forma calibrada.
- Não adicionar labels fixos D/E sobre o corpo, pois o usuário escolheu tooltip.

## Ordem de execução
1. Criar `LadoLegend.tsx`.
2. Integrar em `EvolucaoTab.tsx`.
3. Integrar em `MobilidadeTab.tsx`.
4. Integrar em `ForcaTab.tsx`.
5. Ajustar tooltips em `BodyMapSVG.tsx`.
6. Validar TypeScript e build.

## Riscos e mitigações
- **Risco:** poluir visualmente a tela com muitas legendas.
  - **Mitigação:** usar a variante compacta em cards que já têm muita informação e a expandida apenas no topo da seção Evolução.
- **Risco:** quebrar o tooltip existente das articulações.
  - **Mitigação:** preservar o conteúdo atual do `<title>` e apenas acrescentar a indicação de lado no início ou no final do texto.

## Critérios de aceitação
- [ ] Usuário consegue identificar E/D sem esforço nos gráficos de Evolução.
- [ ] Tabelas de Mobilidade e Força reforçam visualmente a lateralidade.
- [ ] Passar o mouse sobre uma forma no Mapa Corporal mostra "Lado esquerdo" ou "Lado direito".
- [ ] Build e typecheck passam.
- [ ] Modo Lançamento não é alterado.
