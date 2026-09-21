# Nomenclatura dos níveis de assimetria

## Alterações
- Criar em `bodyMapLogic.ts` um único mapa exportado dos níveis internos para **Equilibrado / Atenção / Prioridade**, sem alterar cortes, cálculos ou cores.
- Usar esse mapa na aba Evolução, na Força, na lista de atenção do mapa corporal, nos textos explicativos da equipe e no Portal do Aluno.
- Preservar integralmente o chip de risco compensatório.
- Atualizar apenas expectativas textuais em testes existentes e adicionar cobertura pontual do mapa centralizado se necessário.

## Verificação e relatório
- Rodar o typecheck e a suíte completa.
- Informar literalmente os resultados e os arquivos/telas alterados.
- Relatar separadamente onde aparecem os textos de risco compensatório.
- Relatar se `SEVERITY_LABEL` chega à interface e consolidar o levantamento anterior de Fraco/Regular/Médio/Bom/Excelente, sem corrigir esses itens.
