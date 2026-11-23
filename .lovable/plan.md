# Tela branca no atalho "FORTEM Equipe" — causa e correção

## A) Causa raiz provável (lida no código; o passo exato no aparelho será confirmado pelo diagnóstico novo)

Caminho ao abrir o atalho com sessão salva:
`/equipe-app.html` → `/login` (formulário visível enquanto checa) → papel "equipe" → `/equipe` → `ProtectedRoute` (mostra "Carregando...") → **`MfaGate`**.

**1. A tela branca é o `MfaGate` esperando para sempre.** É a única tela desse caminho que não tem nada desenhado:

```tsx
// src/components/auth/MfaGate.tsx
if (isLoading || !data) {
  if (isError) { ...tela com "Tentar novamente"... }
  return <div className="min-h-screen bg-background" />;   // vazia
}
```
O tema segue o do celular (`defaultTheme="system"`); com o iPhone no modo claro, `--background` é `220 14% 92%` (cinza quase branco). Por isso aparece "branco". As outras telas de espera (`ProtectedRoute`, `RequireStudent`, `PortalLayout`) mostram ícone e texto, e o `Login` mostra o formulário.

**2. Nada tem limite de tempo.** `carregarMfaEstado` aguarda `mfa.getAuthenticatorAssuranceLevel()` e `mfa.listFactors()`. As duas chamadas passam por `getUser()`, que vai à rede, e o fetch da biblioteca de login não tem tempo limite (não usa `signal`). Ao reabrir um atalho no iOS, uma requisição que fica parada mantém a promessa pendente para sempre: não há erro, não há nova tentativa e a tela fica vazia. A nova tentativa do React Query só acontece depois de um erro, e uma promessa pendente nunca dá erro.

**3. Suspeita 1 (ciclo de renovação): parcialmente confirmada, mas não é ela que deixa a tela branca.**
- `Login.tsx`: o efeito depende do objeto `user` (`[navigate, user, isReady, safeNext, tentativa]`). Cada `TOKEN_REFRESHED` gera um objeto novo, cancela a checagem em andamento e começa outra. E `checarPapelEquipe` chama `supabase.auth.refreshSession()` em `renovar` (lista vazia) e em `sessaoConfirmada` (token perto de vencer). Com lista vazia, isso vira um laço de verdade: renova → evento → checagem nova → lista vazia → renova… Nesse laço o formulário de login continua na tela, então ele explica um "não sai do login", não a tela branca.
- `ProtectedRoute` e `MfaGate` usam `user?.id` na chave, então não reiniciam. Mas o `Login` não usa a chave `["staff-access", id]`: chama `checarPapelEquipe` direto, e o `ProtectedRoute` refaz a mesma checagem logo depois (trabalho em dobro na abertura).

**4. Suspeita 2 (trava navigator.locks): descartada.** O `@supabase/auth-js` instalado (2.108.2) não usa trava por padrão (`this.lock = null`; só usa quando `settings.lock` é informado), e `client.ts` não informa trava. O que existe é a fila interna `initializePromise` e uma renovação de cada vez: se uma renovação fica parada na rede, todas as chamadas de login esperam por ela. Esse é o mesmo problema do item 2, a falta de tempo limite.

**5. Suspeita 4 (laço entre Guard, Login e portal): descartada.** `redirecionarAppEquipe` só manda `/`, `/portal` e `/portal/*` para `/login`. A equipe vai de `/login` para `/equipe`, e nenhum caminho leva de volta. Quem não é da equipe vê `AreaDaEquipe`, sem redirecionamento.

## B) Correção da checagem

- **Uma checagem por vez, compartilhada:** novo hook `useStaffAccess()` com `useQuery(["staff-access", user?.id])`, usado por `Login`, `ProtectedRoute` e `SiteLayout`. O `Login` decide para onde ir pelo **resultado** da consulta. Ele não roda mais um efeito que dependa do objeto `user`, e todas as dependências passam a ser `user?.id`.
- **`checarPapelEquipe` sem `refreshSession` manual:** a biblioteca já renova o token sozinha (`autoRefreshToken: true`, e `getSession()` renova quando o token venceu).
  - `sessaoConfirmada` usa só `getSession()` e confere se o token está válido e se é do mesmo usuário.
  - `getUser()` sai da checagem, porque era uma ida extra à rede.
  - Lista vazia: espera e tenta de novo, sem renovar. Na última tentativa conclui "não é equipe", como hoje.
- **Tempo limite de 8 s** em toda chamada de login ou banco feita na abertura, com o helper `comTempoLimite(promessa, 8000, rotulo)`. Estourar o tempo conta como **erro**, nunca como "não é equipe", e não gera nova tentativa (repetir algo travado só aumenta a espera). Isso vale para:
  - `getSession` e a leitura de papéis em `checarPapelEquipe`;
  - as duas chamadas de `carregarMfaEstado`;
  - a leitura do 2FA em `DiagnosticoSessao`;
  - o `signOut` do botão "Sair" (se ele travar, a sessão é apagada só no aparelho, como já faz `clearLocalAuthSession`).
- No `MfaGate`, a consulta passa a ter `retry: 1`, e o erro ou tempo esgotado cai na tela "Não foi possível verificar o 2FA" que já existe.

## C) Proteção contra tela branca

