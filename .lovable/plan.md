# E5 — Esconder a Agenda no app para aluno SÓ Consultoria Online

Somente plano. Nada de código, banco, edge, cron, flags ou publicação nesta etapa.

## 1. Como saber se o aluno é "somente online"

A função `fn_aluno_somente_online(p_aluno_id)` já existe (criada na E1). Hoje ela:

- Considera os planos **vigentes**: `ativo = true` e (`data_fim` vazia, ou `data_fim >= hoje`, ou `renovacao_automatica = true`).
- Devolve **verdadeiro** só se existir pelo menos um vigente da família `consultoria_2027` **e** nenhum vigente de outra família (planos antigos sem catálogo contam como "outra família").
- Só responde para o próprio aluno, a equipe ou o servidor. Para qualquer outra pessoa, devolve falso.

Casos de borda:

| Situação | Resultado | Agenda |
|---|---|---|
| Só Consultoria vigente (Mensal ou pacote) | verdadeiro | escondida |
| Consultoria + Start/Power/Pro vigente | falso | normal |
| Consultoria + plano antigo vigente (sem catálogo) | falso | normal |
| Consultoria + Corrida | falso | normal (Corrida é presencial) |
| Consultoria vencida ou cancelada, sem outro plano | falso | normal (o mesmo que acontece hoje com qualquer aluno sem plano) |
| Sem nenhum plano | falso | normal (hoje a Agenda já recusa por falta de crédito) |
| Só Consultoria + serviço avulso comprado (ex.: Nutrição) | verdadeiro | escondida no app; a equipe marca o serviço |
| Presencial vencido + Consultoria vigente | verdadeiro | escondida |
| Gympass/Total Pass vigente + Consultoria | falso | normal |

Recomendação: **não alterar a função**. Ponto para o dono decidir: o Mensal com renovação automática continua "vigente" depois da data fim enquanto renova, o que é o comportamento certo.

## 2. Telas (só tela: E5a)

Uma consulta única no contexto do portal (`StudentPortalContext`) passa a expor `somenteOnline`, com `loading` próprio. Enquanto carrega, **nada some e nada aparece**: os pontos que levam à Agenda ficam ocultos até a resposta chegar, para não piscar.

Arquivos e mudanças:

- `src/contexts/StudentPortalContext.tsx`: consulta `fn_aluno_somente_online(student.id)`, cache de 60 s; recarrega ao trocar de aluno.
- `src/components/portal/PortalLayout.tsx`: menu inferior sem "Agenda" → grade de 4 colunas (Início, Treinos, Clube, Evolução).
- `src/App.tsx` (rota `/portal/agenda`): um guarda que redireciona para `/portal/treinos` quando `somenteOnline`; espera a consulta antes de decidir.
- `src/pages/portal/PortalHome.tsx` (linhas ~341, ~354, ~476): esconder "Remarcar", "Agendar treino" e o atalho do cartão de próximo treino/agenda.
- `src/pages/portal/PortalAssessments.tsx` (linha ~45): no lugar de "Agendar avaliação funcional", o texto "Fale com a equipe para agendar sua avaliação".
- `src/components/portal/PortalAssessmentMobile.tsx` (linha ~404): mesmo tratamento para "Agendar reavaliação".
- Notificações: `supabase/functions/processar-horarios-fixos/index.ts` envia push com `url: "/portal/agenda"`. Não muda: esse fluxo é de horário fixo criado pela equipe, e o guarda da rota já manda o aluno para Treinos. `public/sw.js` também fica igual.

Clube, Loja, Carteirinha, Treinos, Perfil, Pagamentos e Contratos continuam iguais.

## 3. Bloqueio no servidor (mexe no banco: E5b)

Funções que o **próprio aluno** chama (o aluno é identificado por `fn_current_aluno_id()`):

- `fn_agendar_treino(p_slot_id, p_data)`
- `fn_agendar_servico(p_agenda_servico_id, p_data)`, a versão de 2 argumentos (Avaliação, Nutrição, Reabilitação)

Mudança descrita (sem SQL aplicável): logo depois de achar o `_aluno_id`, se `fn_aluno_somente_online(_aluno_id)` for verdadeira, devolver `{ok:false, erro:'somente_online'}`. No app, isso vira a mensagem "Seu plano é Consultoria Online. Para agendar, fale com a equipe."

Funções que **não** mudam:

