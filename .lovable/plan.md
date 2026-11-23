# Atalho "FORTEM Equipe" abrindo o portal no iPhone

## Causa raiz (por hipótese)

1. **Confirmada pelo código, causa principal.** O `index.html` traz fixo `manifest-aluno.json` (`start_url: /portal`). Na tela `/login`, só o `AppInstalavelSync` troca o manifest e as tags `apple-*`, e só depois que o React carrega. O Safari lê o manifest quando a página carrega e não volta a ler quando o link muda. Por isso o atalho pegou o nome e o ícone da equipe, que vêm das tags `apple-*` lidas na hora de adicionar, e o `start_url` do aluno. Ao reabrir, o iOS abre o `start_url` (`/portal`). Não testei num iPhone real. Mas é o único caminho no código que leva a `/portal` sem passar pelo login, e explica exatamente o que o dono viu.
2. **Confirmada, é um segundo caminho para o mesmo erro.** No `Login.tsx` (linhas 64-71), se `userHasStaffAccess` falhar, o `.catch` manda para `/portal`. No `PortalLogin.tsx` (linha 49), a promessa não tem `.catch`. O `ProtectedRoute` já falha fechado, com a tela `AccessCheckError`. O `Login.tsx` não.
3. **Contribui, mas não causa.** No iOS, cada atalho guarda o próprio login, separado do Safari. Por isso o dono teve de entrar de novo dentro do app. Ao reabrir, a sessão volta e o token pode estar sendo renovado. É justamente quando a checagem de papel tem mais chance de falhar e cair no fail-open do item 2.
4. **Confirmada.** `RequireStudent` só exige estar logado, então uma sessão de equipe entra no `/portal`. Esse é o comportamento certo no navegador, porque um funcionário também pode ser aluno. Dentro do app da equipe, porém, o portal não deve abrir.

## Solução escolhida

**A. Página de entrada própria da equipe, já com tudo no HTML inicial**
- Novo `public/equipe-app.html`, um arquivo estático, sem React. O `<head>` já traz `manifest-equipe.json`, `apple-mobile-web-app-title="FORTEM Equipe"`, `apple-touch-icon` da equipe e `apple-mobile-web-app-capable`. O script grava a marca do app da equipe e faz `location.replace("/login")`.
- No `manifest-equipe.json`, o `start_url` passa a ser `/equipe-app.html`. O `id` `/?app=equipe` não muda.
- O dono e a equipe adicionam o atalho a partir de `soufortem.com.br/equipe-app.html`. A página mostra, por 1-2 segundos, a instrução "Compartilhar → Adicionar à Tela de Início" quando aberta no Safari, fora do app. No app instalado, ela redireciona direto. O `/login` em navegador mostra um link "Instalar app da equipe" que leva a essa página.
- Por que é a mais robusta: não depende de JavaScript trocar o manifest. Safari e Chrome leem o manifest certo no primeiro carregamento. E mesmo que algum iOS antigo ignore o `start_url` e use a URL da página, a URL é a própria `equipe-app.html`.

**B. Marca do app da equipe (segunda proteção)**
- `equipe-app.html` grava `fortem_app=equipe` em `sessionStorage`, e também em `localStorage` só quando `navigator.standalone === true` (iPhone). No iPhone o armazenamento é isolado por atalho, então a marca não vaza para o Safari nem para o atalho do aluno. No Android, `localStorage` é o mesmo do Chrome, por isso lá só vale `sessionStorage`, que é renovado a cada abertura pelo `start_url`.
- Nova regra `appEquipeStandalone()` em `src/lib/appInstalavel.ts`: modo standalone (`display-mode: standalone` ou `navigator.standalone`) e marca presente.
- Novo guarda no `App.tsx`: se `appEquipeStandalone()` for verdadeiro e a rota for `/portal*` ou `/`, vai para `/login`. Assim o app da equipe nunca abre o portal.
- O `AppInstalavelSync` continua igual, para as demais telas.

**C. Fail-closed no login**
- `Login.tsx`: no erro da checagem de papel, nunca ir para `/portal`. Tenta de novo 2 vezes, com espera crescente, depois de `isReady`. Se continuar falhando, mostra a tela `AccessCheckError` (Tentar de novo / Sair), a mesma do `ProtectedRoute`. `safeNext` continua valendo só quando a checagem dá certo.
- `PortalLogin.tsx`: adicionar `.catch` que fica na tela do portal, sem redirecionar e sem erro solto.
- A decisão vai para uma função pura, `destinoAposChecagem({ isStaff | erro, safeNext, appEquipe })`, que pode ser testada.

**D. O que não muda**
- `manifest.json` e `manifest-aluno.json`: `id` `/portal` e `start_url` `/portal` iguais. Quem já instalou o app do aluno não sente nada.
- O portal no navegador continua aceitando funcionário que também é aluno.

## Testes de regressão (`src/test/appEquipeStandalone.test.ts`)
- Erro na checagem de papel → o destino nunca é `/portal` (é "erro/tentar de novo").
- App da equipe em standalone, com a marca, na rota `/portal` ou `/` → redireciona para `/login`.
- Navegador comum, ou app do aluno sem a marca, em `/portal` → fica no portal.
- `manifest-equipe.json`: `start_url` = `/equipe-app.html`, `id` = `/?app=equipe`. Aluno continua com `id` `/portal`.
- `equipe-app.html` contém o link para `manifest-equipe.json` e o título "FORTEM Equipe" no HTML estático.
- Rodar `bunx vitest run` e eslint nos arquivos alterados, sem `any`.

## Arquivos
- Novos: `public/equipe-app.html`, `src/components/AppEquipeGuard.tsx`, `src/test/appEquipeStandalone.test.ts`.
- Alterados: `public/manifest-equipe.json`, `src/lib/appInstalavel.ts`, `src/App.tsx`, `src/pages/Login.tsx`, `src/pages/portal/PortalLogin.tsx`, `AGENTS.md` (a regra dos atalhos passa a citar `equipe-app.html` e a marca), `roadmap.md`.
- Sem migração e sem mudança no banco.

## Precisa apagar e adicionar de novo?
**Sim, no iPhone.** O iOS grava o `start_url` (`/portal`) na hora de adicionar e não o atualiza depois. No Android, o Chrome atualiza o manifest sozinho com o tempo, mas apagar e adicionar de novo é mais rápido e garante.

Texto para a equipe:
> Quem adicionou o atalho "FORTEM Equipe" no celular: apague o atalho, abra soufortem.com.br/equipe-app.html no Safari (iPhone) ou Chrome (Android) e toque em Compartilhar → "Adicionar à Tela de Início". Depois entre com seu login.

## Como o dono testa no iPhone (depois de publicar)
1. Apagar o atalho "FORTEM Equipe" atual.
2. No Safari, abrir `soufortem.com.br/equipe-app.html` → Compartilhar → Adicionar à Tela de Início. Conferir o nome "FORTEM Equipe" e o ícone com a faixa.
3. Abrir pelo atalho → abre o login da equipe → entrar, com 2FA → cai em `/equipe`.
4. Fechar o app de vez (arrastar para cima no seletor de apps) e abrir de novo → tem de abrir na equipe.
5. Repetir o passo 4 no dia seguinte, quando o token já expirou → tem de abrir na equipe ou na tela "Tentar de novo", nunca no portal.
6. Abrir o atalho do aluno → continua abrindo o portal.
