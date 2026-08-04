# Corrigir "não consigo visualizar as páginas"

## O que está acontecendo

O console mostra, em `/agenda` e `/clube`:

```text
TypeError: Failed to fetch dynamically imported module: .../assets/Agenda-BffLbj2n.js
TypeError: Failed to fetch dynamically imported module: .../assets/Clube-Ckc0vE9V.js
```

Todas as páginas são carregadas via `React.lazy(() => import(...))` em `src/App.tsx`. Quando uma nova versão do app é publicada, os arquivos de página ganham novos nomes (hash) e os antigos deixam de existir. O navegador que ainda está com a versão antiga aberta (ou com o service worker/cache antigo) tenta buscar o arquivo velho, recebe erro e cai no ErrorBoundary — daí a tela de erro em vez da página.

Ou seja: não é um bug de uma página específica, é falha de carregamento de chunk após atualização. Um "hard refresh" resolve pontualmente, mas o app precisa se recuperar sozinho.

## O que fazer

1. **Auto-recuperação de chunk desatualizado**
   - Criar um helper `lazyWithReload` em `src/lib/lazyWithReload.ts` que envolve cada `import()` dinâmico: se a importação falhar com erro de "Failed to fetch dynamically imported module" / "Importing a module script failed", ele recarrega a página uma única vez (marcando um flag em `sessionStorage` para nunca entrar em loop de reload).
   - Trocar todos os `lazy(() => import(...))` de `src/App.tsx` por esse helper.

2. **Limpar cache antigo do service worker nesse caso**
   - Antes do reload automático, desregistrar o service worker atual e limpar `caches` da origem, garantindo que a nova versão do `index.html` e dos assets seja buscada da rede.

3. **Mensagem clara caso o reload não resolva**
   - No `ErrorBoundary`, detectar esse tipo de erro e mostrar "Nova versão disponível — recarregue a página" com o botão de recarregar em destaque, em vez da mensagem técnica atual.

## Detalhes técnicos

- Arquivos: `src/lib/lazyWithReload.ts` (novo), `src/App.tsx` (troca dos ~60 `lazy(...)`), `src/components/ErrorBoundary.tsx` (mensagem específica), `src/main.tsx` (registro do SW inalterado).
- Nenhuma mudança de backend, dados ou layout das páginas.
