## Testar streak do Lucas

Executar duas operações no banco para validar o cálculo de streak semanal implementado no `PortalHome.tsx`.

### Passos

1. **Consulta inicial** (`supabase--read_query`): listar todos os `treino_agendamentos` do aluno `7302e67a-a11d-4089-a3c8-52e7be3bb932` ordenados por data, exibindo `id`, `data`, `horario_inicio`, `status`.

2. **Atualização de status** (`supabase--insert`): marcar como `realizado` todos os agendamentos do Lucas atualmente em `agendado` ou `confirmado`, atualizando `updated_at = now()`.

3. **Confirmação** (`supabase--read_query`): reler os agendamentos e retornar `id`, `data`, `status` para verificar que a atualização foi aplicada.

### Resultado esperado

Todos os agendamentos futuros/pendentes ficam `realizado`, permitindo que a query de streak no portal (`PortalHome.tsx`) conte as semanas consecutivas com treinos realizados/confirmados.

Nenhuma alteração de código nesta etapa — apenas manipulação de dados de teste.