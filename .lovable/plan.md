# Plano — Cupons e galeria de imagens da Loja

## Resultado esperado

- O botão **Aplicar** valida cupons reais cadastrados em Promoções, mostrando desconto e total atualizado.
- O checkout mantém o cupom aplicado e o backend recalcula tudo com segurança antes de criar o pedido.
- Produtos aceitam uma galeria geral e galerias específicas por cor, com foto principal configurável.
- A vitrine usa a foto principal geral; nos detalhes, miniaturas permitem alternar entre frente, costas e outras visões.

## Implementação

### 1. Cupons funcionais

- Criar validação segura no backend para código, status ativo, período de validade e limite de uso.
- Calcular desconto percentual ou fixo sobre os preços atuais, limitando o desconto ao valor do pedido.
- Integrar o carrinho com estados de aplicar, remover, cupom inválido/expirado/esgotado e resumo de subtotal, desconto e total.
- Enviar o código aplicado ao checkout e à criação do pedido; o backend fará nova validação e gravará `promocao_id`, `desconto` e `valor_final`.
- Atualizar o uso do cupom de forma transacional para impedir ultrapassar o limite configurado.
- Para cupom de 100%, concluir o pedido como pago sem tentar uma cobrança de R$ 0,00, preservando estoque, histórico e confirmação.
- Manter os valores do frontend apenas como prévia; pagamentos PIX e cartão sempre usarão o total final gravado no pedido.

### 2. Galeria geral e por cor

- Criar uma tabela de imagens ligada ao produto, com URL, legenda/visão, ordem, indicação de principal e cor opcional.
- Aplicar permissões: leitura pública somente para imagens de produtos ativos; cadastro, edição, ordenação e exclusão somente para Coordenador/Admin.
- Preservar `imagem_url` atual como compatibilidade para produtos já cadastrados e migrá-la como primeira imagem principal quando necessário.
- No cadastro do produto, substituir o upload único por um gerenciador de galeria que permita:
  - enviar várias fotos;
  - nomear a visão, como “Frente” e “Costas”;
  - escolher a principal;
  - reordenar e remover fotos.
- No gerenciamento das variantes, permitir uma galeria específica por cor com os mesmos controles. Essa galeria valerá para todos os tamanhos daquela cor.

### 3. Exibição na Store

- Carregar as galerias junto aos produtos sem duplicar a lógica entre Loja pública e Portal do Aluno.
- Na grade, mostrar a foto principal geral, com fallback para a imagem antiga.
- Nos detalhes, exibir a principal em destaque e as demais como miniaturas clicáveis abaixo.
- Ao escolher uma cor com galeria própria, trocar para as fotos daquela cor; sem galeria específica, usar a galeria geral.
- Atualizar a imagem adicionada ao carrinho para refletir a principal da cor selecionada.

## Validação

- Testar cupom percentual, valor fixo, inválido, inativo, fora da validade, esgotado e de 100%.
- Confirmar que alteração de preço/cupom entre carrinho e pagamento é revalidada pelo backend.
- Testar upload, principal, ordenação, remoção, fallback geral e troca de galeria por cor.
- Verificar Loja pública e Portal em telas desktop e mobile.
- Rodar typecheck, testes direcionados e conferir o build e os erros do navegador.

## Detalhes técnicos

- Reutilizar o bucket `loja-produtos` e o controle de upload existente.
- A nova tabela pública receberá `GRANT`, RLS e políticas na mesma migration.
- A criação do pedido continuará centralizada em `fn_loja_criar_pedido`; o cliente não poderá definir diretamente desconto ou valor final.
