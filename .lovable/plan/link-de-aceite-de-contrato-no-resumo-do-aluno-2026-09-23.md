# Link de aceite de contrato no Resumo do aluno

## Objetivo
No card "Contrato" do Resumo (StudentSummary.tsx), quando o contrato estiver "Pendente de aceite", permitir gerar e copiar o link público de aceite com um clique.

## O que já existe
- A aba Contrato do aluno já tem "Copiar link de aceite" (ContratoFinanceiro.tsx, função `copiarLinkAceite`): chama a RPC `fn_criar_link_contrato` com o documento do contrato e copia `<origem>/contrato/<token>` para a área de transferência. Link válido por 7 dias.
- O card do Resumo já tem o documento do contrato carregado (`contratoDoc`) e mostra "Pendente de aceite" quando `aceite = false`.

## Mudança (somente frontend, src/components/student/StudentSummary.tsx)
1. No card "Contrato", quando houver `contratoDoc` e `aceite = false`, mostrar um botão com ícone de link (Link2) ao lado dos ícones existentes (lápis/olho), visível para coordenação/admin (`isCoordAdmin`), com título "Copiar link de aceite".
2. Ao clicar: chamar `fn_criar_link_contrato` com `contratoDoc.id`, montar a URL `/contrato/<token>`, copiar para a área de transferência e mostrar toast "Link copiado! Válido por 7 dias." — mesma lógica e mensagens da aba Contrato.
3. Estado de carregamento no botão (spinner) enquanto gera; erro mostra toast destrutivo com o motivo.
4. Se não houver documento de contrato ("Sem contrato"), o botão não aparece.

## Fora de escopo
- Nenhuma mudança em banco, RPC ou edge function (reutiliza `fn_criar_link_contrato` existente).
- Não envia por WhatsApp nem e-mail (decidido: só copiar).
- Não altera a aba Contrato nem o portal do aluno.

## Verificação
- Tipos e build sem erros.
- Conferir no preview: card de um aluno com contrato pendente mostra o botão, copia o link e o link abre a página pública de aceite.
