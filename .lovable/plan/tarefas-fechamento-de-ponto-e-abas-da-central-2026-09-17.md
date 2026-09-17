# Tarefas: fechamento de ponto e abas da Central

## O que está acontecendo hoje

Verificado no banco: os fechamentos de ponto de 04, 05, 06, 07 e 08/2026 estão todos com status "aprovado", mas as tarefas "Fechamento de Ponto — MM/AAAA" desses meses continuam abertas. A rotina que gera esses avisos cria uma tarefa nova para cada coordenador/administrador toda vez que roda, sem verificar se já existe uma e sem verificar se o mês já foi aprovado — por isso há tarefas repetidas do mesmo mês e elas nunca somem depois da aprovação.

## O que será feito

### 1. Limpar os avisos de meses já fechados
Apagar as tarefas de "Fechamento de Ponto" dos meses cujo fechamento já foi aprovado (04 a 08/2026). O aviso de 09/2026, que ainda está aberto, permanece.

### 2. Parar a repetição
- A rotina deixa de criar aviso duplicado: se já existe um aviso aberto daquele mês para a pessoa, nada é criado.
- A rotina não cria aviso para mês cujo fechamento já foi aprovado.
- Quando o fechamento do mês for aprovado para todas as pessoas, o aviso correspondente é apagado automaticamente.

### 3. Central de Tarefas (Principal > Tarefas)
- Remover as abas "Automáticas" e "Todas".
- Ficam apenas "Programadas" e "Atrasadas".
- Contador de Programadas em verde, contador de Atrasadas em vermelho, nas abas e no contador do menu lateral (que hoje mostra atrasadas em vermelho e automáticas em verde).

## Detalhes técnicos

- Limpeza de dados: `DELETE` em `tarefas` com `tipo_auto = 'ponto_fechamento'` cujo mês do título corresponda a competências com `ponto_fechamentos_mensais.status = 'aprovado'` — feito pelas ferramentas de consulta, não por migration.
- Migration:
  - `fn_ponto_gerar_fechamentos_mes()`: antes do `INSERT`, checar `NOT EXISTS` de tarefa aberta com mesmo `tipo_auto`, `responsavel_id` e título do mês; e não inserir se não houver fechamento pendente (`status <> 'aprovado'`) no mês.
  - `fn_ponto_aprovar_fechamento()`: após aprovar, se não restar nenhum fechamento do mês diferente de `aprovado`, `DELETE` das tarefas abertas `tipo_auto = 'ponto_fechamento'` daquele mês.
- `src/pages/TaskCenter.tsx`: remover `TabsTrigger`/`TabsContent` de `automaticas` e `todas` e o array `auto`; aplicar classes de cor semânticas (verde/vermelho) nos contadores.
- `src/hooks/useTarefasBadge.ts`: trocar a contagem de `automatica = true` por tarefas programadas (não atrasadas, em aberto).
- `src/components/AppSidebar.tsx` (`TarefasSidebarItem`): badge verde = programadas, vermelho = atrasadas.
- Verificação: typecheck, suíte de testes e build.
