# Antecipação de renovação de plano

## O que muda para a equipe
No card do plano do aluno, o botão **"Renovar antecipadamente"** passa a aparecer para **qualquer plano vigente** (antigo ou 2027), **só para admin**. Ele abre a tela de venda já preparada como renovação do plano atual, com:

1. **Data de início do novo período**: sugere hoje e aceita data passada ou futura.
2. **Forma de cobrança** (as mesmas opções da venda de hoje):
   - **Online**: cartão (cobrança no cartão salvo/link) ou Pix.
   - **Pendente**: gera a cobrança em aberto, sem cobrar.
   - **Baixa manual**: maquininha ou dinheiro, já marcada como paga.
3. **Resumo antes de confirmar**: plano atual e até quando vai, novo período, valor e forma de cobrança.

Os **créditos do novo período são liberados na hora da renovação**, mesmo com a cobrança pendente.

## O que acontece com o plano atual
- Se a nova data for **depois** do fim do atual, o atual segue até o fim e o novo começa na data escolhida.
- Se for **antes** do fim (hoje ou retroativa), o atual é encerrado na véspera da nova data, e o novo passa a ser o plano principal. Créditos de treino que sobrarem seguem a regra de troca de plano já usada (50% do saldo de treino, arredondando para cima). Isso precisa da sua confirmação, veja abaixo.

## Ordem de trabalho
1. **Levantamento sem mexer em nada**: conferir com dados reais como a renovação de hoje funciona em cada caminho (venda antiga, venda 2027, Start, Power/Pro, Semestral, Pix Automático por grupo) e o que a função atual de renovação antecipada faz no banco. Se algo inesperado aparecer em cobranças, eu aviso antes de continuar.
2. Botão e tela de renovação antecipada (só admin, checado também no servidor).
3. Gravação no servidor: um passo único e seguro contra clique duplo, que não cria uma segunda renovação para o mesmo plano e período.
4. Testes e conferência no banco com um aluno de teste (sem cobrança real).

## Fica de fora
- Nenhuma cobrança real de teste sem seu pedido.
- A cobrança automática diária e o legado de recorrência não mudam.
- Downgrade continua proibido.

## Pontos para confirmar
- Encerrar o plano atual quando o novo começa antes do fim dele (descrito acima) está certo?
- No Semestral e no Pix Automático por grupo, que já têm renovação própria, o botão fica escondido nesta primeira versão.

## Detalhes técnicos
- Reaproveitar `VendaDialog`/`Venda2027Steps` com um novo modo `renovacao_antecipada` e `data_inicio` editável, em vez do `AlertDialog` atual em `StudentPlan.tsx` (hoje só aparece para plano legado mensal com `renovacao_automatica` e chama `fn_plano_renovar_antecipado`).
- Valores 2027 só por `calcularVenda2027`; gravação 2027 por `fn_venda_2027_criar` → `fn_venda_2027_gravar` (sem editar o miolo usado pelo site); plano principal sempre por `fn_plano_principal_ativo`.
- Nova RPC SECURITY DEFINER `fn_plano_renovar_antecipado_v2` (admin no servidor, sem `anon`), idempotente por (plano de origem, data de início), que encerra/mantém o plano atual e libera os créditos na mesma transação.
- Cobranças online pelos caminhos atuais (`rede-cobrar-token`/link e Pix Inter); pendente e baixa manual pelos fluxos atuais de `cobrancas`.
- Testes Vitest: só admin; data sugerida = hoje e aceita passado/futuro; créditos liberados com cobrança pendente; segunda chamada não duplica; plano atual encerrado só quando o novo começa antes do fim. Rodar `bunx vitest run` e eslint, sem `any`.
- Atualizar `src/components/planos/AGENTS.md` com a regra.
