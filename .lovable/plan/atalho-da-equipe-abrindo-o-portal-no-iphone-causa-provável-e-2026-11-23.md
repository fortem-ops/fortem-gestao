# Atalho da equipe abrindo o portal no iPhone: causa provável e correção

## O que o código mostra (confirmado nesta leitura)

- Papéis: a regra de leitura de `user_roles` é `user_id = auth.uid()` (ou coord/admin). Se a consulta sair **sem o token do usuário**, o banco devolve **lista vazia, sem erro**. Hoje lista vazia vira `isStaff = false` em `userHasStaffAccess`.
- Com `isStaff = false`, três lugares mandam ao portal: `ProtectedRoute` (`<Navigate to="/portal">`), `Login.tsx` (fora do app da equipe) e `PortalLogin.tsx` (sempre).
- O admin (nicolas.janovik@gmail.com) está vinculado ao cadastro de aluno "Nicolas Squeff Janovik". Por isso o portal abre **já logado** e com a tela inicial completa, sem a tela de "conta sem cadastro".
- Marca do app: `equipe-app.html` e `lerAmbienteApp()` só usam o `localStorage` quando `navigator.standalone === true`. O `sessionStorage` só existe se a abertura passou por `equipe-app.html` naquela mesma sessão.
- `sw.js` só cuida de notificações. O clique numa notificação sem endereço abre `/portal`, mas isso não explica a reabertura pelo ícone.
- O site publicado serve `equipe-app.html` como página própria, e o `manifest-equipe.json` tem `start_url` `/equipe-app.html`.

## Caminho mais provável (não confirmado no aparelho, por isso o item A vem primeiro)

É uma combinação dos caminhos 1 e 2:

1. **Caminho 1, a marca não foi vista:** ao reabrir, o iPhone voltou à última página usada (ex.: `/equipe`) sem passar por `equipe-app.html`, e por isso o `sessionStorage` estava vazio. A marca no `localStorage` exige `navigator.standalone === true`. Se nesse iOS o app instalado pelo manifest informa standalone só por `display-mode`, a marca nunca foi gravada e nunca é lida. Resultado: o `AppEquipeGuard` fica desligado.
2. **Caminho 2, papel vazio sem erro:** na reabertura, a sessão é restaurada e o token pode estar vencido ou sendo renovado (rede ainda subindo no iPhone). A consulta de papéis sai sem token válido, volta `[]` sem erro, e o `ProtectedRoute` manda para `/portal`, que segue para `/portal/home`.

Por que não o 3 sozinho: o `Login.tsx` já não manda ao portal dentro do app da equipe *quando a marca existe*. Ele só mandaria se a marca faltasse, e aí cai no mesmo caso do caminho 1. O caminho 4 (notificação) não ocorre ao tocar no ícone.

O histórico do item A vai confirmar ou derrubar essa explicação. Se mostrar outra coisa, eu ajusto o plano antes de qualquer outra mudança.

## A) Diagnóstico no aparelho

- Histórico dos últimos 30 eventos no `localStorage` (`fortem_diag_app`). Os eventos registrados:
  - **abertura:** página e horário, `navigator.standalone`, `display-mode`, se é iPhone, marca no `localStorage` e no `sessionStorage`;
  - **sessão:** e-mail, se tem sessão, minutos até o token vencer, nível do 2FA;
  - **checagem de papel:** tentativa, lista de papéis ou código do erro, sessão confirmada sim/não;
  - **redirecionamento:** de onde, para onde, motivo e origem (`ProtectedRoute`, `Login`, `PortalLogin`, `AppEquipeGuard`, `equipe-app.html`, `/portal→/portal/home`).
- `equipe-app.html` também registra a sua abertura (script simples, mesma chave).
- Nunca entram no histórico: token, senha, id do usuário, nome, telefone ou parâmetros da URL (só o caminho). Um filtro descarta qualquer campo fora da lista permitida.
- Página `/diagnostico-app`: pública, só leitura, mostra o texto e tem o botão "Copiar". Funciona sem login e não é desviada pelo guard.
- Link discreto "Diagnóstico do app" no rodapé de `/login` e no fim da tela inicial do portal (texto cinza, no visual do portal).

## B) Nunca mandar equipe ao portal por engano

- Nova checagem única `checarPapelEquipe(userId)`, usada pelo `ProtectedRoute`, pelo `Login`, pelo `PortalLogin` e pelo atalho do site:
  - antes de consultar, confirma a sessão (`getSession`). Se o token estiver vencido ou perto de vencer, renova e confere com `getUser`. Sem sessão confirmada, o resultado é "erro", nunca "não é equipe";
  - lista vazia com sessão: renova a sessão e tenta de novo, até 3 vezes com espera curta. Só depois conclui "não é equipe";
  - resultado: `equipe`, `nao_equipe` ou `erro`, com os papéis lidos (para o diagnóstico).
