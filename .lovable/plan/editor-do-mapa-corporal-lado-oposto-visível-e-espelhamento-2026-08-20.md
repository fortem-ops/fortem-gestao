# Editor do Mapa Corporal: lado oposto visível e espelhamento

Todas as formas do banco já existem em pares (`*-direito` / `*-esquerdo`), nas duas vistas. Isso permite parear o lado oposto automaticamente pela chave.

## 1. Ver o lado oposto ao mesmo tempo

- Ao selecionar uma forma (ex.: Deltoide E), o editor identifica automaticamente o par (Deltoide D) e desenha o contorno dele no SVG como "fantasma": preenchimento mais fraco, traço tracejado, sem pontos arrastáveis.
- Um botão de alternância "Mostrar lado oposto" (ligado por padrão) permite esconder o fantasma.
- Um botão "Trocar para o lado oposto" muda a seleção para o par, mantendo a mesma posição de trabalho — útil para alternar entre os dois enquanto ajusta.
- O atalho <kbd>H</kbd> e o botão "Ocultar pontos" continuam funcionando como hoje (o fantasma segue as mesmas regras de visibilidade da malha de pontos, mas o contorno permanece).

## 2. Copiar e espelhar

- Novo botão "Copiar e espelhar para o lado oposto" no painel da forma selecionada.
- Comportamento: pega os pontos em edição, espelha horizontalmente em torno do eixo central do corpo (x = 512 no viewBox de 1024) — cada ponto vira `[1024 - x, y]` — inverte a ordem dos pontos para manter o sentido do contorno, e grava no par oposto.
- Confirmação antes de sobrescrever, já que o contorno atual do lado oposto será substituído.
- Após salvar, aviso de sucesso e o fantasma do lado oposto atualiza na hora, mostrando as duas metades simétricas.
- Se a forma selecionada ainda não estiver salva, o botão salva a atual primeiro e depois espelha, para os dois lados ficarem idênticos.
- Quando não existir par correspondente, o botão fica desabilitado com explicação.

## Detalhes técnicos

- Arquivo único alterado: `src/pages/BodyMapShapesConfig.tsx`.
- Pareamento: troca do sufixo `-direito` <-> `-esquerdo` na `shape_key`, buscando na mesma vista (`view`).
- Espelhamento: `pontos.map(([x, y]) => [1024 - x, y]).reverse()`.
- Persistência via `saveShape` do hook `useBodyMapShapes` já existente (nenhuma alteração de banco, nenhum SQL).
- Renderização do fantasma reutiliza `pointsToSmoothPath`.
