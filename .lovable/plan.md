# Investigação — erro "insertBefore" ao bater ponto no celular

## 1. Onde está o fluxo

Existe **uma única tela responsiva**, sem versão mobile separada:

- `src/pages/Ponto.tsx` — página do profissional (desktop e mobile são a mesma árvore).
- `src/components/ponto/BotaoInteligente.tsx` — o botão único que registra entrada / intervalo / saída.
- `src/lib/ponto.ts` — `tryGeo()` (geolocalização), `localMaisProximo()` e geofencing de 300 m.
- Coordenador/admin usa a mesma página em modo "Visualizar como" (leitura) e `PontoEquipe.tsx` / `RelatorioPonto.tsx` para ajustes — nesses caminhos **o botão nem é renderizado** (`!isViewingOther`).

Não há `createPortal` manual em nenhum ponto do módulo. Os portals são todos internos ao Radix (AlertDialog, Dialog, Tooltip, Select) e ao Sonner (`<Sonner />` montado em `src/App.tsx`).

## 2. Diferença real entre desktop e mobile

A diferença não é de código, é de **resultado da geolocalização**:

- No desktop (navegador sem GPS, permissão negada, ou timeout de 4 s) `tryGeo()` devolve `{lat: null, lng: null}` → o código pula toda a checagem de raio e vai direto para o diálogo de encerramento. Um único diálogo é aberto.
- No celular o GPS responde com coordenadas reais. Se a distância for maior que 300 m de todos os locais (Matriz, Orla, Ramiro Souto) — o que acontece com facilidade por deriva de GPS ou por a professora estar em atendimento externo — entra o **segundo** diálogo (`geoAlerta`).

Ou seja: o caminho de dois diálogos só é alcançável no celular.

## 3. Hipótese de causa raiz

Em `BotaoInteligente.tsx`, o `AlertDialogAction` do diálogo "Você está fora da Fortem" faz, no mesmo clique / mesmo lote de renderização:

```
onClick={() => {
  geoAlerta?.onConfirm();   // → setConfirmOpen(true)  (abre o 2º AlertDialog)
  setGeoAlerta(null);       // → fecha o 1º AlertDialog
}}
```

Os dois `AlertDialog` são irmãos na árvore. No mesmo commit, o React manda o Radix **desmontar o portal do diálogo A (com animação de saída, focus guards e restauração de foco/scroll-lock no `<body>`) e montar o portal do diálogo B**. Os focus guards e o nó de portal são inseridos/removidos diretamente no `document.body` pelo Radix; quando duas instâncias fazem isso na mesma microtask, a referência de "nó anterior" que o React guardou já não é mais filha do `<body>`, e o commit falha exatamente com `Failed to execute 'insertBefore' on 'Node'`.

Fatores que tornam o caso mais provável no celular:
- A janela é fechada/reaberta ainda durante a animação de saída (mais lenta em aparelho fraco).
- O teclado virtual do Android/iOS pode ser invocado pelo `Textarea` de observação do diálogo de encerramento, que aparece **no mesmo frame** em que o outro diálogo está saindo — o browser reflui o layout no meio do commit.
- `handleClick` roda `await tryGeo()` e depois `setState` — se o componente for re-renderizado por um refetch do React Query (`refetchInterval: 60_000` em `ponto-estado`) no intervalo, o estado do diálogo muda junto com a substituição da árvore de `<StatusJornadaCard>` / `<ResumoDoDia>`.

Suspeito secundário (menos provável, mas na mesma tela): `ConsentimentoGeoDialog` em `Ponto.tsx` tem `open` derivado de duas queries assíncronas (`consentimento` e `termoVigente`). Se qualquer uma revalidar enquanto um `AlertDialog` está abrindo, um terceiro portal entra em cena no mesmo commit. E `ResumoDoDia` monta um `TooltipProvider`/`Tooltip` por linha de evento — no touch, o tooltip abre por toque e também usa portal.

## 4. Correção proposta (para sua validação, ainda não aplicada)

1. **Serializar a troca de diálogos** em `BotaoInteligente.tsx`: fechar o `geoAlerta` primeiro e só abrir o diálogo de encerramento (ou disparar a mutation) depois que a saída terminar — via um `useEffect` disparado por um estado `pendenteAposGeo`, ou um `requestAnimationFrame`/`setTimeout(0)`. Nunca dois `open` mudando no mesmo handler.
2. **Unificar em um único `AlertDialog`** cujo conteúdo muda por estado (`"fora_do_raio" | "encerrar"`), eliminando o par montar/desmontar simultâneo. É a correção mais robusta.
3. Envolver o bloco do botão num `ErrorBoundary` local, para que uma falha de reconciliação não derrube a tela inteira do ponto (a batida já foi ou não gravada no servidor de qualquer forma).
4. Opcional: mover o `TooltipProvider` de `ResumoDoDia` para um provider único no topo, em vez de um por linha.

## 5. Verificação após a correção

- Reproduzir no Chrome mobile emulado com geolocalização forçada fora dos 300 m (ex.: -30.10, -51.30) e executar entrada → saída, confirmando "Registrar assim mesmo" e depois "Encerrar agora".
- Confirmar que nenhum erro de `insertBefore` aparece no console e que o evento de saída chega em `ponto_eventos`.
