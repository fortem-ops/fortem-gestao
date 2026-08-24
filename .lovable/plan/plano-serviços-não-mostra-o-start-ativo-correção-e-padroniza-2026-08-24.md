# Plano/Serviços não mostra o Start+ ativo — correção e padronização da regra

## O caso relatado (verificado no banco)

Marcelo Spillari Viola tem três planos marcados como ativos, **todos com início em 23/04/2026**:

| Plano | Tipo | Atividade | Fim | Renovação automática | Criado em |
|---|---|---|---|---|---|
| a0b6e001 | Start+ | treinamento_funcional | 23/04/2027 | sim | 14/08/2026 (renovação atual) |
| a8c68250 | Corrida - Sem Plano | corrida | 23/04/2027 | sim | 14/08/2026 |
| f15e6b96 | Start+ | treinamento_funcional | 26/07/2026 | **não** | 10/06/2026 (registro antigo) |

A aba Plano/Serviços busca os planos ativos ordenando **só por data de início**. Com as três datas iguais o desempate é arbitrário, e o registro antigo (vencido em 26/07, sem renovação) pode ser escolhido; quando isso acontece a tela conclui "nenhum plano ativo" e **não tenta o próximo candidato**, mesmo existindo um Start+ vigente até 2027. As outras telas (resumo, listagem, status) já usam a regra canônica `selecionarPlanoExibicao` e por isso mostram o Start+ certo — daí a divergência.

## Casos parecidos encontrados

1. **Aba Plano/Serviços** (`StudentPlan.tsx`) — o bug relatado: ordenação por data de início, sem desempate, e descarte total ao achar um plano vencido.
2. **Portal do Aluno → Plano** (`PortalPlano.tsx`) — mesma classe de problema: escolhe o primeiro plano não-Corrida por data de criação, **sem checar vigência**. Um plano vencido criado depois do vigente passa a ser exibido como "seu plano".
3. **Regra canônica sem noção de vigência** — `queryPlanoPrincipalAtivo` (front) e `fn_plano_principal_ativo` (banco) devolvem simplesmente o plano principal ativo mais recente por data de criação, sem preferir o vigente. Hoje nenhum aluno está nessa condição (verificado), mas os consumidores dessa regra (agenda, clube, perfil e início do portal, criação de agendamento, edição de aluno, venda/renovação, além de 7+ funções SQL) ficariam errados no dia em que estiver.
4. **Causa raiz dos duplicados**: 7 alunos têm mais de um plano principal ativo ao mesmo tempo, um deles com 10 registros. A renovação via Venda cria o novo plano sem desativar o antigo. Enquanto isso existir, qualquer tela fica sujeita ao mesmo tipo de ambiguidade.

## O que fazer

### 1. Uma única regra de escolha, usada por todas as telas
Ampliar `src/lib/planoPrincipal.ts` como fonte única:
- `selecionarPlanoExibicao` continua sendo a função de escolha (ordena por data de criação, separa Corrida, prefere o vigente e nunca aborta ao encontrar um vencido).
- Acrescentar um seletor de "plano principal vigente" reutilizável para quem hoje usa a consulta direta, com fallback explícito para o mais recente quando não houver vigente.

### 2. Corrigir a aba Plano/Serviços
Em `StudentPlan.tsx`, trocar a consulta própria (ordenação por data de início + retorno vazio ao achar vencido) por: buscar todos os planos ativos do aluno e passar por `selecionarPlanoExibicao`. Créditos de serviço, licenças, planos futuros e cards de Corrida continuam iguais, apenas derivando do plano escolhido.

### 3. Corrigir o Portal do Aluno → Plano
Em `PortalPlano.tsx`, substituir o `find(primeiro não-Corrida)` pela mesma função, para o aluno nunca ver um plano vencido no lugar do vigente.

### 4. Tornar a regra canônica sensível à vigência
- Front: `queryPlanoPrincipalAtivo` passa a buscar os planos principais ativos e devolver o vigente (fallback: mais recente), mantendo a mesma assinatura — os consumidores atuais não mudam.
- Banco: `fn_plano_principal_ativo` passa a preferir o plano vigente (fim ausente, ou fim >= hoje; ou renovação automática), com fallback para o mais recente. Assim as 7+ funções SQL que dependem dela herdam a correção.

### 5. Evitar que volte a acontecer
- Na renovação/substituição de plano pela Venda, desativar o plano principal anterior (como a edição de aluno já faz), para não acumular planos principais ativos concorrentes.
- Limpeza dos duplicados já existentes (7 alunos, incluindo o Marcelo): desativar os planos principais vencidos e substituídos, mantendo o vigente. **Isso mexe em dados históricos, então só executo com sua confirmação** — a correção de exibição funciona mesmo sem a limpeza.
- Testes (Vitest) cobrindo a regra: empate de data de início com um registro antigo vencido (cenário Marcelo), plano vencido criado depois do vigente, aluno só com Corrida, aluno só com plano futuro.

## Detalhes técnicos

- `src/lib/planoPrincipal.ts`: novo helper de seleção do principal vigente + reuso de `planoVigente`/`planoDataFim`; `queryPlanoPrincipalAtivo` deixa de usar `order(created_at).limit(1)` cru.
- `src/components/student/StudentPlan.tsx`: query `["plano_ativo", student.id]` (linhas ~106–177) refeita sobre `selecionarPlanoExibicao`; remove o `return null` prematuro do bloco de vencimento.
- `src/pages/portal/PortalPlano.tsx`: linha ~98 passa a usar a função canônica.
- `src/components/student/venda/VendaDialog.tsx`: no modo substituição/renovação, desativar o plano principal anterior.
- Migração para `fn_plano_principal_ativo` (mesma assinatura e retorno; só a ordenação de preferência muda). Sem novas tabelas, sem mudança de RLS.
- Testes novos em `src/lib/__tests__/planoPrincipal.test.ts`.
