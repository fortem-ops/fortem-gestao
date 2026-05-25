## Fase 7 — Geofencing (raio de localização)

Implementar validação de raio para o ponto, com 3 locais cadastrados, raio padrão 200m e modo **flexível** (permite registrar mas marca como "fora do local" e gera alerta).

### Banco de dados

**Tabela `ponto_locais_trabalho`** (admin gerencia)
- `id`, `nome` (text), `latitude` (numeric), `longitude` (numeric), `raio_m` (int, default 200), `ativo` (bool), `created_at`, `updated_at`
- RLS: leitura para autenticados; insert/update/delete só admin
- Seed com os 3 locais fornecidos:
  1. Local 1 — `-30.029346, -51.217840`
  2. Local 2 — `-30.044967, -51.232644`
  3. Local 3 — `-30.035945, -51.213151`

**Tabela `ponto_eventos`** — adicionar colunas:
- `fora_do_raio` (bool, default false)
- `local_mais_proximo_id` (uuid, nullable)
- `distancia_m` (numeric, nullable)

**Função SQL `fn_distancia_metros(lat1, lng1, lat2, lng2)`** — fórmula de Haversine, IMMUTABLE.

**Função SQL `fn_local_mais_proximo(lat, lng)`** — retorna `{local_id, distancia_m, dentro_raio}` percorrendo locais ativos.

**Atualizar `fn_ponto_registrar`** — após receber lat/lng:
- Se lat/lng presentes → calcular local mais próximo e preencher `fora_do_raio`, `local_mais_proximo_id`, `distancia_m`.
- Se fora do raio ou sem GPS → registra mesmo assim (modo flexível), mas com flag.
- Se fora do raio → inserir em `ponto_alertas` (tipo novo `fora_do_local`) para o coordenador.

**Enum `tipo_alerta_ponto`** — adicionar valor `fora_do_local`.

### UI

**Admin → nova aba "Locais"** em `AdminPonto.tsx`:
- Componente `AdminPontoLocais.tsx` com CRUD: nome, lat, lng, raio (slider 100–500m), ativo.
- Mapa OpenStreetMap embed mostrando o ponto e círculo do raio (mesma técnica do `LocBadge`).
- Botão "Usar minha localização atual" para preencher lat/lng.

**Colaborador (`BotaoInteligente.tsx`)**:
- Antes de registrar, exibir aviso suave quando GPS retornar fora do raio mais próximo: toast amarelo "Você está a XXXm do local mais próximo — registro será marcado como fora do local". Registro segue normal (modo flexível).
- Sem GPS: registra com aviso "Sem localização — registro permitido com alerta".

**`ResumoDoDia.tsx`**:
- Em cada evento, se `fora_do_raio = true`, exibir badge âmbar "Fora do local" ao lado da hora, com tooltip da distância e nome do local mais próximo.

**Equipe ao vivo / Alertas**:
- `AlertasPontoPanel.tsx` já lista alertas; novo tipo `fora_do_local` aparece automaticamente com ícone/cor distintos (laranja).

### Arquivos

**Novos**
- `supabase/migrations/...phase7-geofencing.sql`
- `src/components/ponto/AdminPontoLocais.tsx`

**Editados**
- `src/pages/AdminPonto.tsx` — nova aba "Locais"
- `src/components/ponto/BotaoInteligente.tsx` — toast preditivo de distância
- `src/components/ponto/ResumoDoDia.tsx` — badge "Fora do local"
- `src/lib/ponto.ts` — helper `formatDistancia(m)`
- `src/components/ponto/AlertasPontoPanel.tsx` — label do novo tipo
- `src/integrations/supabase/types.ts` — auto

### Comportamento resumido
- GPS dentro do raio → registro normal, sem alerta.
- GPS fora do raio (qualquer um dos 3 locais > 200m) → registro aceito, `fora_do_raio=true`, alerta para coordenador.
- Sem GPS → registro aceito, `fora_do_raio=true` (sem local_id), alerta para coordenador.
- Sem exceções por tipo de vínculo.
