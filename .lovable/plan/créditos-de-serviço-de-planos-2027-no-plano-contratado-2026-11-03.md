# Créditos de serviço de planos 2027 no "Plano Contratado"

## O que acontece hoje
- Victoria tem o plano Power 2027 ativo. A venda criou o crédito "Avaliação Funcional" (1 disponível, válido até 03/11/2027) na carteira de créditos do aluno.
- O quadro "Créditos de Serviços" lê só o jeito antigo: a lista de serviços gravada dentro do plano e os lançamentos de consumo. Nos planos 2027 essa lista fica vazia (os créditos ficam na carteira), por isso aparece "0/0 usados · Esgotado".
- Isso não é só com ela: vale para qualquer plano 2027 com Avaliação, Nutrição ou Reabilitação incluídas.

## O que vou mudar (só na tela)
- Nos planos 2027 (os que têm versão de catálogo), o quadro passa a mostrar os créditos da carteira ligados à venda desse plano: total = quantidade inicial, usados = quantidade usada, e o saldo vem da diferença. Créditos inativos ou vencidos ficam de fora.
- Planos antigos continuam exatamente como estão hoje.
- Nos planos 2027, os botões de editar o crédito base e de lançar uso manual ficam ocultos nesse quadro. Hoje eles gravam no formato antigo e não mudariam o saldo real. Ajustes continuam pela área de créditos do aluno.
- Nenhuma mudança no banco ou nos créditos já criados.

## Detalhes técnicos
- `StudentPlan.tsx`: se `plano.catalogo_id` existir, buscar `creditos_aluno` com `aluno_id`, `origem_tipo='plano'`, `ativo=true` e `origem_id` = vendas cuja origem é o plano (ou todos os créditos de plano ativos e válidos do aluno, se o plano não tiver vínculo direto com a venda). Agregar por `atividade` nas três chaves de SERVICE_TYPES.
- Teste pequeno do agregador: Power 2027 com 1 Avaliação Funcional (0 usados) → total 1, disponível 1; plano legado segue usando `servicos`.
