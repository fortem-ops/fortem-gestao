## Banco de Horas

Adicionar um módulo "Banco de Horas" que registra ajustes manuais (créditos/débitos em minutos) feitos por coordenadores/admins sobre os colaboradores, e exibe o saldo acumulado.

### 1. Banco de dados (migração)

Nova tabela **`ponto_banco_horas`**:
- `usuario_id` (uuid) — colaborador
- `data` (date) — data de referência do lançamento
- `minutos` (int) — positivo (crédito) ou negativo (débito)
- `motivo` (text) — descrição obrigatória
- `tipo` (enum: `credito_manual`, `debito_manual`, `compensacao`, `ajuste_saldo`)
- `registrado_por` (uuid) — quem fez o lançamento
- `referencia_jornada_id` (uuid, opcional) — link a jornada relacionada

RLS:
- Leitura: o próprio usuário vê seus lançamentos; coordenador/admin vê todos.
- Escrita/exclusão: somente coordenador/admin.

Função utilitária **`fn_ponto_banco_saldo(_user_id uuid, _ate date default null)`** → `int` (saldo acumulado em minutos).

Função **`fn_ponto_banco_resumo(_user_id uuid, _mes date)`** → jsonb com:
- `saldo_inicial` (até o último dia do mês anterior)
- `creditos_mes`, `debitos_mes`
- `saldo_periodo_jornadas` (saldo do mês vindo das jornadas — trabalhado − previsto)
- `saldo_final`

### 2. UI — Funcionário (`src/pages/Ponto.tsx`)

Adicionar nova aba **"Banco de horas"** ao lado de "Relatório":
- Card com saldo total acumulado (verde se positivo, vermelho se negativo)
- Filtro por mês
- Cards: Saldo inicial, Créditos no mês, Débitos no mês, Saldo do período
- Tabela com lançamentos do mês (data, tipo, minutos, motivo, registrado por) — somente leitura para o funcionário

Componente novo: `src/components/ponto/MeuBancoHoras.tsx`.

### 3. UI — Coordenador/Admin (`src/pages/RelatorioPonto.tsx`)

Adicionar nova aba **"Banco de horas"** dentro das tabs existentes (junto com Diário/Mensal):
- Filtro por profissional (mesmo Select já existente)
- Tabela de saldo por colaborador (Profissional, Saldo acumulado, Créditos no mês, Débitos no mês)
- Botão "Lançar crédito/débito" abre dialog para inserir minutos (+/−), motivo, data, tipo
- Por linha: botão "Ver lançamentos" abre dialog com histórico do colaborador e ações de excluir lançamento

Componentes novos:
- `src/components/ponto/AdminBancoHorasTable.tsx` — listagem por colaborador
- `src/components/ponto/LancamentoBancoHorasDialog.tsx` — formulário de crédito/débito
- `src/components/ponto/HistoricoBancoHorasDialog.tsx` — lançamentos de um colaborador

### 4. Integração com saldo existente

O saldo do "Resumo" do `MeuRelatorioPonto` (saldo no mês) passa a somar o saldo do banco de horas (lançamentos manuais) ao saldo de jornadas — exibindo o total efetivo. Mesma lógica aplicada na visão mensal do `RelatorioPonto`.

### 5. Arquivos afetados

- Nova migração SQL — tabela `ponto_banco_horas`, enum, RLS, funções `fn_ponto_banco_saldo` e `fn_ponto_banco_resumo`.
- Novo `src/components/ponto/MeuBancoHoras.tsx`.
- Novo `src/components/ponto/AdminBancoHorasTable.tsx`.
- Novo `src/components/ponto/LancamentoBancoHorasDialog.tsx`.
- Novo `src/components/ponto/HistoricoBancoHorasDialog.tsx`.
- Editado `src/pages/Ponto.tsx` — nova aba "Banco de horas".
- Editado `src/pages/RelatorioPonto.tsx` — nova aba "Banco de horas".
- Editado `src/components/ponto/MeuRelatorioPonto.tsx` — saldo do mês inclui banco.

Sem mudanças em rotas, sidebar ou permissões existentes.