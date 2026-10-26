# Fase 2 — Notificar: detalhe estilo e-mail (somente visual)

## Arquivos
- `src/components/notificar/NotificacaoDetail.tsx` — cabeçalho, ações, conversa.
- novo `src/components/notificar/NotificacaoAtividade.tsx` — painel "Ver atividade" (Sheet).
- `NotificacaoBadge.tsx` — só reaproveitar `PrioridadeSelo` (sem mudança, a menos que falte algo).

Não tocados: `supabase/`, `src/lib/notificar.ts`, `NotificacaoChatWindow.tsx`, `src/pages/Notificar.tsx`, testes. Campo de resposta (Textarea, ref de altura, onKeyDown, onPaste, arrastar, placeholder, sendMut) fica byte-idêntico.

## 1. Cabeçalho (3 linhas)
- a) `h2 text-xl font-semibold break-words` à esquerda; ações à direita.
- b) Avatar 40px quadrado `rounded-md bg-foreground text-background` com iniciais do remetente (`profileMap[criado_por]`); nome em negrito; abaixo "Para: ..." calculado com `useMemo` a partir de `data.dests` + `profileMap`: "você" primeiro se eu for destinatário, até 3 nomes, "+N" para o resto; um só destinatário = o nome. Data `dd/MM/yyyy HH:mm` à direita.
- c) Etiquetas: `PrioridadeSelo` só urgente/alta; categoria com `variant="outline"`; "Prazo: ..." se houver; "Aluno: Nome" (User) se houver; reunião (Calendar + data/hora, MapPin + local) quando `tipo === "reuniao"`; status discreto só para em_andamento/respondida/concluida. À direita: "N visualizaram" e botão-link "Ver atividade".
- Removidos: StatusBadge, PrioridadeBadge, CategoriaBadge secundário, caixa de rolagem da descrição e blocos com emoji.

## 2. Ações rápidas
- Sai o `<Select>` de status.
- "Concluir" (outline, Check) → `statusMut("concluida")`; se já concluída vira "Reabrir" (RotateCcw) → `statusMut("em_andamento")`. Só `isCriador`.
- Ícone Arquivar/Desarquivar (Archive/ArchiveRestore, aria-label correspondente) com `arquivarMut` e condição atual `(isCriador || myDest)`.
- Ícone "Mais ações" (MoreHorizontal) com `DropdownMenu`: "Marcar como: Em andamento" e "Marcar como: Respondida". Só criador.
- Botões `h-9`/`min-w-9` (≥36px).

## 3. Conversa
- `ScrollArea` → `<div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-4">`.
- Primeira mensagem: cartão `border rounded-md p-4 whitespace-pre-wrap` com `descricaoNotificacaoExibicao(n.descricao)` e hora `text-xs text-muted-foreground`.
- Separador de dia (HOJE / ONTEM / dd/MM/yyyy, via `isToday`/`isYesterday`) antes da descrição e sempre que o dia mudar.
- `CommentBubble`: meus `bg-foreground text-background`, outros `bg-muted`; anexos, imagem, autor e hora iguais.
- Efeito em `[id, data?.coments?.length]` rola o contêiner até o fim.
- Removidos o `Separator` e o bloco "Histórico" do fim.

## 4. NotificacaoAtividade.tsx
- Props `open, onOpenChange, hist, dests, profileMap`; `Sheet side="right"`, `SheetTitle` "Atividade" (fechar acessível já vem no Sheet).
- "Destinatários": nome + "Visualizou em dd/MM HH:mm" ou "Ainda não visualizou".
- "Histórico": ordenado por `created_at` crescente, "{h.acao.replace("_", " ")} por Nome em dd/MM HH:mm".

## Verificação
- Typecheck; `vitest run src/test/notificarResponderEnter.test.tsx` (ajuste só se um mock precisar de Sheet/DropdownMenu, sem criar teste novo).
- Conferir que `supabase/` não mudou.
