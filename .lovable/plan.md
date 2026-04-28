# Substituir "Nível mínimo" por "Níveis específicos" (multi-seleção)

O campo "Nível mínimo" do cadastro de benefícios será substituído por "Níveis com acesso", onde você marca um ou mais níveis (incluindo AGREGADOR). Apenas membros nos níveis marcados poderão usar o benefício.

## Mudanças no banco

- Adicionar coluna `niveis_permitidos clube_nivel_membro[] NOT NULL DEFAULT '{}'` na tabela `beneficios`.
- Migrar dados existentes: para cada benefício, preencher `niveis_permitidos` com todos os níveis ≥ `nivel_minimo` atual (preserva comportamento dos benefícios já cadastrados).
- Remover a coluna `nivel_minimo` (e o default).
- Atualizar `fn_clube_validar_token`: substituir o teste de `array_position(...)` por `_membro.nivel_membro = ANY(_beneficio.niveis_permitidos)` (com motivo "Nível sem acesso ao benefício").

## Mudanças no frontend

### `AdminBeneficiosTable.tsx`
- Trocar o select único por um grupo de **Checkboxes** com todos os níveis (`agregador`, `start`, `start_plus`, `power`, `pro`, `max`), usando `NIVEL_LABEL`.
- Estado do form: `niveis_permitidos: NivelMembro[]` (default `["start"]`).
- Validação no `save()`: exigir pelo menos um nível marcado.
- Na tabela de listagem, exibir os níveis como múltiplos badges (ou "Todos" quando todos estiverem marcados).

### `PartnersList.tsx`
- Substituir filtro por `NIVEL_RANK` por:  
  `benefs.filter((b) => b.niveis_permitidos.includes(nivelAluno))`.
- No badge de cada benefício, mostrar lista compacta dos níveis (ou ocultar quando todos os níveis tiverem acesso).

### `src/integrations/supabase/types.ts`
- Será regenerado automaticamente após a migração; não editar à mão.

## Itens fora do escopo

- Não mexemos em outras telas, RLS ou cadastro de membros.
- Benefícios existentes continuam acessíveis aos mesmos níveis (graças ao backfill).
