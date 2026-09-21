# Comparativo por variação de amplitude

## Alterações
- Remover do Comparativo toda dependência de percentil, severidade e faixa de mobilidade.
- Classificar cada lado somente pela variação em graus, invertendo ganho/perda no Psoas.
- Exibir valores antes/depois neutros; colorir apenas a variação; remover “Posição na base”.
- Atualizar os resumos para lados que ganharam/perderam amplitude.
- Ordenar métricas por perda, ganho e sem mudança, mantendo a ordem canônica em cada grupo.

## Testes e validação
- Substituir os testes de faixa por casos de ganho, perda e zero em métricas comuns e invertidas.
- Cobrir contagens e ordenação da mobilidade; preservar os testes de força.
- Rodar o typecheck e a suíte completa, sem alterar expectativas caso revelem falha de regra.
- Relatar os resultados literais, arquivos tocados e os levantamentos C e D já concluídos.

## Limites
- Não alterar motor de assimetria, mapa corporal, funções de percentil/severidade, outras abas, dados ou migrations.