Novo componente `CarregandoComSaida`:
- Nos primeiros 8 s mostra o ícone e "Carregando...".
- Depois de 8 s mostra **"Está demorando mais que o normal"**, com:
  - o botão **"Tentar novamente"**, que repete a consulta ou recarrega a página;
  - o botão **"Sair"**, que tem tempo limite e apaga a sessão local;
  - o link **"Diagnóstico do app"**, que abre `/diagnostico-app`.
- Tem uma versão para a equipe e uma para o portal (`data-portal`), sem mudar cores.

Onde ele entra:
- `MfaGate`, no lugar da tela vazia;
- `ProtectedRoute`, no lugar do `FullScreenLoader`;
- `Login`, enquanto houver usuário e a checagem estiver rodando (hoje aparece o formulário sem saída clara);
- `RequireStudent`;
- `PortalLayout`.

## D) Diagnóstico

- `AuthContext`: cada evento de sessão é registrado (`INITIAL_SESSION`, `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`, `MFA_CHALLENGE_VERIFIED`), só com o nome do evento e os minutos de validade do token.
- O início e o fim de cada checagem de papel são registrados com a origem (`Login`, `ProtectedRoute`, `SiteLayout`).
- O início e o fim do 2FA (`ok`, `erro` ou `tempo_limite`) e as telas que mostraram "demorando" são registrados, com a página e os segundos.
- Eventos iguais em sequência viram uma linha só, com `repeticoes=N`, para que um laço não apague o histórico dos 30 eventos e fique visível.
- A lista de campos permitidos em `limparEvento` ganha `evento`, `origem`, `etapa`, `segundos` e `repeticoes`. Continuam proibidos token, senha e ids.

## E) Testes de regressão

1. **A checagem não repete quando só o token muda:** o `Login` é desenhado com o usuário de id X, depois recebe um objeto `user` novo com o mesmo id X (simulando `TOKEN_REFRESHED`). A checagem deve rodar **1 vez**.
2. **`checarPapelEquipe` com o login travado:** `sessaoConfirmada` nunca termina. Com o relógio simulado em 8 s, o resultado deve ser `status: "erro"` e `motivo: "tempo_limite"`. Mesmo teste com a leitura de papéis travada.
3. **`checarPapelEquipe` não renova a sessão:** com lista vazia, `refreshSession` não é chamado e o resultado final é "não é equipe" (ajuste em `papelEquipe.test.ts`).
4. **O carregamento oferece saída:**
   - antes de 8 s, `CarregandoComSaida` não mostra a mensagem;
   - depois de 8 s, mostra "Está demorando mais que o normal", os botões "Tentar novamente" e "Sair" e o link para `/diagnostico-app`.
5. **`MfaGate` sem tela vazia:** com `carregarMfaEstado` travado, depois de 8 s aparece a mensagem com as saídas.
6. **`comTempoLimite`:** deixa passar o resultado quando a chamada termina a tempo, rejeita com "tempo_limite" quando não termina e limpa o temporizador.
7. **Diagnóstico:** o evento `TOKEN_REFRESHED` é gravado sem token, e eventos repetidos viram uma linha com `repeticoes`.

No fim: `bunx vitest run` (informar quantos arquivos e testes rodaram), `bunx eslint` nos arquivos alterados e nenhum `any` novo.

## Arquivos

Novos:
- `src/lib/tempoLimite.ts`
- `src/hooks/useStaffAccess.ts`
- `src/components/CarregandoComSaida.tsx`
- `src/test/tempoLimite.test.ts`
- `src/test/carregandoComSaida.test.tsx`
- `src/test/loginChecagemUnica.test.tsx`
- `src/test/mfaGateTempoLimite.test.tsx`

Alterados:
- `src/lib/authAccess.ts`: sem refresh manual, sem `getUser`, com tempo limite e registro no diagnóstico
- `src/lib/mfa.ts`: tempo limite em `carregarMfaEstado`
- `src/lib/diagnosticoApp.ts`: campos novos e eventos repetidos agrupados
- `src/contexts/AuthContext.tsx`: registra os eventos de sessão; `signOut` com tempo limite e limpeza local
- `src/pages/Login.tsx`: usa `useStaffAccess` e mostra `CarregandoComSaida` enquanto checa
- `src/components/ProtectedRoute.tsx`: usa `useStaffAccess` e `CarregandoComSaida`
- `src/site/SiteLayout.tsx`: usa `useStaffAccess`
- `src/components/auth/MfaGate.tsx`: `CarregandoComSaida` no lugar da tela vazia e `retry: 1`
- `src/components/DiagnosticoSessao.tsx`: tempo limite
- `src/components/portal/RequireStudent.tsx`: `CarregandoComSaida`
- `src/components/portal/PortalLayout.tsx`: `CarregandoComSaida`
- `src/test/papelEquipe.test.ts`: sem `renovar`, com casos de tempo limite
- `src/test/diagnosticoApp.test.ts`: eventos de sessão e repetições
- `src/test/protectedRouteEquipe.test.tsx`: ajuste ao hook
- `AGENTS.md`: regra "checagem de papel compartilhada por `["staff-access", id]`, sem refresh manual, tempo limite de 8 s; toda tela de espera oferece saída depois de 8 s"

Sem migração. `src/lib/notificar.ts` (que também chama `refreshSession`) fica como está, porque não participa da abertura do app.

## Depois de publicar

Peça ao dono para abrir o atalho de novo. Se ainda houver demora, depois de 8 s vai aparecer o link "Diagnóstico do app" e ele pode copiar o histórico de dentro do atalho. O histórico mostra em qual etapa parou: sessão, papel ou 2FA.
