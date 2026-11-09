# Reformulação da Nova Venda — plano (somente planejamento)

Nada é implementado sem aprovação de cada sub-etapa. Não foi possível abrir o mockup; o plano segue a descrição do dono.

## A. O que existe hoje

Telas (mesma janela aberta pelo Perfil do aluno, pela aba Plano & Financeiro e por Prospects):
- `VendaDialog.tsx` (~1.200 linhas): seletor "Planos atuais / Planos 2027" (visível a admin, coordenador e professor). Em "Planos atuais", abas **Planos** (Frequência → Plano → Serviços inclusos → Resumo → Pagamento; inclui o card "Corrida — plano adicional" e a escolha substituir / renovação / adicional) e **Serviços** (venda avulsa de um serviço).
- `Venda2027Steps.tsx`: famílias Start, Power, Pro, Consultoria Online e "Só serviços"; lista os pacotes 2027 dentro da venda do plano; usa o portão de teste (`sistema_config.vendas_2027_teste_aluno_ids`, 3 alunos) e as datas `vendavel_desde/ate`.
- Apoio: `ServicosPlanoStep`, `PagamentoStep`, `PaymentFields`, `TipoCobrancaSection`, `src/lib/vendas2027.ts` (cálculo e regra de "vendável"), `corridaPlanoBase.ts`, `CorridaConfigurator.tsx`.

Catálogo (consultado agora, só leitura):
- `planos_catalogo` ativos: 23 planos atuais de treino, **18 de Corrida (todos do tipo "atual", sem versão)**, Start 2027 (4), Power 2027 (8), Pro 2027 (8), Consultoria 2027 (3).
- `servicos_catalogo` atuais (sem versão), todos ativos: Avaliação Funcional R$250, Inscrição em Prova Avulsa (Corrida) R$289, Nutrição R$350, Nutrição pacote 4 R$1.320, Reabilitação 01–12 sessões, e **"Recovery - 1 sessão" R$50 (atividade "Recovery (Bota de Compressão)", liberar só após pagamento)** — já existe, criado para a compra no portal.
- Pacotes 2027 (versão 2027), ativos: Avaliação de Composição Corporal R$200, Nutrição 4 + 2 avaliações R$1.620, Nutrição 8 R$2.400, Reabilitação 4 e 8 sessões (2027).

Como um serviço atual é vendido: a tela grava direto em `vendas` (tipo "servico"). Rotinas automáticas da venda fazem o resto: `fn_processar_venda` (créditos), comissão ao pagar, cobrança/baixa, notificação, indicação e, para itens "liberar após pagamento" (Recovery), crédito só quando a venda fica paga. Agenda consome o crédito pela atividade. Planos 2027 gravam por `fn_venda_2027_criar`; "Só serviços" 2027 por `fn_venda_servicos_2027_criar`.

## B. Pontos 1–5

1. **Só Planos 2027, sem o nome** — TELA. Remover seletor e chips "2027"; Nova Venda abre direto com abas Planos e Serviços. NÃO muda: funções de venda 2027, cálculo, contratos.
2. **Alunos atuais seguem até o fim** — NADA muda (contratos, planos, cobranças, renovação mensal legada, rescisão, carteira, agenda). Apenas deixam de aparecer para venda nova. Itens atuais NÃO serão desativados no catálogo (renovações e telas antigas leem por nome/id); o filtro é só na tela.
3. **Aba Planos: Start, Power, Pro, Consultoria, Corrida** — TELA. Corrida reaproveita o trecho atual (mesmo cálculo, mesma gravação, contrato paralelo "adicional", sem créditos), com rótulo "Corrida". Remove "Só serviços". Escolha substituir/renovação para plano de treino atual vigente: hoje existe só no fluxo antigo; no 2027 vale a regra do dono (2 planos ativos até o fim do contrato antigo) — sem mudança.
4. **Aba Serviços** — TELA reaproveitando a venda avulsa atual (mesma gravação e créditos). Bota Recovery R$50: já existe no catálogo; só aparece. BANCO só se o dono decidir ajustar (ver pergunta 3).
5. **Pacotes 2027 fora** — TELA esconde a lista; BANCO opcional: marcar `vendavel_ate` (ou `ativo=false`) nos 5 itens, sem apagar. Histórico, créditos e cobranças já vendidos permanecem.

## C. Riscos

- Corrida depende do fluxo "atual" (itens sem versão, gravação direta, contrato adicional). Precisa ser movida intacta, não reescrita.
- Portão de teste 2027: se algum item 2027 ainda não está liberado, ao sumir "Planos atuais" a equipe fica sem plano de treino para vender. Conferir datas antes do R1.
- Professor hoje vê "Planos atuais"? A janela libera os dois fluxos a consultores; comissão de venda interna segue igual.
- Renovação/upgrade/mudança de plano de alunos atuais usam outras telas e o catálogo atual: por isso não desativar itens atuais no banco.
- Recovery com "liberar após pagamento": vendido pela equipe como "pendente", o crédito só nasce quando der baixa (diferente dos outros serviços, que liberam na criação). Comissão: hoje sem comissão.
- Consultoria: pacotes 4/6 meses não aceitam serviços na mesma venda — com os pacotes 2027 fora da venda, o aviso some; serviços passam a ser sempre venda separada.
- Item legado "Consultoria Online - 6 meses 2026" ainda ativo: deixará de aparecer.
- Prospects usa a mesma janela: Start/Power/Pro precisam funcionar para quem não tem plano.

## D. Sub-etapas

- **R0 (só leitura)**: conferir datas/portão de teste dos itens 2027 e quem vendeu pelo fluxo atual nos últimos 30 dias.
- **R1 — Tela**: nova estrutura (abas Planos/Serviços, Corrida movida, serviços atuais + Recovery, sem pacotes 2027, sem "Só serviços"). Fluxo antigo fica escondido no código por um tempo (rollback = reverter a tela). Testes de qual item aparece em cada aba.
- **R2 — Catálogo (opcional)**: migração marcando `vendavel_ate` nos 5 pacotes 2027; ajustes da Recovery se decididos. Ensaio revertido antes; script de rollback em `scripts/`.
- **R3 — Verificação**: ensaio com aluno de teste (sem venda real) em plano, Corrida e serviço; typecheck/build; remoção do código antigo só após aprovação.

## E. Perguntas ao dono

1. Pacotes 2027: só esconder na tela ou também encerrar no catálogo? Recomendo encerrar com data final (reversível).
2. Itens 2027 ainda presos ao portão de teste: liberar todos junto com o R1? Recomendo liberar antes, senão a equipe fica sem venda.
3. Bota Recovery vendida pela equipe: manter crédito só após pagamento (como no portal) ou liberar na hora como os demais? Recomendo manter só após pagamento. Comissão: manter sem comissão?
4. Serviços na mesma venda do plano: aceita que serviços sejam sempre venda separada (aba Serviços)? Recomendo sim.
5. "Consultoria Online - 6 meses 2026" (antigo): pode sumir da venda? Recomendo sim.
6. Desconto: hoje a venda 2027 permite desconto pela equipe; manter também em Corrida e Serviços como hoje? Recomendo manter.
