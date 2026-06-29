## Nova aba "Consentimentos LGPD" em Admin Ponto

Adiciona uma aba em `src/pages/AdminPonto.tsx` com **duas sub-seções**: (1) status do termo por colaborador e (2) administração das versões do termo.

---

### 1. Sub-aba "Colaboradores" — status do aceite

Componente `src/components/ponto/AdminConsentimentosGeo.tsx`.

- Query: lista profissionais (reaproveita `admin-ponto-profs`) com `LEFT JOIN` lógico em `ponto_consentimento_geo` (`aceito`, `aceito_em`, `versao_termo`, `texto_termo`, `user_agent`).
- Tabela com colunas:
  - Profissional
  - Status — badge: verde "Aceito" / vermelho "Recusado" / cinza "Pendente"
  - Versão do termo (badge amarelo "Desatualizada" se diferente da versão vigente)
  - Data do aceite/recusa (pt-BR)
  - Dispositivo (user_agent truncado + tooltip)
  - Ação: "Ver termo aceito" → Dialog com `texto_termo` salvo (read-only)
- Filtros: busca por nome + filtro por status (Todos / Aceito / Recusado / Pendente / Desatualizado).
- Rodapé com contadores: X aceitos · Y recusados · Z pendentes · W desatualizados, de N colaboradores.

### 2. Sub-aba "Versões do termo" — administração

Componente `src/components/ponto/AdminTermoConsentimento.tsx`.

Fonte de dados: tabela existente `ponto_politica_retencao` (já tem campos de versão e `texto_termo` da política/termo). Cada linha representa uma versão do termo.

- **Lista de versões**: tabela com versão, data de publicação, "vigente" (badge verde na linha marcada), prévia das primeiras linhas do texto, contagem de aceites já registrados naquela versão (subquery em `ponto_consentimento_geo`).
- **Editor de nova versão** (Dialog):
  - Campos: número da versão (ex. `1.2`), título, `texto_termo` (textarea grande), notas internas de mudança (changelog).
  - Validação: versão única, texto não vazio.
  - Botão "Publicar e tornar vigente" cria a nova linha e marca como vigente (desmarca a anterior na mesma transação).
  - Botão "Salvar como rascunho" cria a versão sem torná-la vigente.
- **Ações por linha**: Editar (apenas se rascunho), Visualizar (Dialog read-only para versões já vigentes/históricas — não permite edição para preservar a prova legal de o que foi aceito), Tornar vigente (para rascunhos).
- Aviso visível: "Versões já aceitas por colaboradores não podem ser editadas. Para mudar o texto, publique uma nova versão — colaboradores serão solicitados a aceitar novamente."

### Sincronização com o app do colaborador

Hoje `useConsentimentoGeo.ts` e `Ponto.tsx` têm a string `TEXTO_TERMO_V1_1` e a versão `1.1` **hardcoded**. Para que a administração seja efetiva:

- Criar hook `src/hooks/useTermoVigente.ts` que lê a versão vigente de `ponto_politica_retencao` (`versao` + `texto_termo`).
- `useConsentimentoGeo` passa a usar essa versão/texto dinamicamente no `upsert`.
- `Ponto.tsx` compara `consentimento.versao_termo` com a versão vigente retornada pelo hook (em vez de string fixa `"1.1"`) para decidir se reabre o `ConsentimentoGeoDialog`.
- `ConsentimentoGeoDialog` recebe o texto via prop em vez de constante interna.

### Banco e segurança

- Sem nova tabela — reaproveita `ponto_politica_retencao`.
- Conferir/ajustar RLS:
  - `ponto_politica_retencao`: SELECT para `authenticated` (todos precisam ler a versão vigente); INSERT/UPDATE restrito a `has_role(auth.uid(),'admin')`.
  - `ponto_consentimento_geo`: SELECT por admins (`has_role(auth.uid(),'admin')`) além da policy atual do próprio usuário, para alimentar a sub-aba "Colaboradores".
- Se faltar coluna `vigente boolean` ou similar em `ponto_politica_retencao`, a migração adiciona, com índice parcial único garantindo no máximo uma versão vigente.

### Integração em `AdminPonto.tsx`

- Novo `<TabsTrigger value="consentimentos">Consentimentos LGPD</TabsTrigger>`.
- Conteúdo da aba usa um `Tabs` interno com "Colaboradores" e "Versões do termo".

### Fora do escopo

- Não muda o fluxo de aceite em si (botões/UX permanecem).
- Não altera o texto da política de retenção exibido em `PoliticaRetencaoCard`.
- Não altera o texto vigente atual — apenas habilita gestão futura. A versão `1.1` atual é semeada como vigente se ainda não estiver representada na tabela.