- `fn_agendar_servico_equipe`: já exige admin ou coordenador; continua permitindo que a equipe agende a avaliação.
- `fn_agendar_servico` de 5 argumentos (recebe `_aluno_id`): na E5b, confirmar quem chama. Se só a equipe chama, fica igual. Se o aluno conseguir chamar, entra no bloqueio. Hoje não está confirmado.
- `fn_cancelar_treino_agendamento`: cancelar continua liberado, para o aluno conseguir desfazer algo antigo.
- Horários fixos e o cron `processar-horarios-fixos`: são da equipe.

Também na E5b, conferir se `treino_agendamentos` ou `agenda_servicos` aceitam inserção direta pelo aluno nas regras da tabela. Se aceitarem, a regra ganha a mesma condição.

Exige **uma migração** (CREATE OR REPLACE das 2 funções, mantendo assinatura, SECURITY DEFINER, search_path e permissões).

Impacto em Start/Power/Pro: **zero**, porque para eles a função devolve falso e o restante segue igual. Como provar:

- Ensaio dentro de uma transação desfeita no NICOLAS TESTE.
- Medir antes e depois agendamento de treino e de avaliação com Start, Power e Pro, com o mesmo roteiro e impressão digital (md5 sem ids e sem datas de criação), lado a lado.
- Repetir com Consultoria só (recusa `somente_online`, nada gravado e nenhum crédito debitado) e Consultoria + Start (agenda normal).
- Equipe agendando para aluno só Consultoria por `fn_agendar_servico_equipe`: aceito.
- Contagens do NICOLAS TESTE iguais antes e depois; rollback com o texto antigo.

## 4. Riscos e como reduzir

- **Consultoria que depois compra presencial:** a função passa a dar falso na hora. No app, o cache de 60 s e uma nova consulta ao abrir o app devolvem a Agenda. Também refazer a consulta quando a janela volta ao foco.
- **Atraso da consulta** (o mesmo que fez a caixa variar na E4d): esconder os atalhos enquanto carrega e só redirecionar depois da resposta. Assim nunca aparece a Agenda para quem é online, nem some para quem é presencial. Se a consulta der erro, a tela age como hoje (Agenda visível) e o servidor (E5b) segura.
- **Pacote vence sem renovação:** o aluno volta a ver a Agenda, mas sem crédito, como qualquer aluno sem plano. Aceitável; opcionalmente revisar depois.
- **Planos antigos sem catálogo** contam como presenciais: é seguro, porque mantém a Agenda.
- **Só tela sem servidor:** quem conhece o caminho ainda conseguiria agendar. Por isso recomendo aplicar a E5b antes da E6 (ligar os itens).
- **Push antigo apontando para a Agenda:** cai no redirecionamento.

## 5. Testes

Testes automáticos (E5a):
- Menu com 4 itens quando `somenteOnline`, e 5 nos demais casos (inclusive enquanto carrega e em caso de erro).
- `/portal/agenda` redireciona para `/portal/treinos` só quando `somenteOnline`.
- Botões da Home e da Evolução: escondidos ou trocados pelo aviso.
- Suíte inteira e verificação de tipos sem mudar nenhum teste existente.

Testes no banco (E5b, transação desfeita): Consultoria-só, Consultoria + presencial, sem plano, Start/Power/Pro com impressão digital idêntica, e equipe agendando.

Manual na prévia (NICOLAS TESTE, sem venda real): a venda de Consultoria fica só dentro da transação desfeita, então a conferência visual usa uma simulação no teste de tela. A tela real só pode ser conferida depois que existir uma venda de teste autorizada pelo dono.

## 6. Sub-etapas (aprovação separada)

- **E5a — só tela:** contexto, menu, rota, Home e Evolução, mais os testes. Sem banco.
- **E5b-prep — só leitura:** quem chama `fn_agendar_servico` de 5 argumentos, as regras das tabelas de agenda, o "antes" das funções, a proposta, o diff e o rollback. Sem aplicar.
- **E5b — banco:** ensaio desfeito com impressão digital e, só se tudo bater, uma migração.
- **E5c (opcional):** mensagem `somente_online` tratada nas telas da Agenda, para o caso raro em que a tela ainda está aberta.

Não será tocado: Clube, Loja, Carteirinha, Treinos, telas da equipe, `fn_agendar_servico_equipe`, cancelamento, crons, cartão, Pix Automático, flags, catálogo (itens seguem desligados), E3d, E6 e rescisão.

## Perguntas ao dono (com recomendação)

1. Fazer E5b antes da E6? **Sim.**
2. Na Evolução, trocar o botão por "Fale com a equipe" (com WhatsApp 555135199451) ou só esconder? **Recomendo o aviso com WhatsApp.**
3. Aluno online pode cancelar um agendamento antigo pelo app? **Recomendo sim.**