- `ProtectedRoute`: sai o redirecionamento automático para `/portal`. Quem não tem acesso de equipe vê a tela **"Esta área é da equipe"**, com os botões "Ir para o portal do aluno" e "Sair". Erro continua na tela "Tentar novamente / Sair".
- `Login.tsx`: no navegador, aluno confirmado segue para o portal, como hoje. No app da equipe, mostra a mesma tela "Esta área é da equipe" em vez de deixar o formulário parado.
- `PortalLogin.tsx`: só vai ao portal com "não é equipe" confirmado. Com erro, fica no login.

## C) Marca do app da equipe mais robusta

- Standalone no iPhone passa a contar `navigator.standalone === true` **ou** `matchMedia('(display-mode: standalone)')`. A regra vale tanto em `equipe-app.html` quanto em `lerAmbienteApp()`.
- `fortem_app=equipe` passa a ser gravado também quando a checagem confirma equipe em modo standalone (no `Login` e no `ProtectedRoute`), e não só em `equipe-app.html`.
- **Cuidado com o Android:** no Android, os dois atalhos dividem o mesmo `localStorage` do Chrome. Uma marca permanente ali faria o atalho do aluno de um professor que também é aluno cair no login da equipe. Por isso a marca permanente fica **só no iPhone**, onde cada atalho tem o seu próprio armazenamento. No Android continua só a marca da sessão, que o Chrome sempre recria porque reabre pelo `start_url`.

## D) Testes de regressão

- `checarPapelEquipe`: lista vazia e depois papéis resulta em equipe; três listas vazias resultam em "não é equipe" só depois das tentativas; sem sessão confirmada resulta em erro; erro do banco resulta em erro.
- `ProtectedRoute` (jsdom): usuário sem papel de equipe vê "Esta área é da equipe" e nunca é levado a `/portal`; erro mostra "Tentar novamente".
- Ambiente do app: iPhone com `navigator.standalone` ausente, `display-mode` standalone e marca no `localStorage` é reconhecido como app da equipe; com isso `/portal/home` vai para `/login`. Android standalone com marca só no `localStorage` **não** vira app da equipe.
- Marca: equipe confirmada em standalone no iPhone grava a marca; fora do standalone não grava.
- Diagnóstico: guarda no máximo 30 eventos; descarta campos de token e senha e os parâmetros da URL.
- Rodar `bunx vitest run` e eslint nos arquivos alterados, sem `any`.

## O que muda para quem já instalou

- **Equipe no iPhone, atalho adicionado por `equipe-app.html`:** não precisa reinstalar. A marca passa a ser gravada no próximo login pelo atalho.
- **Atalho antigo do iPhone, feito antes de `equipe-app.html`:** já precisava ser refeito, e isso não muda.
- **Alunos:** nada muda. O atalho do aluno continua com `id` `/portal`.
- **Android:** nada muda no comportamento.

## Como o dono testa

1. Publicar.
2. No iPhone, abra o app pelo atalho "FORTEM Equipe", entre, feche o app de vez e abra de novo.
3. Se abrir errado, toque em "Diagnóstico do app" no rodapé (do login ou do portal), depois em "Copiar", e me mande o texto.

## Detalhes técnicos

Arquivos novos:
- `src/lib/diagnosticoApp.ts` (histórico com limite de 30 e filtro de campos)
- `src/pages/DiagnosticoApp.tsx` (página `/diagnostico-app`)
- `src/components/auth/AreaDaEquipe.tsx` (tela "Esta área é da equipe")
- `src/test/papelEquipe.test.ts`, `src/test/protectedRouteEquipe.test.tsx`, `src/test/diagnosticoApp.test.ts`

Arquivos alterados:
- `src/lib/authAccess.ts` (`checarPapelEquipe`; `userHasStaffAccess` passa a usá-la)
- `src/lib/appInstalavel.ts` (standalone no iPhone, `gravarMarcaEquipe`, marca permanente só no iPhone)
- `public/equipe-app.html` (mesma regra de standalone e registro no diagnóstico)
- `src/components/ProtectedRoute.tsx`, `src/pages/Login.tsx`, `src/pages/portal/PortalLogin.tsx`
- `src/components/AppEquipeGuard.tsx` (registra os desvios)
- `src/site/SiteLayout.tsx` (mesma chave de cache `staff-access`, com o novo formato)
- `src/pages/portal/PortalHome.tsx` (link no rodapé)
- `src/App.tsx` (rota `/diagnostico-app`)
- `src/test/appEquipeStandalone.test.ts`
- `AGENTS.md` (regra do atalho atualizada: marca permanente só no iPhone e papel vazio nunca leva ao portal)

Fora do escopo: o endereço padrão `/portal` no clique de notificação do `sw.js`. Dentro do app da equipe, o guard corrigido já cobre esse caso.

Sem migração e sem mudança no banco.
