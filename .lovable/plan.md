# Banners de avaliações pendentes no Dashboard

Adicionar avisos contextuais no Dashboard, no mesmo estilo do banner "Você ainda não bateu o ponto hoje", para lembrar o professor de registrar avaliações de sessões já agendadas que ainda não foram realizadas.

Dois tipos de pendência:

1. **Treino Experimental** agendado → exige "Nova Avaliação → Experimental" para aquele aluno.
2. **Avaliação Funcional** agendada → exige **as duas**: "Nova Avaliação → Funcional" **e** "Nova Avaliação → Força" para aquele aluno. A pendência só é concluída quando ambas existirem.

## Comportamento

- **Quem vê:** apenas o profissional logado (não aparece para Coord/Admin, igual ao lembrete de ponto).
- **Quando aparece:** a partir do `horario_inicio` do agendamento, no próprio dia e em todos os dias seguintes, até que a(s) avaliação(ões) correspondente(s) seja(m) registrada(s). Se o professor demorar 5 dias, o banner permanece nos 5 dias.
- **Quando desaparece (persistente, não restrito ao dia):** quando, para aquele agendamento, existir(em) registro(s) em `avaliacoes` com `aluno_id` do agendamento e `data >= data do agendamento`, atendendo:
  - **Treino Experimental:** existe pelo menos uma avaliação `tipo = 'experimental'`.
  - **Avaliação Funcional:** existem **ambas** — uma `tipo = 'funcional'` **e** uma `tipo = 'forca'`. Se só uma das duas foi feita, o banner permanece e o texto indica o que ainda falta.
  - O `avaliador_id` não é exigido (qualquer profissional pode ter realizado).
- **Um banner por aluno/sessão pendente:** lista vertical.
- **Textos:**
  - Treino Experimental: "Você ainda não realizou a avaliação do treino experimental do aluno **{Nome}**".
  - Avaliação Funcional (nenhuma das duas feita): "Você ainda não realizou a avaliação funcional (Funcional + Força) do aluno **{Nome}**".
  - Avaliação Funcional (só Funcional feita): "Falta registrar a avaliação de **Força** do aluno **{Nome}**".
  - Avaliação Funcional (só Força feita): "Falta registrar a avaliação **Funcional** do aluno **{Nome}**".
  - Botão "Avaliar" navega para `/avaliacoes?aluno={id}&new=1` (a página `Avaliacoes` já suporta esses params).
- **Dispensar:** ícone X com dismiss local de 24h por par (`aluno_id` + `data_agendamento` + tipo do agendamento). O dismiss não apaga a pendência — ela volta após 24h se ainda não houver conclusão. Sem dismiss, o banner fica fixo até a conclusão.
- **Estilo visual:** mesma estética do `LembretePontoBanner` no estado "nao_iniciado" (borda/fundo `warning`, ícone `ClipboardCheck`/`Dumbbell`).

## Onde encaixa

`src/pages/Dashboard.tsx` já renderiza `<LembretePontoBanner />` logo abaixo do header. O novo componente `<LembreteAvaliacoesPendentesBanner />` será renderizado imediatamente abaixo dele, antes de `<StatsCards />`. Um único componente cuida dos dois tipos.

## Detalhes técnicos

- Novo arquivo: `src/components/dashboard/LembreteAvaliacoesPendentesBanner.tsx`.
- `useQuery` com chave `["lembrete-avaliacoes-pendentes", user.id]`, `refetchInterval: 60_000`:
  1. Buscar em `agenda_servicos` todos os itens do professor logado em que:
     - `profissional_id = user.id`
     - `atividade IN ('Treino Experimental','Avaliação Funcional')`
     - data efetiva da sessão `<= hoje` e `>= hoje - 60 dias`. Data efetiva:
       - `data_especifica` quando `tipo='avulso'`;
       - para `tipo='fixo'`, expandir as ocorrências dos últimos 60 dias a partir de `dia_semana`.
     - Excluir datas presentes em `agenda_servicos_excecoes` para o `agenda_id`.
     - Para a ocorrência de hoje, exigir adicionalmente `horario_inicio <= agora` (filtro no client).
  2. Buscar em `alunos` o `nome` dos `aluno_id` envolvidos.
  3. Buscar em `avaliacoes` (`select aluno_id, tipo, data`) os registros dos alunos envolvidos com `data >= menor data agendada`.
  4. Para cada agendamento pendente, classificar como concluído/parcial/pendente:
     - **Treino Experimental:** concluído se existe `tipo='experimental'` com `data >= data_agendamento`.
     - **Avaliação Funcional:** concluído **somente** se existem ambos `tipo='funcional'` e `tipo='forca'` com `data >= data_agendamento`. Caso contrário, gera item de banner com o(s) tipo(s) faltante(s).
  5. Ordenar por data (mais antigas primeiro) e renderizar um banner por item.
- Dismiss: `localStorage` com chave `lembrete-aval-dismiss:{aluno_id}:{data_agendamento}:{tipo_agendamento}` guardando timestamp; TTL de 24h.
- Invalidar `["lembrete-avaliacoes-pendentes"]` ao salvar uma nova avaliação no `AssessmentForm`, para o banner sumir imediatamente sem esperar o refetch de 60s.
- Sem alterações de backend, RLS, RPC ou edge functions.

## Arquivos

- **Criar:** `src/components/dashboard/LembreteAvaliacoesPendentesBanner.tsx`
- **Editar:** `src/pages/Dashboard.tsx` (renderizar o novo banner abaixo de `<LembretePontoBanner />`).
- **Editar (mínimo):** componente de submissão de nova avaliação (`AssessmentForm`) para invalidar a query do banner após salvar.
