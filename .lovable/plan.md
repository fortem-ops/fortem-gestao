## Mudanças em Admin → Ponto

### 1. Remover Configuração Global e Overrides
- Em `src/pages/AdminPonto.tsx`, remover o componente `<AdminPontoConfig />`.
- Excluir o arquivo `src/components/ponto/AdminPontoConfig.tsx`.
- Manter apenas o cabeçalho e o bloco de horários.

### 2. Renomear "Horários por professor" → "Horário por funcionário"
Em `src/components/ponto/AdminPontoHorarios.tsx`:
- Trocar título e textos de apoio para "funcionário/colaborador".
- Trocar label do select para "Funcionário".
- Atualizar toasts e mensagens vazias.

### 3. Trazer todos os colaboradores (professor + admin)
- Alterar a query `ponto-professores-list` para `ponto-colaboradores-list`, buscando `user_roles` com `role IN ('professor','admin')`.
- Deduplicar `user_id` (um admin que também seja professor aparece uma vez só).
- Buscar `profiles.full_name` desses ids e ordenar alfabeticamente.

### 4. Corrigir bug: configuração "vaza" entre funcionários
**Causa:** o componente `DiaRow` mantém estado local (`useState`) inicializado pelos props apenas na primeira montagem. Ao trocar o funcionário no select, os inputs continuam mostrando os valores do funcionário anterior; ao clicar "Salvar", esses valores são gravados no novo `usuario_id`.

**Correção:**
- Forçar remontagem do `DiaRow` por funcionário usando `key={`${profSelecionado}-${dia.val}`}` no map.
- Como reforço, o estado interno do `DiaRow` continuará sendo derivado do `row` recebido, agora sempre fresh por causa da nova key.
- Validar que a invalidação da query usa a key correta `["ponto-horarios", profSelecionado]` (já está correta).

### 5. Detalhes técnicos
- Nenhuma migração de banco necessária — a tabela `ponto_horarios_professor` continua sendo usada (apenas renomeada na UI).
- A tabela `ponto_configuracoes` permanece intacta no DB (sem UI de admin); pode ser limpada depois se desejado.
- Sem mudanças em rotas, sidebar ou permissões.

### Arquivos afetados
- `src/pages/AdminPonto.tsx` — remove import e render de `AdminPontoConfig`.
- `src/components/ponto/AdminPontoHorarios.tsx` — renomeia textos, busca colaboradores (professor+admin), adiciona key por funcionário no DiaRow.
- `src/components/ponto/AdminPontoConfig.tsx` — excluído.