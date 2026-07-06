
# Plano — Unificação de Avaliação Funcional + Força em `funcional_v2` (Avaliações Premium)

Modo somente-leitura: nenhuma migration foi executada e nenhum arquivo foi editado nesta rodada.

## 1. Achados do banco (produção)

`avaliacao_tipos` (todos ativos):

| Slug | Nome | Engine | Obs |
|---|---|---|---|
| `funcional` | Funcional | `funcional_fixo` | **Antigo** — a desativar |
| `composicao_corporal` | Composição Corporal | `composicao_pollock` | manter |
| `pliometria` | Pliometria | `dinamico` | manter |
| `forca` | Força | `dinamico` | **Antigo isolado (Kinology upload)** — a desativar |
| `experimental` | Experimental | `dinamico` | manter |
| `funcional_v2` | Avaliação Funcional (Nova) | `funcional_v2` | **Fluxo alvo** |

`avaliacao_protocolos`:
- `Funcional` (tipo funcional, is_default=true, permite_upload=false)
- `Pollock - 7 Dobras`
- `Padrão` (pliometria)
- `Relatório Força` (tipo forca, is_default=**false**, permite_upload=**true**) — é este que hoje aceita o PDF Kinology no fluxo antigo
- `Relatório da aula experimental`

Contagem em `avaliacoes.tipo`: `funcional`=120, `experimental`=15, `forca`=6, `pliometria`=2, `funcional_v2`=0 (ainda não usado em produção). ➜ Migração é 100% forward — sem necessidade de backfill.

## 2. Ordem de execução

1. **Front — Import Kinology na Premium (novo componente)** dentro de `/avaliacoes-premium`, no cabeçalho do `PremiumBodyMap` ou como bloco próprio acima das tabs.
2. **Front — Ajuste de UI**: badge/aviso quando existir linha `funcional_v2` só com força (metricas vazio) ou só com métricas (força vazia).
3. **Front — Menu/Navegação**: manter `/avaliacoes` (histórico e edição legada) e redirecionar a ação primária "Nova avaliação funcional / força" para `/avaliacoes-premium`.
4. **DB — Migration de desativação** dos tipos/protocolos antigos (apenas `ativo=false`, sem delete).
5. **Validação manual** (checklist ao final).

## 3. Detalhamento por item

### 3a. Import Kinology dentro da Premium

Local sugerido: `src/components/avaliacoes-premium/PremiumKinologyImport.tsx` (novo), consumido em `src/pages/AvaliacoesPremium.tsx` logo acima do `<PremiumBodyMap>`.

Fluxo do botão "Importar PDF Kinology":

```text
1. Upload do PDF em storage `aluno-files/avaliacoes/laudos-dinamometria/<alunoId>/<ts>-<nome>.pdf`
2. Invoke edge function `parse-kinology-pdf` (já existe, usada em FuncionalV2Assessment)
3. Buscar em `avaliacoes` a linha mais recente do aluno onde:
     tipo = 'funcional_v2'
     AND dados->'metricas' IS NOT NULL AND jsonb_array_length(dados->'metricas') > 0
     AND (dados->'forca' IS NULL OR dados->'forca' = 'null'::jsonb)
   ORDER BY created_at DESC LIMIT 1
4. Se encontrada → UPDATE mesclando `dados.forca = { laudoPath, importadoEm, exercicios, scoreForca }`
   (dispara `trg_comissao_avaliacao_v2_update` → gera comissão)
5. Se NÃO encontrada → INSERT nova linha `funcional_v2` com:
     dados = { metricas: [], forca: { ... } }
   e mostrar toast informando "Força registrada, mas faltam as métricas de mobilidade para liberar a comissão"
6. Invalidate query `useAlunoAvaliacoesConsolidadas`
```

Reaproveita a lógica de `handlePdfUpload` de `FuncionalV2Assessment.tsx` (linhas ~92-131) — extrair para helper `src/lib/kinologyImport.ts` para reutilização entre as duas telas enquanto o antigo fluxo não é aposentado.

### 3b. Aviso de "linha incompleta" no BodyMap

