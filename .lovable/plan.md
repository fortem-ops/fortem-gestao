## Objetivo

Em **Cadastros > Alunos Ativos** (e também Inativos, já que compartilham o mesmo componente):
1. Permitir **seleção em massa** de cadastros e **ações em massa** (começando por excluir).
2. Adicionar em **Filtros Avançados** uma seção **"Dados Cadastrais"** para filtrar por presença/ausência de campos (email, CPF, telefone, etc).

---

## 1. Seleção em massa + ações em massa

**UI na tabela (`src/pages/StudentList.tsx`):**
- Nova coluna inicial com `Checkbox` em cada linha (clique não navega para o perfil — `stopPropagation`).
- Checkbox no `<thead>` para selecionar/desmarcar todos os filtrados.
- Estado `selectedIds: Set<string>` no componente.

**Barra de ações em massa (aparece quando há seleção):**
Faixa fixa acima da tabela mostrando `N selecionado(s)` + botões:
- **Excluir selecionados** (destrutivo, com `AlertDialog` de confirmação que mostra a quantidade e os nomes).
- **Limpar seleção**.
- Espaço preparado para futuras ações em massa (ex.: alterar professor, exportar) — implementaremos só "Excluir" agora.

**Exclusão:**
- `supabase.from("alunos").delete().in("id", [...selectedIds])`.
- Apenas Admin/Coordenador podem ver os botões de ação destrutiva (usa `useAuthAccess`/role já existente no projeto).
- Após sucesso: toast com contagem, limpar seleção, `refetch()` + invalidar queries relacionadas (`alunos_with_plans`, `pipeline-alunos`).
- Tratar erros de FK (ex.: aluno com planos/pagamentos) mostrando mensagem clara — se necessário, sugerir encerrar o cadastro em vez de excluir.

---

## 2. Filtros "Dados Cadastrais"

**`src/components/student/StudentListFilters.tsx`:**

Adicionar à interface `StudentFilters` um campo:
```ts
dadosCadastrais: {
  email: "todos" | "com" | "sem";
  cpf: "todos" | "com" | "sem";
  telefone: "todos" | "com" | "sem";
  rg: "todos" | "com" | "sem";
  dataNascimento: "todos" | "com" | "sem";
  endereco: "todos" | "com" | "sem";   // considera CEP+logradouro+cidade
  foto: "todos" | "com" | "sem";
}
```

No painel de Filtros Avançados, nova subseção **"Dados Cadastrais"** (separador + grid) com um `Select` (Todos / Com / Sem) para cada campo acima. Contador de filtros ativos passa a incluir esses novos.

**`StudentList.tsx` (lógica de filtro):**
- Buscar também `cpf, rg, data_nascimento, cep, logradouro, cidade, foto_url` no `ALUNOS_COLUMNS`.
- Aplicar os checks `com/sem` em `filtered` (`!!s.email`, `!!s.cpf`, etc; "endereço" considera ter `cep` OU `logradouro`).

---

## Arquivos afetados

- `src/pages/StudentList.tsx` — colunas, seleção, barra de ações, exclusão, filtros novos.
- `src/components/student/StudentListFilters.tsx` — bloco "Dados Cadastrais", tipo `StudentFilters`, `defaultFilters`, contador.

## Fora do escopo (confirmar se quiser incluir depois)

- Outras ações em massa além de excluir (alterar professor, alterar status, exportar CSV).
- Ações em massa nas telas de Leads/Prospects.
