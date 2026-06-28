## Diagnóstico

O Lourival **existe** como prospect na base (`stage = "Prospect"`, `status = "prospect"`) e a lógica de classificação em `AddAgendaDialog.tsx` o marcaria corretamente como `tipo: "prospect"` (apenas `"lead"` é filtrado). O problema é outro:

- A tabela `alunos` tem **1.724 registros**.
- A query atual em `AddAgendaDialog.tsx` (linha 161-183) faz `supabase.from("alunos").select(...).order("nome")` **sem `limit`/`range`**, e o PostgREST aplica o teto padrão de **1.000 linhas**.
- Ordenado por nome, "Lourival" cai depois do corte → ele simplesmente nunca chega ao cliente, então a busca local não acha nada.

Há um segundo registro homônimo (`LOURIVAL MAY CHULA`) que é um lead — esse continua corretamente oculto.

## Correção

Trocar a busca local (filtra em memória sobre lista truncada) por **busca server-side** com `ilike`, que escala e devolve qualquer aluno/prospect independente do volume.

### Alterações em `src/components/agenda/AddAgendaDialog.tsx`

1. **Substituir a query `alunos_agenda_picker`** por uma query parametrizada pelo termo de busca:
   - `queryKey: ["alunos_agenda_picker", debouncedSearch]`
   - `enabled: debouncedSearch.trim().length >= 2` (evita carregar 1.724 linhas à toa)
   - Filtro: `.or("nome.ilike.%termo%,email.ilike.%termo%")` + `.limit(50)` + `.order("nome")`
   - Mantém o JOIN lógico com `pipeline_stages` (busca todos os stages — são poucos) para classificar `tipo`.
   - Mantém o filtro `tipo !== "lead"` (prospects continuam aparecendo).

2. **Adicionar debounce de 250 ms** no `alunoSearch` usando o hook já existente `useDebounce` (`src/hooks/useDebounce.ts`).

3. **Garantir que o aluno selecionado continue exibido** mesmo depois de limpar a busca:
   - Carregar o registro do `alunoId` selecionado em uma query separada e leve (`["aluno_agenda_selected", alunoId]`), para `selectedAluno` não depender da lista de busca.

4. **Ajustar `filteredAlunos`**: como agora a query já vem filtrada do servidor, `filteredAlunos = alunos` (mantém variável para minimizar mudanças no JSX). Mensagens de estado:
   - termo < 2 caracteres → dica "Digite ao menos 2 letras…"
   - sem resultados → mensagem atual "Nenhum aluno encontrado".

### Verificação pós-fix

- Confirmar via preview que digitar "lour" lista o prospect **Lourival May Chula** com badge "Prospect".
- Confirmar que alunos ativos e inativos continuam aparecendo normalmente.
- Confirmar que o lead homônimo **não** aparece.

Nenhum outro arquivo é alterado. Sem mudança de schema, RLS ou backend.