Em `PremiumBodyMap` (ou `AlunoSidebarCard`): quando a avaliação mais recente tem apenas um dos lados preenchidos, exibir chip:
- "Aguardando força — comissão não liberada" (verde para métricas ok, cinza para força faltando), ou
- "Aguardando métricas de mobilidade — comissão não liberada".

Dados já vêm do `useAlunoAvaliacoesConsolidadas` (que agora inclui `funcional_v2`). Basta checar `dados.metricas.length > 0` e `dados.forca?.exercicios?.length > 0`.

### 3c. Desativação dos fluxos antigos

Migration (**apenas proposta — não executar**):

```sql
-- Desativa tipos e protocolos antigos, preserva histórico
UPDATE public.avaliacao_tipos
   SET ativo = false
 WHERE slug IN ('funcional', 'forca');

UPDATE public.avaliacao_protocolos
   SET ativo = false
 WHERE tipo_id IN (
   SELECT id FROM public.avaliacao_tipos WHERE slug IN ('funcional','forca')
 );

-- Garante que funcional_v2 tenha protocolo default
-- (verificar antes se já existe — na consulta acima não apareceu protocolo para funcional_v2!)
```

⚠️ **Achado crítico**: o tipo `funcional_v2` NÃO tem nenhum protocolo cadastrado hoje. Antes de desativar `funcional`/`forca`, é obrigatório criar ao menos um protocolo default para `funcional_v2` — senão a UI de seleção fica vazia. Sugestão de payload:

```sql
INSERT INTO public.avaliacao_protocolos (tipo_id, nome, descricao, schema, is_default, ativo, ordem, permite_upload)
VALUES (
  '6bc2e5ee-be52-496c-93db-18450b878c62',
  'Funcional + Força (padrão)',
  'Mobilidade/flexibilidade + dinamometria isométrica Kinology no mesmo registro.',
  '{}'::jsonb,
  true, true, 0, true
);
```

Efeitos colaterais em código, se tipos/protocolos antigos ficarem inativos:
- `src/pages/Avaliacoes.tsx` e demais telas que listam tipos via `fetchTipos()` normalmente filtram por `ativo` (verificar) — resultado: os cards antigos somem para novos cadastros mas registros históricos continuam visíveis (leitura por `avaliacoes.tipo`, não por `tipo_id`).
- `FuncionalV2Assessment.tsx` continua funcionando para o botão "Nova" que apontar pra ele; se quisermos aposentar essa rota também, decidir se removemos da UI ou apenas escondemos.

### 3d. Navegação/menu

- `AppSidebar.tsx`: renomear entrada "Avaliações Premium" apenas para "Avaliações" (item primário) e manter "Avaliações (legado)" oculto atrás de flag/rota direta `/avaliacoes` — ou deixar ambos e apenas mudar destaque.
- Botões "Nova avaliação" no perfil do aluno (`StudentProfile`, widgets) devem passar a apontar para `/avaliacoes-premium/:alunoId`.

### 3e. Regra de comissionamento

Já coberta pela migration anterior (`trg_comissao_avaliacao_insert` + `trg_comissao_avaliacao_v2_update`):
- INSERT com metricas+forca → comissão imediata.
- INSERT parcial + UPDATE completando → trigger de UPDATE gera comissão.
- **Nenhum ajuste adicional necessário** para o novo caminho (import Kinology direto na Premium), porque tanto o UPDATE de linha existente quanto o INSERT parcial + UPDATE futuro caem em um dos dois gatilhos.

Único cuidado: o INSERT parcial "só força" (caso 5 do fluxo em 3a) **não** gera comissão sozinho — é o comportamento desejado, mas deve ficar explícito na UI.

## 4. Arquivos/tabelas tocados (previsão)

Código:
- `src/pages/AvaliacoesPremium.tsx` — montar componente de import.
- `src/components/avaliacoes-premium/PremiumKinologyImport.tsx` — **novo**.
- `src/components/avaliacoes-premium/PremiumBodyMap.tsx` — chip de "linha incompleta".
- `src/lib/kinologyImport.ts` — **novo** helper compartilhado (opcional).
- `src/components/AppSidebar.tsx` — reordenação/destaque.
- Pontos de "Nova avaliação" no perfil do aluno.

