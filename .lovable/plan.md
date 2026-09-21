# Plano — Correção do Comparativo e levantamentos

## Escopo
Corrigir somente a aba Comparativo em Avaliações → Resultados e fazer dois levantamentos sem alterar dados nem migrations.

## Alterações no Comparativo
1. Trocar a comparação de mobilidade/flexibilidade de classificação fixa para percentil Fortem:
   - Usar `percentilMobilidade()` com sexo e faixa etária do aluno.
   - Manter a inversão do Psoas pelo caminho existente.
   - Mostrar cada lado no formato `65° · P42 → 78° · P81`.
   - Mostrar variação em graus e variação em pontos percentis.
   - Renomear a coluna `Faixa` para `Posição na base`.
   - Usar as mesmas faixas de percentil/cor do mapa corporal via `severityFromScore()`.
   - Sem sexo ou sem base suficiente: mostrar valores e variação em graus, indicar `Sem base de comparação`, e não contar no resumo.
   - Remover `classifyAngle` da aba Comparativo.

2. Corrigir linhas de força sem dado comparável:
   - Remover exercícios sem comparação em nenhum lado.
   - Se só um lado tiver comparação, manter a linha e avaliar apenas esse lado.
   - Se não houver linhas, exibir mensagem de ausência de força registrada nas duas datas.

## Testes
Atualizar/adicionar testes puros para:
- Movimento por faixa de percentil.
- Cor/tonalidade de variação de mobilidade comum e invertida.
- Variação percentual de força com corte provisório de 5%.
- Ordenação de mobilidade por percentil e força por movimento.
- Exclusão de linhas de força sem dado comparável.

## Levantamentos sem correção
1. Listar onde a interface ainda mostra Fraco/Regular/Médio/Bom/Excelente como classificação de mobilidade/flexibilidade.
2. Localizar onde Quadríceps é digitado, qual orientação/validação existe hoje e onde bloquear a convenção errada.

## Validação final
Rodar typecheck e suíte completa, copiar os resultados literais e listar arquivos tocados.
