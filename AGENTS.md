# Decisões técnicas

- A conclusão do lembrete de Avaliação Funcional deve ser inferida pelo conteúdo de `avaliacoes.dados` em registros `funcional_v2`, mantendo suporte aos tipos legados; o tipo sozinho não representa as partes preenchidas.- Categorias de despesa: lançamentos novos só usam categorias com `nivel` (central/sub); `nivel` nulo = categoria antiga, mantida só para histórico/filtros. Por quê: preservar lançamentos antigos sem poluir o cadastro novo.
