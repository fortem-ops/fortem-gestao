# Dois itens independentes: A (ponto pelo WhatsApp) e B (usuários sem papel)

Cada item tem sua própria migração e seu próprio commit; dá para aprovar e desfazer um sem o outro.

---

## A) Remover o envio de ponto pelo WhatsApp

### O que encontrei (conferido no banco e no código)
- **`whatsapp-disparo-ponto-5min`** (job 25, a cada 5 min) → função `whatsapp-disparo-ponto`, que só trata 5 gatilhos: `lembrete_entrada`, `lembrete_intervalo_inicio`, `lembrete_intervalo_fim`, `lembrete_saida`, `resumo_diario_ponto`. As 5 configurações em `whatsapp_disparos_config` estão **desligadas e em modo teste, com 0 envios no histórico**. Ou seja, o job roda 288 vezes por dia sem mandar nada.
- **`whatsapp-resumo-ponto-diario`** (job 27, 23h40 UTC, dom–sex) → função `whatsapp-resumo-ponto`. Falhou em todas as execuções desde 16/11. **Atenção:** apesar do nome, essa função não fala de ponto: ela manda para os profissionais **os agendamentos de amanhã** (`agenda_servicos`), usando a configuração "Resumo Diário de Ponto" (desligada, 0 envios). Esse aviso de agenda já é feito, e funciona, pela rotina `whatsapp-resumo-agenda-amanha` (com envios até 22/11). Por isso dá para remover sem perder nada.
- **Tela:** em Diagnóstico do Banco de Horas há o botão **"Testar resumo diário"**, que chama a função do banco `fn_admin_testar_resumo_whatsapp`. Ela só monta uma prévia da agenda de amanhã e não envia nada.
- **Tela de WhatsApp > Disparos** (`WhatsAppDisparos.tsx`): lista todas as configurações, incluindo as 5 de ponto.
- Não há gatilhos no banco nem filas próprias ligados a essas duas rotinas.

### O que fica (usado por outras partes)
- O Ponto inteiro: registro, `ponto-alertas-diarios` (job 5), `ponto-pendencias-diario` (job 16), `ponto-fechamento-mensal` (job 4) e `ponto-banco-expirar-mensal` (job 17). Nenhum deles depende das duas rotinas.
- `send-whatsapp`, `_shared/whatsapp.ts` e `_shared/agenda-template.ts` (usados pela agenda, pelas cobranças e pelo chat).
- As tabelas `whatsapp_disparos_config` e `whatsapp_disparos_log`, porque as rotinas de agenda e cobrança usam as duas. Não apago nenhum histórico.
- `ponto_feriados` e `ponto_ferias` (do Ponto).

### O que sai
1. Desligar os jobs 25 e 27 (`cron.unschedule`), pela ferramenta de dados.
2. Excluir as funções `whatsapp-disparo-ponto` e `whatsapp-resumo-ponto`, junto com as pastas delas no projeto.
3. Migração `a_remover_whatsapp_ponto`:
   - `DROP FUNCTION fn_admin_testar_resumo_whatsapp()`;
   - marcar as 5 configurações de ponto como desligadas (já estão) com o comentário "removido em 23/11/2026". As linhas ficam para manter o histórico e não quebrar referências.
4. Telas:
   - tirar o botão "Testar resumo diário" de `DiagnosticoBancoHoras.tsx`;
   - em `WhatsAppDisparos.tsx`, esconder as configurações desses 5 gatilhos (lista fixa em `src/lib/whatsappGatilhosRemovidos.ts`).
5. `src/components/disparos/AGENTS.md`: nova regra "Ponto não envia WhatsApp; os gatilhos de ponto ficam só como histórico".
6. Teste: a lista de Disparos não mostra gatilhos de ponto; os gatilhos de agenda e cobrança continuam aparecendo.

### Como desfazer A
- Reverter o commit (as funções e o botão voltam) e publicar as funções de novo.
- Recriar os jobs com o mesmo comando de antes (vou guardar os comandos originais dos jobs 25 e 27 no texto da migração).
- Recriar `fn_admin_testar_resumo_whatsapp` a partir da migração antiga em `supabase/migrations`.

---

## B) Usuários sem papel

### O que encontrei
| E-mail | Situação |
|---|---|
| igorniederauer@gmail.com | Criado em 13/04, nunca entrou. **Já não tem perfil nem papel** (sinal de uma exclusão que parou no meio). 0 registros no histórico de auditoria. Sem cadastro de aluno. |
| teste.pro@fortem.app | Já está **vinculado ao aluno BRUNA MEYER** (ativo), mas sem o papel `aluno`. |
| teste.nicolas@fortem.app | Já está **vinculado ao aluno Nicolas Squeff Janovik** (cancelado), cujo e-mail no cadastro é nicolas.janovik@gmail.com, diferente do login. Sem o papel `aluno`. |
| wingert.marcia@gmail.com | Já está **vinculado ao aluno MÁRCIA RIBEIRO WINGERT** (ativo), mas sem o papel `aluno`. |

**Por que aparecem como equipe:** a tela de Usuários lista **todo perfil**, e todo login novo ganha um perfil automaticamente. Os 6 alunos que têm só o papel `aluno` também aparecem lá. As listas de profissionais (`fn_listar_profissionais`) já filtram por papel de equipe e não mostram esses 3.

