# Botão "Atualizar conciliação"

## O que o usuário verá
Em Financeiro > Despesas, no quadro "Saídas do Inter sem despesa", um botão **ATUALIZAR CONCILIAÇÃO** (visível só para admin). Ao clicar:
1. Busca o extrato do Banco Inter dos últimos 10 dias (mesmo que a rotina diária faz).
2. Roda a conciliação automática (vínculos exatos/aproximados, baixas e contas já conciliadas manualmente).
3. Atualiza a lista na tela e mostra um resumo: "X conciliadas, Y novas saídas sem despesa".

Enquanto roda, o botão fica desabilitado com "Atualizando…". Nada muda nas regras de conciliação; avisos continuam únicos por movimento (sem duplicar notificações).

## Detalhes técnicos
- As funções `inter-extrato-sync` e `conciliar-extrato-diario` hoje aceitam só o segredo do agendador. Adicionar nelas um segundo caminho de acesso: JWT do usuário validado no servidor (`getUser`) + `user_roles` admin + `profiles.ativo` (perfil ativo). Caminho do agendador permanece igual.
- Pelo JWT, `inter-extrato-sync` fica fixo em `dias=10` (sem `diag`).
- Front: em `SaidasSemDespesaCard.tsx`, botão chama em sequência `supabase.functions.invoke("inter-extrato-sync")` e `invoke("conciliar-extrato-diario")`, depois invalida as queries de avisos/despesas/conciliações e mostra toast com o `resumo`.
- Trava contra cliques duplos (estado local). Reimplantar as duas funções.
- Teste pequeno da checagem de admin no helper de autorização.
