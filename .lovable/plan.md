# Fase 1 — Notificar estilo caixa de entrada (só visual)

Nenhuma mudança em banco, `supabase/`, `NotificacaoDetail.tsx` ou `src/lib/notificar.ts`. Realtime e regras de arquivada/concluída mantidas.

## Arquivos

### src/hooks/useNotificacoes.ts
- Novo `useComentariosResumo(ids: string[])`: chave `["notif","coment-resumo", idsOrdenados]` (fica sob `["notif"]`, então o realtime já invalida). Uma consulta `notificacao_comentarios.select("notificacao_id,usuario_id,anexo_url").in("notificacao_id", ids)`, desativada com lista vazia.
- Retorna um mapa por id: `{ total, temAnexo, temDeOutro(userId) }` (guarda os autores para a regra "Aguardando resposta").
- `useUnreadCount` e os outros hooks não mudam.

### src/components/notificar/NotificacaoBadge.tsx
- Novo `PrioridadeSelo`: "URGENTE" (bg-foreground text-background) ou "ALTA" (só borda); `null` para média/baixa. Os badges atuais continuam para o detalhe.

### src/components/notificar/NotificacaoListItem.tsx (novo)
- Botão com 3 linhas: remetente + hora (HH:mm hoje, dd/MM antes), título + selo, prévia de uma linha (`descricaoNotificacaoExibicao`) + clipe/balão com total.
- Não lida: quadrado de 8px bg-primary e textos em negrito/semibold. Selecionada: bg-muted e barra de 3px primary à esquerda. Sem categoria/status.

### src/pages/Notificar.tsx (reescrita do layout)
- Grade `md:grid-cols-[232px_380px_1fr]`, altura atual.
- Pastas: "Nova notificação" no topo; Caixa de entrada (com contagem de não lidas), Enviadas, Aguardando resposta (com contagem), Arquivadas. Ativa: barra de 3px primary + bg-muted. Abaixo de md: linha horizontal de botões com rolagem.
- Regras:
  - Caixa: recebidas não arquivadas (global ou do destinatário).
  - Enviadas: criadas por mim, sem arquivada/concluída.
  - Aguardando: criadas por mim, sem concluída/arquivada e sem comentários de outra pessoa.
  - Arquivadas: recebidas arquivadas (mesma regra de hoje) mais enviadas arquivadas/concluídas, sem duplicar ids.
- Lista: busca por título, descrição e nome do remetente (via `["profiles-map"]`, mesma consulta do detalhe). Chips Todas / Não lidas / Alta prioridade (alta+urgente) / Com prazo, com o ativo invertido; seletor de Categoria mantido e seletor de prioridade removido. Tudo combinado.
- Agrupamento em HOJE / ONTEM / ANTERIORES pela data local de `created_at`. Lista vazia: "Nenhuma notificação neste filtro."
- Detalhe: `<NotificacaoDetail id={selected} />` sem mudanças, num container com borda. Trocar de pasta limpa a seleção.

## Ponto a confirmar
- **"Para:" em Enviadas:** a lista não tem os destinatários. Para não criar uma segunda consulta além da de comentários, mostro o remetente (o próprio usuário) como fallback. Se você quiser "Para: N destinatários", acrescento uma consulta leve a `notificacao_destinatarios` só no cliente. Diga se aprova.
- **Pasta Arquivadas:** hoje, na aba Arquivadas, só aparecem as recebidas. Pretendo incluir também as enviadas arquivadas, para nada sumir quando sai de Enviadas. Diga se prefere manter só as recebidas.

## Verificação
- Typecheck, suíte de testes e checagem do build.
- Playwright logado: conferir pastas, chips, busca, agrupamento e console; arquivar/desarquivar move a conversa entre Caixa de entrada e Arquivadas.
