# Dois atalhos de tela inicial: FORTEM Aluno e FORTEM Equipe

## O que foi confirmado no código
- `public/manifest.json` único: `FORTEM Aluno`, `start_url /portal`, `scope /`, sem `id`.
- `index.html` linka esse manifest fixo, com `apple-mobile-web-app-title = FORTEM` e `apple-touch-icon = /icon-192.png`.
- Login da equipe: rota `/login`. Início da equipe: `/equipe` (dentro de `ProtectedRoute requireStaff` + `AppLayout`). Portal: `/portal/*` (login em `/portal/login`).
- Push: `/sw.js` registrado com escopo `/` em `usePushNotifications.ts`. Login Google/Apple do portal volta para `window.location.origin`.

## Manifests
| | Aluno (`manifest-aluno.json`, o atual renomeado) | Equipe (`manifest-equipe.json`, novo) |
|---|---|---|
| name / short_name | FORTEM Aluno / FORTEM | FORTEM Equipe / FORTEM Equipe |
| id | `/?app=aluno` | `/?app=equipe` |
| start_url | `/portal` | `/login` (já logado, o login leva a `/equipe`) |
| scope | `/` | `/` |
| ícones | `icon-192.png`, `icon-512.png` | `icon-equipe-192.png`, `icon-equipe-512.png` (maskable) |

`/manifest.json` continua existindo com o conteúdo do aluno, para não quebrar atalhos já instalados de alunos (o celular guarda o endereço do manifest na instalação).

**Por que scope `/` nos dois:** as telas da equipe não têm prefixo comum (`/equipe`, `/alunos`, `/financeiro`...), e o portal usa `/` para voltar do Google/Apple. Um scope menor faria o app abrir links fora dele numa aba do navegador, quebrando navegação e login social. O que permite os dois conviverem é o `id` diferente (e, no iPhone, cada atalho é independente de qualquer forma).

## Troca automática pela rota
- Função pura `appDaRota(pathname)` em `src/lib/appInstalavel.ts`:
  - `/portal*` e site público (`/`, `/planos`, `/10anos`...) → aluno.
  - `/login`, `/recuperar-senha`, `/redefinir-senha` → equipe.
- Componente `AppInstalavelSync` montado no topo do `App.tsx`: a cada mudança de rota troca `link[rel=manifest]`, `apple-mobile-web-app-title` e `apple-touch-icon`.
- Para as rotas de equipe (muitas, sem prefixo), o `AppLayout` da equipe força "equipe" ao montar — assim qualquer tela `requireStaff` usa o manifest da equipe sem precisar listar rotas.
- A troca ocorre no primeiro desenho da tela, bem antes de a pessoa abrir o menu "Adicionar à Tela de Início".
- `index.html` mantém o do aluno como padrão (vale para quem abre o site sem JavaScript).

## O que não muda
- Push: `/sw.js` e seu escopo `/` intocados; o manifest não interfere no service worker.
- Login Google/Apple do portal, `MfaGate` e o 2FA: sem alterações.
- `display: standalone` nos dois.

## Sessão pelo atalho da equipe
- Android (Chrome): o atalho compartilha a sessão do Chrome; quem já está logado entra direto, sem novo código 2FA.
- iPhone (Safari): o iOS dá ao atalho um armazenamento próprio, separado do Safari. Na primeira abertura pelo atalho a pessoa faz login + código 2FA uma vez; depois a sessão fica guardada no atalho como no navegador, e o código só volta em novo login. Isso é do iPhone e vale também para o portal hoje.

## Ícone da equipe
Mesma base do ícone atual (fundo escuro, marca FORTEM), com uma faixa inferior vermelha #E73C3E escrito "EQUIPE" em Archivo, dentro da área segura do maskable (80% central) para não ser cortada no Android.
Primeiro passo da implementação: gerar uma prévia, mostrar a você e **parar para aprovação**; só depois gero os PNGs 192 e 512 definitivos.

## Arquivos
- `public/manifest-aluno.json` (novo, conteúdo atual + `id`), `public/manifest.json` (mantido igual ao do aluno + `id`)
- `public/manifest-equipe.json`, `public/icon-equipe-192.png`, `public/icon-equipe-512.png` (novos)
- `index.html` (aponta para `manifest-aluno.json`)
- `src/lib/appInstalavel.ts`, `src/components/AppInstalavelSync.tsx` (novos)
- `src/App.tsx` (monta o sync), `src/components/layout/AppLayout.tsx` (força equipe)
- `src/test/appInstalavel.test.ts` (novo)
- `AGENTS.md` (regra: manifest escolhido pela rota; ids fixos)

## Testes
- `/portal/home` e `/portal/login` → aluno; `/login` e `/equipe` → equipe; `/` → aluno.
- Lê os dois JSON e confere `id` diferentes, `start_url` `/portal` e `/login`, nomes corretos.
- `bunx vitest run` + eslint nos alterados, sem `any`. Conferência no navegador de que a tag do manifest muda ao navegar.

## Como testar no celular (após publicar)
- **Android/Chrome:** abrir soufortem.com.br/login → menu ⋮ → "Adicionar à tela inicial" → nome deve ser "FORTEM Equipe" com o ícone novo. Depois abrir /portal/login → instalar → "FORTEM Aluno". Os dois ícones devem aparecer e abrir cada um na sua tela.
- **iPhone/Safari:** abrir /login → Compartilhar → "Adicionar à Tela de Início" → nome "FORTEM Equipe" já preenchido e ícone novo. Repetir em /portal/login para o do aluno.

## Texto para a equipe
"Pessoal, corrigimos o atalho do sistema no celular. Quem adicionou o FORTEM à tela inicial e ele abre o portal do aluno: apague esse atalho, abra soufortem.com.br/login no Chrome (Android) ou Safari (iPhone) e toque em 'Adicionar à tela inicial'. O novo atalho se chama FORTEM Equipe. No iPhone, no primeiro acesso pelo atalho, será preciso entrar de novo com o código do autenticador."
