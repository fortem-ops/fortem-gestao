# Promoções 10 anos — Fase 3 (tela da equipe + aviso interno)

## 1. Menu e permissão
- Novo item "Promoções 10 anos" na lista `comercialAdminItems` do menu lateral (grupo Comercial, junto de Pipeline e Disparo de Mensagens), visível só para admin.
- Rota `/comercial/promocoes-10-anos` protegida com `ProtectedRoute requireStaff` + checagem de admin (coordenador e demais papéis veem "sem acesso"); passa pelo 2FA da equipe como as outras telas.
- Os dados continuam vindo da RLS já existente de `promo10_interesses` (só admin). Nada novo exposto a anon ou a não-admin.

## 2. Tela
- Topo: cartões com quantidade e soma do valor promocional por status (novo, contatado, fechado, desistiu) e por segmento (upgrade, Wellhub, TotalPass, ex-aluno, corrida).
- Tabela: código P10-xxxx, nome do aluno com link para o perfil, segmento, oferta legível ("Upgrade 2x → 3x", "Pro Semestral Wellhub", "Power 2x anual (ex-aluno)", "Corrida 6+1 · tabela Start+"), valor promocional, sem desconto, economia, data/hora, status, observação.
- Filtros de status e segmento, busca por nome ou código, ordenação mais recentes primeiro.
- Painel lateral ao abrir: todos os detalhes gravados (upgrade: frequência atual/destino, início do ciclo, data final, dias do ciclo atual, ciclos completos, quebra do cálculo); botão WhatsApp do aluno (telefone do cadastro) com mensagem pronta citando o pedido; observação; troca de status novo → contatado → fechado/desistiu, mostrando quem e quando (`atualizado_por`/`atualizado_em`, já preenchidos pelo gatilho da Fase 1).
- Upgrade: "Valor no dia do interesse" (gravado) e "Valor para hoje" (recalculado no servidor), com aviso quando forem diferentes.

## 3. Recálculo do upgrade (sem expor a função)
- `fn_promo10_ofertas` continua sem EXECUTE para anon/authenticated.
- Nova função `fn_promo10_admin_recalcular(p_interesse_id)` SECURITY DEFINER: confere `is_admin(auth.uid())`, lê o interesse, chama `fn_promo10_ofertas` para o aluno e devolve só o valor/quebra da mesma frequência de destino para hoje (ou "oferta não disponível hoje", ex.: plano encerrou). EXECUTE só para authenticated (recusa não-admin por dentro), revogado de anon.

## 4. Aviso interno aos admins
- Reaproveita o mesmo mecanismo já usado pelo checkout do /planos: insert em `notificacoes` + `notificacao_destinatarios` para todos os `user_roles` admin (aparece no Notificar/sino).
- Disparado na edge function `promo10-publico`, após gravar o interesse (novo ou troca da oferta principal; atualização idêntica sem mudança não avisa de novo).
- Título: "Promoções 10 anos: novo interesse P10-xxxx — <primeiro nome> — <oferta> — R$ x". Categoria comercial, prioridade média, tipo simples. Sem CPF, sem e-mail. Nada enviado ao aluno. Falha no aviso não impede o registro do interesse.
- Não gera push (gatilho não está na lista aprovada do push da equipe).

## 5. Limpeza dos testes (só quando você pedir)
- Comando pronto, rodado manualmente: apagar de `promo10_interesses` apenas as linhas cujo `aluno_id` está em `sistema_config.promo10_codigo_email_teste_ids`, primeiro mostrando a contagem e os códigos (hoje há 1 linha, status novo — o P10-0001). Nenhuma outra linha é tocada; avisos internos de teste ficam no histórico.

## Testes
- Montagem do texto legível da oferta (upgrade, semestrais Wellhub/TotalPass, ex-aluno, corrida com tabela).
- Resumo por status/segmento (contagem e soma).
- Mensagem do aviso interno: formato exato, sem CPF/e-mail, só primeiro nome.
- Mensagem pronta do WhatsApp citando o pedido.
- Regra de aviso: interesse novo e troca de oferta avisam; reenvio igual não avisa.
- Banco: recálculo recusa não-admin; anon sem EXECUTE.
- `bunx vitest run` completo e eslint dos arquivos alterados, sem `any`.

## Fora desta fase
Cobrança, venda/contrato a partir do interesse, envio automático de WhatsApp/e-mail, publicação, liberar código para todos.
