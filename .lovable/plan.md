# Pagamento com cartão salvo no Portal

## Objetivo
Permitir que o aluno logado pague compras da Loja com um cartão ativo já cadastrado, sem redigitar os dados, mantendo o checkout público inalterado.

## Implementação
1. Reutilizar `usePortalCartoes`, a mesma consulta direta protegida usada em `/portal/pagamentos`, para identificar cartões ativos do aluno.
2. No checkout do Portal, após escolher cartão:
   - com cartão ativo, mostrar uma confirmação com os quatro últimos dígitos e o valor;
   - sem cartão ativo, oferecer “Inserir cartão agora” ou acesso a `/portal/pagamentos`.
3. No pagamento com cartão salvo, criar/recuperar o pedido e chamar diretamente `loja-cobrar-pedido`, usando o token de checkout já emitido para o pedido.
4. Preservar integralmente o formulário atual para visitantes e para alunos que escolherem inserir outro cartão.

## Detalhes técnicos
- A cobrança existente já resolve a tokenização ativa mais recente de `rede_tokenizacoes` pelo `aluno_id` do link e valida o cartão associado como ativo.
- A consulta reutilizada lê apenas campos mascarados de `cartoes_salvos`; as regras de acesso restringem o aluno aos próprios cartões.
- O cartão exibido seguirá a mesma ordenação de `/portal/pagamentos`; a cobrança continuará usando a seleção atual do servidor.
- Validar com o typecheck e conferir o estado final da compilação.