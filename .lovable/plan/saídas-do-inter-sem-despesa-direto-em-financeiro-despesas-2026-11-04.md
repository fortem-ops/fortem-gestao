# Saídas do Inter sem despesa direto em Financeiro > Despesas

## O que muda
1. **Aviso no topo de Despesas**: um quadro "Saídas do Inter sem despesa" lista as saídas pendentes (data, valor, descrição do extrato). Some quando não há pendências.
2. **Dois botões por saída**:
   - **Associar a conta existente**: abre a janela de conciliação já existente, com sugestões de despesas próximas em data/valor e ajuste do valor quando diferente.
   - **Adicionar como nova despesa**: abre o formulário normal de "Nova despesa" já preenchido com data, valor e descrição da saída. Ao salvar, a despesa fica vinculada à saída, que deixa de aparecer como pendente.
3. **Link na notificação**: as novas notificações em Notificar passam a ter o link clicável para `/financeiro/despesas?mov=...`, que abre a tela com aquela saída destacada. As notificações antigas também ganham o link.

## Fora do escopo
- Regras de conciliação, valores e a tela de Conciliação Bancária ficam iguais.
- Nada é conciliado sem clique da equipe.

## Detalhes técnicos
- Pendências: `inter_extrato_movimentos` de saída sem vínculo em `conciliacoes_bancarias`, cruzados com `conciliacao_avisos` (só admin/coordenador vê o quadro).
- Associar: reutiliza `ConciliarSaidaDialog` (RPCs `fn_conciliar_saida_*` atuais).
- Nova despesa: abre o formulário de criação da página com valores iniciais; após criar, chama a RPC de vínculo existente para a despesa recém-criada (sem nova regra de valor).
- `conciliar-extrato-diario`: texto do aviso aponta para `/financeiro/despesas?mov=`; republicar a função. Atualização única de texto das notificações antigas (troca do caminho), sem tocar outros dados.
- Verificar se Notificar renderiza URLs internas como link; se não, transformar caminhos `/financeiro/...` em link só na exibição.
