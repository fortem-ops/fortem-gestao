# Plano — Cupom 20OFF com um clique na Store

## Resultado esperado

- A vitrine da Store mostra uma faixa de destaque: "20% OFF com o cupom 20OFF — válido até 27/09".
- Com um clique na faixa, o cliente vai ao carrinho com o cupom 20OFF já aplicado, vendo o desconto e o total atualizado.
- A faixa some automaticamente após 27/09 (23:59, horário de Brasília).
- Funciona na loja pública e na loja do Portal do Aluno, sem alterar preços, promoções ou outros fluxos.

## Situação atual (confirmado)

- O cupom 20OFF já está cadastrado: 20% de desconto, ativo, válido de 14/09 até 27/09, sem limite de uso.
- O carrinho já valida cupom pelo botão Aplicar (função segura no backend); falta apenas o atalho de um clique.

## Implementação

### 1. Faixa promocional na vitrine

- Em `src/pages/store/StoreIndex.tsx`, abaixo do cabeçalho da página, renderizar uma faixa clicável com o texto promocional, ícone de etiqueta e chamada "Toque para aplicar".
- Exibir somente enquanto a data atual estiver dentro da validade (até 27/09 23:59 BRT) — checagem local por data; a validação real continua no backend ao aplicar.
- Estilo usando a paleta da Store (`storePalette`), respeitando tema claro/escuro e o tema forçado escuro do Portal.

### 2. Aplicação com um clique

- Ao clicar, gravar o código `20OFF` em `sessionStorage` (chave `fortem-loja-cupom-pendente`) e navegar para `${basePath}/carrinho`.
- Em `src/pages/store/StoreCart.tsx`, ao montar (carrinho não vazio, fora do checkout e sem cupom aplicado), ler a chave; se houver código pendente, preencher o campo e chamar a mesma validação existente de `aplicarCupom` automaticamente, removendo a chave em seguida.
- Se o cupom falhar (expirado/esgotado), mostrar a mensagem de erro já existente e limpar o campo.

## Fora do escopo

- Não cria nem altera promoções no banco (20OFF já existe).
- Não muda checkout, pagamento, estoque ou cálculo de desconto.

## Validação

- Typecheck (`bunx tsgo --noEmit`) e build.
- Verificação visual com Playwright: faixa visível na vitrine, clique leva ao carrinho com desconto de 20% aplicado; após simular data futura, a faixa não aparece.

## Detalhes técnicos

- Arquivos: `src/pages/store/StoreIndex.tsx` (faixa), `src/pages/store/StoreCart.tsx` (auto-aplicação).
- Reuso total do fluxo atual de cupom (`loja-validar-cupom`); nenhuma regra de negócio no frontend além da exibição por data.