Banco (uma única migration futura):
- `avaliacao_protocolos` — INSERT protocolo default para `funcional_v2`.
- `avaliacao_tipos` — UPDATE ativo=false para `funcional` e `forca`.
- `avaliacao_protocolos` — UPDATE ativo=false para protocolos filhos.

Nenhuma alteração em triggers, funções ou dados históricos.

## 5. Riscos

| Risco | Mitigação |
|---|---|
| `funcional_v2` sem protocolo default → tela quebra ao selecionar tipo | Inserir protocolo default **antes** de desativar os antigos, na mesma migration |
| UI antiga (`/avaliacoes` + `FuncionalV2Assessment`) continua criando linhas paralelas enquanto não removida | Manter os dois caminhos apontando para o mesmo `tipo=funcional_v2`; sem duplicação |
| Import Kinology na Premium anexa força a uma avaliação errada (ex: linha antiga do mesmo dia) | Filtrar estritamente por `tipo='funcional_v2'` e por ausência de `dados.forca` |
| Usuário importa força sem antes preencher métricas → não sai comissão e ele não entende | Chip visível + toast explícito no import |
| Registros legados `tipo='funcional'`/`'forca'` deixam de aparecer em telas que filtram por `avaliacao_tipos.ativo` | Confirmar que histórico é lido por `avaliacoes.tipo` (não por join com tipos) — checar `Avaliacoes.tsx` antes de desativar |
| Gatilho `trg_comissao_avaliacao_v2_update` conta apenas transições incompleto→completo | Já implementado com essa semântica; import na Premium via UPDATE cai exatamente nesse caso |

## 6. Checklist de teste manual

Pré-requisitos: aluno com plano ativo, ciclo de crédito aberto, coordenador logado.

1. **Fluxo feliz A — Métricas primeiro, força depois (na Premium)**
   - Abrir `/avaliacoes` (ou fluxo funcional_v2 vigente) → salvar apenas métricas de mobilidade.
   - Ir para `/avaliacoes-premium/:alunoId` → ver chip "aguardando força".
   - Importar PDF Kinology → confirmar toast "força mesclada".
   - Verificar em `avaliacoes` que a mesma linha recebeu `dados.forca`, `updated_at` mudou, e uma nova linha em `comissionamentos` foi criada.
2. **Fluxo feliz B — Import Kinology sem métricas prévias**
   - Aluno sem `funcional_v2` aberto → importar Kinology na Premium.
   - Nova linha `funcional_v2` com `metricas=[]` e `forca` preenchida.
   - Nenhum registro em `comissionamentos` gerado.
   - Chip "aguardando métricas de mobilidade" aparece.
   - Voltar em `/avaliacoes`, editar essa linha adicionando métricas e salvar → gatilho UPDATE gera a comissão.
3. **Não-regressão**
   - Salvar uma avaliação `funcional_v2` completa (métricas+força) de uma vez → comissão gerada uma única vez, sem duplicar.
   - Registros legados `tipo='funcional'` continuam visíveis em `/avaliacoes` do aluno e no histórico da Premium.
   - Importação Kinology duas vezes seguidas para o mesmo aluno não duplica comissão (segundo import cai em UPDATE de linha já completa → trigger não gera duplicata).
4. **UI**
   - Cards de "Novo tipo" em `/avaliacoes` não mostram mais "Funcional" antigo nem "Força" isolado.
   - Menu lateral destaca a Premium como fluxo principal.
5. **RLS**
   - Testar com perfil Professor (permissão de INSERT em `avaliacoes` do próprio aluno) e Coordenador; garantir que o UPDATE feito pelo import não é bloqueado.

## 7. Itens que exigem sua decisão antes de implementar

- Confirmar criação do protocolo default `Funcional + Força (padrão)` para `funcional_v2` (nome/permite_upload).
- Decidir se `/avaliacoes` continua acessível como fallback ou se removemos do menu (não do código).
- Confirmar se aceita que o INSERT "só força" apareça no histórico como linha aberta (com badge de pendência) ou se prefere que fique escondido até completar.
