## Objetivo

Modelos da seção **Corrida** em `Banco de Treinos` passam a ser:
- **Editáveis** apenas por coordenadores/administradores (`canEdit`).
- Salvos como **registro único compartilhado por template** (um por `template.fase`, ex.: "Corrida - Fase 1") em `banco_treinos_personalizados`.
- **Ocultos** das listagens "Meus Modelos" / "Modelos de {autor}", aparecendo somente como cards da própria seção Corrida.
- Para professor/nutri/fisio: o editor abre normalmente em modo somente leitura (sem botão Salvar / botões desabilitados).

## Mudanças

Arquivo único: `src/pages/BancoTreinos.tsx` + um pequeno ajuste em `src/components/student/workout/PersonalizadoEditor.tsx`.

### 1. `PersonalizadoEditor` — prop `readOnly`
- Adicionar prop opcional `readOnly?: boolean`.
- Quando `true`: ocultar (ou desabilitar) o botão **Salvar** e o botão **Excluir**. Inputs continuam editáveis localmente (UX igual à opção 1), mas nada persiste.
- Atalho `Ctrl/Cmd+S` desativado quando `readOnly`.

### 2. `BancoTreinos.tsx` — comportamento dos cards Corrida
- `onClick` do card (`template.fase.startsWith("Corrida")`):
  - Procurar `existing = modelosPersonalizados.find(m => m.nome === template.fase)`.
  - Se existe → abrir em `mode: "edit"` (mantém atual).
  - Se não existe **e** `canEdit` → abrir em `mode: "new"` com `seed` (mantém atual).
  - Se não existe **e** não tem permissão → abrir em modo "new" somente leitura usando o seed do template (para visualização).
- Passar `readOnly={!canEdit}` para `PersonalizadoEditor` quando o template aberto for Corrida.

### 3. Ocultar Corrida das listagens de personalizados
- Em `modelosPorAutor` (linhas ~849-867): antes de agrupar, filtrar `modelosPersonalizados` removendo registros cujo `nome` corresponda a algum `WORKOUT_TEMPLATES[].fase` que começa com `"Corrida"`.
- Assim a edição salva no card Corrida não aparece duplicada em "Meus Modelos" / "Modelos de X".

### 4. (Opcional) Badge "Editado" no card Corrida
- Mostrar um pequeno indicador quando `existing` foi encontrado, sinalizando que o modelo da equipe foi customizado em relação ao seed.

## Não muda

- Schema do banco e RLS — as policies atuais de `banco_treinos_personalizados` já permitem coord/admin atualizar qualquer registro (`Author or coord/admin can update personalizados`).
- Fases, Métodos, Personalizado, Personalizado 2 — comportamento idêntico.
- "Indicação da Fase Inicial" da aula experimental — continua usando `WORKOUT_TEMPLATES` (seed read-only).
- Cards do Banco mostram contagens do seed (`WORKOUT_TEMPLATES`); o conteúdo editado é exibido ao abrir o editor.
