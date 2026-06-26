## Objetivo
Permitir que **Coordenação e Administração** ajustem horários de ponto em qualquer dia — inclusive nos dias marcados como **Falta** (sem nenhum registro), cobrindo casos de esquecimento do funcionário.

## Escopo

### 1. Backend — nova RPC para criar jornada retroativa
Criar `public.fn_ponto_criar_jornada_manual(_user_id uuid, _data date, _motivo text) RETURNS uuid`:
- `SECURITY DEFINER`, `search_path = public`.
- Restrita a `is_coordinator_or_admin(auth.uid())` (erro `42501` caso contrário).
- Valida `_motivo` (mín. 3 caracteres) e que `_data` não seja futura.
- Insere em `ponto_jornadas` uma linha vazia para `(usuario_id=_user_id, data=_data)` com `status_ponto='ajustada'`, `observacao` prefixada com "Criada manualmente por <coord>: <motivo>".
- Se já existir jornada nesse dia, retorna o `id` existente (idempotente).
- Grava entrada em `ponto_ajustes_log` (campo `criacao_manual`) com `usuario_alvo`, `usuario_responsavel=auth.uid()`, `motivo`.
- `GRANT EXECUTE ... TO authenticated`.

Nenhuma alteração em `fn_ponto_ajustar_jornada`: ela continua sendo chamada em seguida para preencher entrada/intervalo/saída.

### 2. Frontend — `src/components/ponto/AjustarJornadaDialog.tsx`
- Aceitar novas props opcionais: `usuarioId: string`, `permitirCriacao?: boolean`.
- Quando `jornadaId` for `null` e `permitirCriacao` for `true`:
  - Antes de chamar `fn_ponto_ajustar_jornada`, invocar `fn_ponto_criar_jornada_manual` com `usuarioId`, `data` e o `motivo` digitado.
  - Usar o `id` retornado para a chamada de ajuste.
- Texto de cabeçalho: quando criando, mostrar "Registrar ponto retroativo" em vez de "Ajustar jornada".
- Invalidar também `["relatorio-ponto"]` / `["ponto-jornadas"]` para refletir a nova linha imediatamente.

### 3. Frontend — `src/pages/RelatorioPonto.tsx`
- Nas linhas `kind === "falta"`, exibir no canto direito (coluna Ações, hoje "Sem ponto") um botão `Registrar ponto` (somente para coord/admin — já é a regra de acesso da página).
- Ao clicar, abrir `AjustarJornadaDialog` com:
  - `jornadaId={null}`
  - `usuarioId={l.usuario_id}`
  - `professorNome` e `data` correspondentes
  - `permitirCriacao` = `true`
- Manter o botão "Ajustar" existente nas jornadas normais (sem mudanças).

### 4. Sem mudanças necessárias
- RLS de `ponto_jornadas` / `ponto_ajustes_log` permanecem como estão (a RPC `SECURITY DEFINER` gerencia o acesso).
- `EquipeAoVivoTable` continua usando o diálogo no modo legado (apenas edição).

## Resultado esperado
Em Relatório Ponto, ao lado de cada "Falta", coordenador/admin clica em **Registrar ponto**, informa entrada/saída e motivo. O sistema cria a jornada retroativa, grava no log de auditoria e o dia deixa de figurar como falta.
