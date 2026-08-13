# Filtro de profissionais na Agenda de Serviços mostra apenas quem já tem agenda

## Diagnóstico (confirmado)

Yasmim Rodrigues Avila existe como profissional (perfil ativo, papel `professor`), mas hoje ela tem **0 registros** na agenda de serviços.

O filtro "Todos os profissionais" da Agenda é montado a partir dos agendamentos já carregados na tela: só entra na lista quem aparece como responsável em algum evento. Por isso a Yasmim (e qualquer profissional sem agenda) fica de fora.

## O que muda

O filtro de profissionais passa a listar **todos os profissionais cadastrados** (admin, coordenador, professor, nutricionista, fisioterapeuta), em ordem alfabética — a mesma lista que já é usada no formulário de criação de agendamento. Assim a seleção fica consistente entre criar e filtrar.

Comportamento mantido: o filtro continua funcionando igual; selecionar alguém sem agenda simplesmente mostra a semana vazia para aquele profissional.

## Detalhes técnicos

- `src/pages/Agenda.tsx`: substituir o `useMemo` `opcoesProfissional` (derivado de `agendas`) por uma query TanStack que busca `user_roles` + `profiles`, reaproveitando a mesma chave/lógica de `AddAgendaDialog.tsx` (`profiles_all`), mapeando para `{ value: user_id, label: full_name }`.
- Nenhuma mudança de banco, RLS ou lógica de filtragem dos eventos.
