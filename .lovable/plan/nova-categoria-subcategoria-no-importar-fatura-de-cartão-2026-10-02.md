# Nova categoria/subcategoria no Importar Fatura de Cartão

## Objetivo
Permitir cadastrar uma categoria central ou subcategoria nova direto na tela de revisão da fatura, sem sair do fluxo — hoje só dá para criar subcategorias na aba Cadastros de Despesas, e centrais não são criadas pela interface.

## O que muda

### 1. Botão "Nova" ao lado do seletor de categoria
Em `src/components/financeiro/ImportarFaturaDialog.tsx`, ao lado do campo de categoria de cada linha (ou um único botão no topo da lista de revisão), um botão "Nova categoria" abre um pequeno diálogo.

### 2. Diálogo de cadastro rápido
Dois modos escolhidos dentro do próprio diálogo:
- **Subcategoria**: escolhe a categoria central existente, informa o nome (e ordem opcional). Reutiliza a mutação `salvarSub` já existente em `useCategoriaMutations` — o código (`X.N`) e a ordem saem automáticos.
- **Categoria central**: informa o nome. Nova mutação `salvarCentral` em `src/hooks/useDespesas.ts`: insere em `despesas_categorias` com `nivel='central'`, `codigo` = próximo número inteiro após o maior código central existente, `ordem` automática, `tipo` padrão `variavel`.

### 3. Após salvar
- A lista de categorias é recarregada (invalidação já existente).
- A categoria recém-criada é selecionada automaticamente na linha que estava sendo editada (quando aberto a partir de uma linha).
- Mensagens de erro amigáveis (ex.: nome duplicado).

## Fora do escopo
- Não muda categorização automática por regras, exclusão de linhas, criação da despesa nem o fluxo de pagamento automático.
- Não mexe na aba Cadastros de Despesas (ela continua funcionando como está).

## Detalhes técnicos
- Arquivos: `src/components/financeiro/ImportarFaturaDialog.tsx` (botão + diálogo), `src/hooks/useDespesas.ts` (mutação `salvarCentral`).
- Sem migração de banco: a tabela `despesas_categorias` já tem `nivel`, `codigo`, `ordem` e RLS de coordenador/admin.
- Validação ao final: `tsgo --noEmit` e build.
