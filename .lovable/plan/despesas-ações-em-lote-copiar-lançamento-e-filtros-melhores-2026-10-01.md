# Despesas: ações em lote, copiar lançamento e filtros melhores

## 1. Seleção múltipla e ações em lote
- Caixa de seleção em cada linha e uma no cabeçalho para marcar todas as linhas visíveis (respeitando os filtros).
- Quando houver itens marcados, aparece uma barra acima da tabela: "N selecionadas · R$ total" com estas ações:
  - **Excluir** (com confirmação; só exclui as marcadas, nunca as parcelas futuras automaticamente).
  - **Dar baixa** (marca como pago usando a data de vencimento e o valor total de cada uma; data, forma e conta podem ser definidas uma vez para todas).
  - **Marcar como conciliado / não conciliado**.
  - **Limpar seleção**.
- A seleção é limpa ao trocar de período ou filtros.
- Disponível só para quem já pode editar.

## 2. Copiar lançamento
- Novo botão "Copiar" em cada linha (ao lado de Editar).
- Abre a janela de **Novo lançamento** já preenchida (fornecedor, categoria, descrição, valor, tipo, forma, conta, observação, vencimento), com status "pendente", sem data/valor de pagamento e sem conciliação.
- A opção **Repetir lançamento** fica disponível normalmente, permitindo gerar parcelas a partir da cópia.
- A cópia é um lançamento novo e independente (não fica ligada à série original).

## 3. Filtros melhores
- **Período**: atalhos "Este mês" (padrão), "Mês anterior", "Últimos 3 meses", "Este ano" e "Personalizado" (data inicial e final). O seletor atual de mês/ano continua funcionando para os cards e o gráfico.
- **Base da data**: filtrar por vencimento ou por pagamento.
- **Busca** por texto (descrição ou fornecedor).
- **Fornecedor**, **Forma de pagamento**, **Conta** e **Conciliação** (conciliado / não conciliado / todos), além dos filtros já existentes de categoria, tipo e status.
- Botão "Limpar filtros" e contador/total refletindo os filtros.

## Detalhes técnicos
- Tudo em `src/pages/financeiro/Despesas.tsx`; sem mudança no banco.
- Período personalizado busca o intervalo próprio via `useDespesasPeriodo`, separado da consulta de 12 meses dos cards/gráfico.
- Lote: `delete().in("id", ids)` / `update().in("id", ids)` (baixa em lote por id para usar o valor de cada linha), invalidando `["despesas"]`.
- Copiar: `DespesaDialog` recebe nova prop `copiaDe` usada só para valores iniciais; segue o fluxo de criação (inclusive a trava existente contra salário duplicado).
