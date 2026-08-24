# Visão enxuta para Nutricionista e Fisioterapeuta

Nutri e Fisio são autônomas/parceiras: o sistema deve mostrar apenas o que faz sentido para elas.

## Menu lateral — itens ocultos para Nutri/Fisio
- Ponto (não batem ponto)
- Agenda de Treinos
- Config. Mapa Corporal
- Carteira de Alunos

Todo o resto do menu segue como está hoje (Agenda de Serviços, Presenças, Avaliações, Clientes Avulsos, etc.).
Regra: só oculta quando a pessoa é nutricionista/fisioterapeuta e não é coordenação/admin.

## Dashboard — cartões e widgets ocultos para Nutri/Fisio
Cartões: Alunos Ativos, Agregadores, VIP, Em Licença, Aval. Funcional Atrasada, Avaliações Hoje, Treino Exp. Hoje, Comissionamentos.
Widgets: Alertas Administrativos, Ponto, Distribuição de Planos, Aniversariantes, Clube FORTEM.

O que permanece: Tarefas Pendentes/Atrasadas, widget de Tarefas e alertas técnicos.

## Dashboard — novo widget "Clientes com créditos disponíveis"
Lista os clientes (alunos e clientes avulsos) que têm crédito ativo e não expirado da especialidade da pessoa logada:
- Nutricionista → créditos de "Nutrição"
- Fisioterapeuta → créditos de "Reabilitação"
- Coordenação/Admin (se o widget for adicionado ao layout) → ambas

Cada linha mostra nome do cliente, atividade e quantos créditos restam (ou "ilimitado"), com clique para abrir o perfil. Também aparece um cartão-resumo no topo com o total de clientes com crédito disponível.

## Detalhes técnicos
- `useUserRoles` já expõe `isNutriFisio`; derivar `isNutriFisioOnly = isNutriFisio && !isCoordAdmin` (novo campo no hook, sem mudar chamadas existentes).
- `AppSidebar.tsx`: filtrar `PontoSidebarItem`, `Agenda de Treinos`, `Config. Mapa Corporal` e `Carteira de Alunos` quando `isNutriFisioOnly`.
- `StatsCards.tsx`: montar `row1/row2/row3` condicionalmente; pular as queries de comissionamento e de avaliação funcional atrasada quando `isNutriFisioOnly` (via `enabled`).
- `Dashboard.tsx`: novo layout default para nutri/fisio (`main: ["alerts", "clientesCreditos"]`, `side: ["tasks"]`) e registrar `clientesCreditos` no `widgetMap`.
- Novo `src/components/dashboard/ClientesCreditosWidget.tsx` + hook consultando `creditos_aluno` (join `alunos`) com `ativo = true`, validade nula ou futura, e saldo restante > 0 (reusar `creditoDisponivel`/`creditoAtivo` de `src/lib/creditos-calc.ts`), filtrando por `atividade` conforme o papel.
- Sem mudanças de banco: RLS/grants atuais de `creditos_aluno` e `alunos` já cobrem a leitura de staff. As rotas continuam acessíveis por URL; só a navegação é ocultada.
- Atualizar `src/test/useUserRoles.test.ts` para o novo campo.
