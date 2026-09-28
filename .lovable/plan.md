## Excluir a cobrança em aberto junto com a venda

### Situação atual
Ao excluir uma venda, o sistema já apaga as cobranças do contrato ligado ao plano da venda. Mas a cobrança ligada **diretamente** à venda (vendas sem contrato, ex.: serviços avulsos, venda pendente ainda sem contrato) fica para trás e continua aparecendo como "em aberto" e em Inadimplentes.

### O que muda
Ao excluir uma venda:
- A cobrança vinculada diretamente a ela é excluída **se estiver em aberto** (pendente ou atrasada), junto com a inadimplência dela.
- Cobranças já pagas ou estornadas **não** são apagadas (preservam o histórico financeiro e fiscal).
- O comportamento atual para contratos continua igual.
- Nada muda na Rede: nenhuma cobrança ou estorno real é disparado.

### Detalhes técnicos
- Migração alterando apenas `fn_cleanup_on_venda_delete` (trigger BEFORE DELETE já existente): antes do bloco do contrato, se `OLD.cobranca_id` não for nulo, deletar `inadimplencias` com esse `cobranca_id` e `cobrancas` com `id = OLD.cobranca_id AND status IN ('pendente','atrasado')`; também tratar cobranças com `venda_id = OLD.id` caso a coluna exista, com o mesmo filtro de status.
- Confirmar nomes exatos de status e FKs antes de aplicar; sem mexer em grants, owner ou search_path.
- Verificação: consultar cobranças órfãs em aberto (sem venda/contrato) antes e depois.