**Por que ficaram sem papel (causa encontrada):** `fn_portal_link_aluno` só dá o papel `aluno` quando ela mesma faz o vínculo. Se o cadastro de aluno já estava vinculado (vínculo feito pela equipe ou importação), ela devolve "já vinculado" e sai **sem dar o papel**.

### B1 — Corrigir a exclusão em `admin-users` (ordem segura)
Ordem nova da ação `delete`:
1. Recusar a exclusão do próprio usuário (como hoje).
2. **Checar vínculos** antes de apagar qualquer coisa: `alunos.user_id`/`responsavel_id`, `agenda_servicos` (profissional/consultor), `tarefas` (responsável/criador), `avaliacoes.avaliador_id`, `treinos.autor_id`, `contratos.criado_por`, `cobrancas.registrado_por` e as demais colunas com chave para `profiles`/`auth.users` sem exclusão em cascata (lista lida do banco: 30 colunas). Se houver vínculo, responder 409 com a lista ("Tem 3 tarefas e 1 agenda; desative em vez de excluir") e **não apagar nada**.
3. `auth.admin.deleteUser`. `user_roles` e `profiles` já saem em cascata.
4. Só se o passo 3 der certo: limpeza do que não tem cascata (sobra de `profiles`/`user_roles`, se houver) e registro no `audit_log` (quem, quem foi excluído, quando).
- Regra pura em `supabase/functions/admin-users/excluir-regras.ts` (ordem dos passos e bloqueio por vínculo), com teste de regressão: com vínculo, nada é apagado; se `deleteUser` falhar, perfil e papéis continuam lá.

Depois de publicada, excluo o igorniederauer pela própria ação (ou pela tela), já com a checagem. Se aparecer algum vínculo, paro e te mostro antes.

### B2 — Dar o papel `aluno` aos 3 (dados, não migração)
- Inserir `user_roles (user_id, 'aluno')` para teste.pro, teste.nicolas e wingert.marcia. Os vínculos com `alunos` já existem e não mudam.
- **Pergunta:** o teste.nicolas está ligado ao **seu** cadastro de aluno (Nicolas Squeff Janovik). Mantenho esse vínculo ou prefere desvincular? O plano mantém.

### B3 — Regra para não se repetir (migração `b_aluno_papel_automatico`)
- `fn_portal_link_aluno`: no caso "já vinculado", também garante o papel `aluno` (`ON CONFLICT DO NOTHING`).
- Gatilho novo em `alunos`: quando `user_id` passa a ter valor, dá o papel `aluno` a esse usuário (SECURITY DEFINER, sem execução para anon). Cobre vínculos feitos pela equipe e por importação.
- Não mexo no `handle_new_user` (gatilho do cadastro): não dá para saber, no cadastro, se é aluno ou equipe. Quem entra pelo portal sem cadastro de aluno continua sem papel e não acessa nada.
- Tela de Usuários (`AdminUsers.tsx`): mostra só quem tem papel de equipe ou não tem papel nenhum ("Sem permissão", para o admin decidir). Quem tem só o papel `aluno` some da lista. Regra pura `usuarioApareceNaEquipe(roles)` em `src/lib/authAccess.ts`, com teste.

### Testes de regressão (B)
- `usuarioApareceNaEquipe(['aluno'])` = falso; `(['professor','aluno'])` = verdadeiro; `([])` = verdadeiro (aparece como "Sem permissão").
- Exclusão: com vínculo, nada é apagado; falha no `deleteUser` não apaga perfil nem papéis.
- Teste SQL do gatilho (dentro de transação com rollback): vincular `alunos.user_id` cria o papel `aluno`.

### Como desfazer B
- B1: reverter o commit e publicar `admin-users` de novo. A exclusão do Igor não tem volta (ele nunca entrou e não tem dados).
- B2: apagar as 3 linhas de `user_roles` com o papel `aluno`.
- B3: migração que remove o gatilho e recria `fn_portal_link_aluno` como estava (o texto original fica guardado na migração).

---

## Arquivos
- A: `src/pages/DiagnosticoBancoHoras.tsx`, `src/components/whatsapp/WhatsAppDisparos.tsx`, novo `src/lib/whatsappGatilhosRemovidos.ts` + teste, `src/components/disparos/AGENTS.md`; excluir as pastas `supabase/functions/whatsapp-disparo-ponto` e `supabase/functions/whatsapp-resumo-ponto`.
- B: `supabase/functions/admin-users/index.ts`, novo `excluir-regras.ts` + teste, `src/lib/authAccess.ts`, `src/components/admin/AdminUsers.tsx`, `src/test/usuariosEquipe.test.ts`, `AGENTS.md`.
- Ao final: `bunx vitest run` e eslint nos arquivos alterados, sem `any` novo.

## Telas para testar
- A: Diagnóstico do Banco de Horas (botão sumiu, o resto funciona); WhatsApp > Disparos (sem os lembretes de ponto; os de agenda continuam); registrar um ponto normalmente.
- B: Usuários (os 3 alunos e os outros 6 alunos não aparecem; o Igor sumiu); o portal com a conta da Márcia continua entrando.
