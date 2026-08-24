# Cadastro de Clientes Avulsos

Hoje a página **Clientes Avulsos** só lista clientes com status `avulso` — e não existe nenhuma forma de criar um. Confirmei no banco: não há nenhum registro com esse status ainda, então a lista está sempre vazia. O plano adiciona o cadastro.

## O que será feito

### 1. Botão e formulário "Novo Cliente Avulso"
Na página `/clientes-avulsos`, ao lado da busca, um botão abre um diálogo de cadastro:

- **Obrigatório:** Nome
- **Opcionais:** E-mail, telefone, CPF, data de nascimento, CEP (com preenchimento automático de logradouro/bairro/cidade/UF), número, complemento, profissional responsável (nutricionista/fisioterapeuta/coordenação) e observações

Ao salvar, o cliente é criado com status `avulso` e aparece imediatamente na lista. Um clique no cliente já leva ao perfil, de onde a venda de serviços (Nutrição/Fisioterapia) e a geração de créditos funcionam pelo fluxo normal de vendas que já existe.

### 2. CPF protegido e sem duplicidade
O CPF é gravado pelo mesmo caminho criptografado já usado no resto do sistema (só os 3 últimos dígitos ficam visíveis). Antes de criar, o sistema verifica se já existe alguém com aquele CPF e avisa em vez de criar um duplicado.

### 3. Permissões
Cadastrar clientes avulsos fica liberado para **Coordenação, Administração, Nutricionista e Fisioterapeuta**. Professores continuam apenas visualizando a lista. O botão só aparece para quem pode cadastrar.

## Detalhes técnicos

**Migração de banco (necessária):** a política de inserção em `public.alunos` hoje exige `is_coordinator_or_admin()`. Será adicionada uma política de INSERT para `authenticated` permitindo que nutricionista/fisioterapeuta insiram **somente** registros com `status = 'avulso'` (`has_role(auth.uid(),'nutricionista') OR has_role(auth.uid(),'fisioterapeuta')` combinado com `status = 'avulso'`). A leitura já é coberta por `alunos_staff_select` (`is_professor_staff()`), que inclui nutri/fisio. Nenhuma coluna nova é criada.

**Frontend:**
- Novo `src/components/student/AddClienteAvulsoDialog.tsx`: form com `react-hook-form` + `zod` (padrão do `StudentFormFields`), `fetchCep`/`formatCep` de `src/lib/viacep.ts`, validação de CPF via `src/lib/cpfValidation.ts`.
- Insert em `alunos` com `status: "avulso"`, `frequencia_semanal: 0`/nulo, `responsavel_id` = profissional escolhido ou usuário atual; em seguida `supabase.rpc("fn_update_cpf", ...)` quando houver CPF (mesmo padrão de `src/lib/studentImport.ts`). Dedupe consultando `cpf_hash` via `fn_lookup_aluno_por_cpf_hash`.
- Sem criação de plano nem de estágio de pipeline — cliente avulso não entra no funil.
- `src/pages/ClientesAvulsos.tsx`: renderiza o botão condicionado ao papel e invalida a query `["clientes-avulsos"]` após o cadastro.
- `src/hooks/useUserRoles.ts`: acrescenta `isNutriFisio` (via RPC `has_role`) para controlar a visibilidade do botão.
