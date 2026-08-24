# Créditos de serviços avulsos: exibição e histórico de uso

## O que está acontecendo

A venda de "Reabilitação - 05 sessões" da cliente EDUARDA BORDINI FERRO foi registrada corretamente: existe o crédito de 5 sessões no controle de créditos (5 comprados, 1 já usado em uma agenda de Reabilitação).

O problema é só de tela: a aba Plano/Serviço só mostra o bloco "Serviços e Créditos Contratados" quando o aluno tem um plano ativo. Eduarda é cliente avulsa (sem plano), então a página cai no estado "Nenhum plano ativo encontrado" e a tabela de créditos nunca é desenhada. O mesmo acontece com qualquer cliente avulso de Nutrição/Reabilitação.

## O que será feito

1. **Mostrar sempre os créditos na aba Plano/Serviço**
   - Renderizar o bloco "Serviços e Créditos Contratados" também quando não há plano ativo (clientes avulsos e ex-alunos com créditos remanescentes).
   - Ajustar o texto do estado vazio para deixar claro que créditos avulsos aparecem ali.

2. **Histórico de utilização por crédito**
   - Cada linha da tabela de créditos ganha um botão de histórico que expande a lista de movimentos daquele crédito: data, tipo (compra, consumo, estorno, ajuste), quantidade e a observação (ex.: "Agenda: Reabilitação — Sala de Reabilitação").
   - Quando o consumo veio da agenda, mostrar um selo "Agenda"; quando foi manual, "Manual".
   - Ordenação do mais recente para o mais antigo.

3. **Créditos esgotados continuam visíveis**
   - Créditos com saldo zero seguem listados (marcados como "Esgotado"), para que o histórico de uso não desapareça da tela.

## Detalhes técnicos

- `src/components/student/StudentPlan.tsx`: incluir `<StudentServicos />` no retorno antecipado do caso "sem plano ativo" (mesmo local onde hoje só existem os cards de plano futuro/corrida e o `VendaDialog`).
- `src/components/student/StudentServicos.tsx`:
  - nova query por crédito expandido em `creditos_movimentos` (filtro `credito_id`, ordem `data desc`), carregada sob demanda ao abrir a linha;
  - estado local `historicoId` para controlar qual linha está expandida; linha extra de detalhe abaixo da linha do crédito, no mesmo padrão visual do histórico já usado em `StudentPlan`;
  - manter a query atual filtrando `ativo = true`.
- Sem mudanças de banco, RLS ou regra de negócio — apenas leitura e apresentação.
