## Objetivo

Três melhorias na tela **Ponto**:

1. Coordenadores/Admins podem visualizar a tela de qualquer funcionário ("ver como").
2. Ao registrar entrada / intervalo / saída, exibir a localização capturada.
3. Jornadas com carga ≤ 4h não exigem botão de intervalo (apenas acima).

---

## 1. Seletor de perfil para Coord/Admin em `/ponto`

Em `src/pages/Ponto.tsx`:

- Detectar role via RPC já existente `is_coordinator_or_admin`.
- Se for coord/admin, exibir no topo um `StudentPicker`-like baseado em `profiles` (ou query simples: `profiles` filtrado por `user_roles.role IN ('professor','nutricionista','fisioterapeuta','coordenador','admin')`) com label "Visualizando como".
- Estado local `viewAsUserId` (default = `user.id`). Um botão "Voltar para meu perfil" volta ao próprio.
- Todas as queries (`fn_ponto_estado_atual`, `ponto-jornada-hoje`, `HistoricoJornadas`) passam a usar `viewAsUserId` em vez de `user.id`.
  - `HistoricoJornadas` aceita prop opcional `userId`.
- Quando `viewAsUserId !== user.id`:
  - Esconder o `BotaoInteligente` (apenas coord pode ver, não bater ponto pelo outro). Em vez disso mostrar aviso "Modo visualização — registros são feitos pelo próprio profissional".
  - Manter visíveis Status, Resumo do dia e Histórico.

A RPC `fn_ponto_estado_atual` já aceita `_user_id` e a RLS de `ponto_jornadas` permite leitura para coord/admin, então não há mudança no banco.

## 2. Exibir localização nos eventos

A tabela `ponto_eventos` já grava `latitude`, `longitude` e `dispositivo` para cada `tipo` (`entrada`, `intervalo_inicio`, `intervalo_fim`, `saida`).

- Nova query em `Ponto.tsx` (e usada em `ResumoDoDia`): buscar os eventos do dia da jornada visualizada:
  ```ts
  supabase.from("ponto_eventos")
    .select("tipo, data_hora, latitude, longitude, dispositivo")
    .eq("usuario_id", viewAsUserId)
    .eq("jornada_id", estado.jornada_id)
  ```
- Em `ResumoDoDia.tsx`: para cada um dos 4 cards (Entrada, Intervalo início, Intervalo fim, Saída), abaixo do horário mostrar:
  - Se `latitude && longitude`: link discreto com ícone `MapPin` → "−23.5505, −46.6333" abrindo `https://www.google.com/maps?q=lat,lng` em nova aba.
  - Se ausente: texto pequeno "Sem localização".
- Aceitar `eventos` como prop opcional em `ResumoDoDia`.

Nada muda no `BotaoInteligente` — ele já envia `_lat`/`_lng` via `tryGeo()`.

## 3. Intervalo apenas para jornadas > 4h

Hoje `BotaoInteligente` mostra "Iniciar intervalo" sempre que `proxima_acao === 'intervalo_inicio'`.

Regra nova (frontend, sem mudança de RPC):
- Carregar `ponto_configuracoes` do usuário (ou global se nulo) para obter `carga_diaria_min`.
- Se `carga_diaria_min <= 240` (4h):
  - Quando `proxima_acao === 'intervalo_inicio'`, **pular** o intervalo: o botão exibido deve ser "Encerrar jornada" (`saida`) diretamente.
  - Implementação: prop adicional `pularIntervalo` em `BotaoInteligente`; quando `true` e a próxima ação for `intervalo_inicio`, renderizar o botão como `saida`. O backend já permite encerrar sem intervalo (`intervalo_obrigatorio` é `false` por padrão).
- Para jornadas > 4h: comportamento atual.

Adicionalmente: se durante o dia a jornada já passou de 4h e o usuário ainda não fez intervalo, mantemos o botão (cenário onde a config diz > 4h).

## Detalhes técnicos

**Arquivos a editar**
- `src/pages/Ponto.tsx` — seletor de "visualizar como", queries dependentes do `viewAsUserId`, query de eventos do dia, query de `ponto_configuracoes`.
- `src/components/ponto/ResumoDoDia.tsx` — exibir localização por evento; aceitar prop `eventos` e `readOnly` (para esconder botão de observação no modo visualização de outro perfil).
- `src/components/ponto/HistoricoJornadas.tsx` — aceitar prop opcional `userId`.
- `src/components/ponto/BotaoInteligente.tsx` — aceitar prop `pularIntervalo` e desviar `intervalo_inicio` → `saida` quando ativa.

**Sem mudanças de schema/RLS** — as RPCs e policies existentes já cobrem coord/admin lendo dados de outro usuário e escrita de localização.

**Coord/Admin ver tela**: aproveitar `is_coordinator_or_admin(auth.uid())` (já usada em `PontoWidget`).

**Lista de profissionais para o seletor**: query única `profiles` com join em `user_roles` filtrando roles operacionais; ordenado por `full_name`.
