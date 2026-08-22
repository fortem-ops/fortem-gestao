# Aviso visual "Mensalidade recusada" — relatório de investigação

## 1. Aba Resumo (`src/components/student/StudentSummary.tsx`, 1203 linhas)

A "Seção 1: Plano" (linhas 541–617) é uma grade `grid grid-cols-2 lg:grid-cols-3 gap-4` de cards `glass-card` puramente informativos: Tipo (+ badge "+ Corrida"), Frequência, Status (badge de `getDisplayStatus`), Data Final (com edição por coordenador/admin), Valor e "Aluno desde". Não há espaço natural para texto de alerta dentro dela sem quebrar o ritmo visual da grade.

O lugar natural do aviso **já existe**: a "Seção 4: Alertas do Aluno" (linhas 888–913). É um motor de alertas declarativo — um array `alerts: Alert[]` (linha 438) alimentado por vários `push` com `{ id, type, severity: 'atencao' | 'urgente', message, icon }` e renderizado num loop uniforme, com estado vazio "Nenhum alerta para este aluno 🎉".

Já existe ali um alerta financeiro quase idêntico ao proposto (linhas 442–453), vindo de `inadimplencias`:
```
Inadimplência: Venc. 12/07/2026 · 41 dia(s) em atraso — R$ 479,00
```
severidade `urgente` acima de 7 dias, ícone `DollarSign`.

Recomendação: **não criar UI nova no Resumo** — apenas mais um `push` no mesmo array, tipo `mensalidade_recusada`, ícone `CreditCard` ou `XCircle`, severidade `urgente`, mensagem no formato `⚠️ Mensalidade recusada (N tentativas): <motivo> — última em <data>`. Isso herda estilo, ordenação e responsividade sem tocar no layout.

Se quiser reforço visual no bloco Plano, a opção de menor risco é uma badge ao lado do badge de Status (linha 565), no mesmo padrão já usado pela badge "+ Corrida" — mas o alerta é o canal correto e evita duplicar a informação em dois pontos da mesma tela.

Nota: hoje o Resumo puxa `inadimplencias`, não `cobrancas`. Como só existe registro em `inadimplencias` quando a régua a gera, um aviso baseado só nela pode atrasar. Ver item 3.

## 2. Aba Pagamentos (`src/pages/alunos/ContratoFinanceiro.tsx`, 749 linhas)

A tela por contrato tem, nesta ordem:
1. `Card` de dados do contrato (valores, créditos do ciclo) — linhas ~600–639;
2. `Alert variant="destructive"` "Inadimplências em aberto" — linhas 641–664, renderizado condicionalmente acima da tabela, listando venc. + dias de atraso + valor;
3. `Card` "Cobranças" com a tabela `#, Vencimento, Pgto, Valor, Status, Recebido via, TID, Ação` — linhas 666–739. A coluna Status já é um `Badge` colorido por status (`pago` verde, `atrasado` vermelho, `cancelado` cinza, resto amarelo) e a coluna Ação mostra "Dar baixa" para pendente/atrasado.

Recomendação: **os dois, com papéis distintos** —
- **Badge na linha**, dentro da célula Status já existente (linha 693–711): abaixo do badge atual, uma segunda badge pequena `Recusada (Nx)` com `title`/tooltip do motivo. Isso ancora a informação na cobrança específica, que é o que a tabela representa — e é onde a granularidade importa, já que um contrato pode ter várias cobranças e só uma recusada.
- **Banner acima da tabela** só se houver recusa ativa, reaproveitando o padrão do `Alert variant="destructive"` de inadimplências (mesmo componente, mesmo lugar), com o motivo e a data da última tentativa. Serve para quem abre a aba e não vai ler a tabela linha a linha.

Fazer só o banner perde a granularidade; fazer só a badge deixa o aviso fácil de perder numa tabela longa. O custo de fazer os dois é baixo porque ambos os padrões já existem no arquivo.

## 3. De onde vêm os dados hoje

| Tela | Consulta cobrancas? | Query |
|---|---|---|
| Resumo (`StudentSummary`) | **Não** | `inadimplencias` (linha 424, `select id, data_vencimento, valor, status` por `aluno_id`, status `aberta`), além de `planos`, `aluno_licencas`, `creditos_aluno`, `consumo_servicos` etc. |
| Pagamentos (`ContratoFinanceiro`) | **Sim** | `cobrancas.select('*').eq('contrato_id', …)` na queryKey `["cobrancas-contrato", contrato.id]` (linhas 493–504) |
| Timeline reutilizável (`TimelineCobrancas` / `useCobrancasContrato`) | **Sim** | `cobrancas.select('*')` por contrato (`src/hooks/useContratos.ts`, linhas 147–161) |

Consequências para a Fase 3:

- **Aba Pagamentos: reaproveitamento total.** As duas queries usam `select('*')`, então as colunas novas (`tentativas`, `ultima_tentativa_em`, `motivo_recusa`) **aparecem automaticamente** assim que a migration rodar — zero mudança de query, só de render. Único ajuste: o tipo `Cobranca` em `src/types/financeiro.ts` (linhas 40–56) precisa dos três campos novos, e `ContratoFinanceiro` usa `supabase` tipado (não o `db as any` de `useContratos.ts`), então sem atualizar os tipos gerados / a interface o TS reclama.
- **Aba Resumo: precisa de uma query nova (pequena).** Não há nenhum acesso a `cobrancas` ali. O mais barato é um `useQuery` novo, filtrado no servidor, algo como `cobrancas.select('id, data_vencimento, valor, tentativas, ultima_tentativa_em, motivo_recusa').eq('aluno_id', student.id).eq('status','atrasado').gt('tentativas', 0)` — `cobrancas.aluno_id` existe e é indexado (`cobrancas_aluno_idx`), então não precisa passar por contratos. Não vale estender a query de `inadimplencias`: são tabelas diferentes e nem toda cobrança recusada terá inadimplência aberta no momento da recusa.

## Ponto em aberto para a Fase 3

O texto do aviso depende de um campo de motivo legível. Sugiro gravar na cobrança o `return_message` da Rede já traduzido (ex.: "Cartão sem limite", "Cartão expirado"), e não o `return_code` cru — a UI não deveria mapear códigos de adquirente.

## O que NÃO foi alterado

Nenhum arquivo de código e nenhuma migration foram executados nesta investigação.
