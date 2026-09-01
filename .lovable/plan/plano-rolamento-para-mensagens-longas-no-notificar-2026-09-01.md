# Plano: Rolamento para mensagens longas no Notificar

## Objetivo
Permitir ler notificações com descrições longas dentro da janela flutuante de chat do Notificar, sem que o texto ocupe toda a altura e empurre os comentários para fora da viewport.

## Problema atual
Em `src/components/notificar/NotificacaoChatWindow.tsx`, a descrição da notificação é renderizada em uma `<div className="text-xs bg-muted/40 rounded p-2 whitespace-pre-wrap">{n.descricao}</div>` sem altura máxima nem scroll próprio. Com mensagens extensas, essa div cresce indefinidamente, dificultando a leitura completa e comprometendo o layout dos comentários abaixo.

## Solução proposta
1. **Limitar e rolar a descrição**: envolver a descrição da notificação em um componente `ScrollArea` (ou `overflow-y-auto`) com altura máxima (`max-h-32` / ~128 px), permitindo rolagem interna quando o texto for longo.
2. **Manter o scroll geral**: o `ScrollArea` externo da janela continua com `flex-1`, garantindo que a lista inteira de mensagens também seja rolável.
3. **Indicador visual**: adicionar uma sombra/leve fade na parte inferior da caixa de descrição quando houver overflow, sinalizando que existe mais conteúdo.

## Escopo
- Alterar apenas `src/components/notificar/NotificacaoChatWindow.tsx`.
- Nenhuma mudança em backend, RLS, hooks ou contexto.

## Critérios de aceitação
- Mensagens longas na descrição da notificação ficam confinadas a uma área com rolagem.
- O restante da janela (comentários e input) continua acessível e funcional.
- Build e testes existentes continuam passando.
