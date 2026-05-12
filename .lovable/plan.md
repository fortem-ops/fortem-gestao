# Plano: Módulo Venda (Planos & Serviços)

## Visão geral

Criar catálogos administrativos de **Planos** e **Serviços** (modelos comerciais reutilizáveis), botão **Venda** no `Aluno > Plano/Serviço`, registro financeiro de **Vendas** e ledger de **Créditos** por atividade. Tudo integrado ao fluxo já existente (planos do aluno, agenda, dashboard, pipeline).

## Banco de dados (uma migration)

**Catálogos:**
- `planos_catalogo` — `nome`, `periodo_meses` (int: 1, 12...), `frequencia` (enum: `1x|2x|3x|livre`), `quantidade_creditos` (int, nullable), `ilimitado` (bool), `valor` (numeric), `cor` (text hsl/hex), `ativo` (bool). Pré-popular com Start, Start+, Power, Pro, Max, Gympass/Wellhub, Total Pass.
- `servicos_catalogo` — `nome`, `atividade` (text), `quantidade_sessoes` (int), `valor` (numeric), `ativo` (bool). Pré-popular Nutrição, Reabilitação, Avaliação Funcional.

**Comercial:**
- `vendas` — `aluno_id`, `tipo` (`plano|servico`), `catalogo_id`, `nome_snapshot`, `valor`, `vendedor_id`, `data_venda`, `status_pagamento` (`pendente|pago|cancelado`), `plano_id` (fk opcional para o `planos` gerado), `observacoes`.
- `creditos_aluno` — `aluno_id`, `origem_tipo` (`plano|servico`), `origem_id` (venda_id), `atividade` (text — ex: "Treino", "Nutrição", "Reabilitação", "Avaliação Funcional"), `quantidade_inicial`, `quantidade_usada`, `ilimitado` (bool), `data_validade` (nullable), `ativo`.
- `creditos_movimentos` — ledger: `credito_id`, `tipo` (`compra|consumo|estorno|ajuste`), `quantidade`, `agenda_id` (fk opcional), `registrado_por`, `data`.

**RLS:** catálogos = leitura todos autenticados, escrita coord/admin. Vendas/créditos = coord/admin escrita; leitura restrita ao responsável do aluno + coord/admin + próprio aluno (portal).

**Trigger:** ao inserir `vendas` com `tipo='plano'` e `status_pagamento != 'cancelado'`, função SQL gera linha em `planos` (data_inicio = hoje, duração = `periodo_meses` do catálogo, ativo=true, tipo=nome do catálogo, valor) e cria `creditos_aluno` para a atividade "Treino" conforme tabela de regras (1x→4/52, 2x→8/104, 3x→12/156, livre→ilimitado). Para `tipo='servico'`, cria apenas `creditos_aluno` com a atividade do serviço.

## Telas

### 1. Cadastros > Planos (substitui `AdminPlanos.tsx` atual)

Refatorar `src/components/admin/AdminPlanos.tsx` para CRUD de **catálogo** (não mais instâncias por aluno). Tabela com colunas Nome, Período, Frequência, Créditos, Valor, Cor, Ativo. Dialog de criar/editar com:
- Nome (input livre, com sugestões pré-cadastradas)
- Período (select 1/12, "+ adicionar")
- Frequência (select 1x/2x/3x/Livre)
- Quantidade de créditos (auto-calculada conforme regra, editável)
- Valor (R$)
- Seletor de cor (color picker + presets: cinza, branco, vermelho, preto, vermelho escuro, roxo, azul)
- Toggle Ativo

### 2. Cadastros > Serviços (nova aba `Admin.tsx`)

Novo `src/components/admin/AdminServicos.tsx` (substitui `AdminComingSoon` da aba "Serviços"). CRUD: Nome, Atividade (dropdown editável), Quantidade de sessões, Valor, Ativo.

### 3. Botão "Venda" em `StudentPlan.tsx`

Adicionar botão verde **Venda** no header da aba Plano/Serviço. Abre `<VendaDialog>` (novo: `src/components/student/venda/VendaDialog.tsx`) com:
- Tabs **Planos** / **Serviços**
- Cards estilo CRM (arredondados, badge colorido) listando catálogo `ativo=true`
- Cada card tem botão **Vender** → confirma → insere em `vendas` (status `pendente`) → trigger gera plano + créditos → toast → invalida queries.

### 4. Histórico de vendas

Componente `src/components/student/venda/HistoricoVendas.tsx` renderizado abaixo do plano atual. Tabela: Data, Tipo, Nome, Valor, Vendedor, Status (badge editável por coord/admin: pendente→pago/cancelado), Créditos restantes (lookup em `creditos_aluno`).

### 5. Integração Carteira/Dashboard/Pipeline

- Carteira (`CarteiraAlunos.tsx`): já lê `planos`, sem mudança imediata.
- Dashboard widget de planos: continua funcionando (lê `planos`).
- Pipeline: trigger `trg_plano_pipeline` já move para "Aluno ativo" ao criar plano — funcionará automaticamente.
- `consumo_servicos`: manter compatibilidade; novo ledger `creditos_movimentos` é usado para créditos vindos de vendas.

## Arquivos novos
- `src/components/admin/AdminServicos.tsx`
- `src/components/student/venda/VendaDialog.tsx`
- `src/components/student/venda/HistoricoVendas.tsx`
- `src/lib/vendas.ts` (helpers: cálculo de créditos por frequência/período, formatação)
- migration SQL única

## Arquivos editados
- `src/components/admin/AdminPlanos.tsx` (refatorar para catálogo)
- `src/pages/Admin.tsx` (montar AdminServicos)
- `src/components/student/StudentPlan.tsx` (botão Venda + render Histórico)

## Fora do escopo (preparado mas não implementado)
- Assinatura digital, Apple/Google Wallet, comissão por vendedor, gateway de cobrança recorrente, alertas de plano vencendo (estrutura suporta, lógica fica para próxima fase).
