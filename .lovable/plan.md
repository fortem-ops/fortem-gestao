## Mudança

Em `src/pages/StudentList.tsx`, na coluna **Serviços do Plano** (componente `CreditsCell`, ~linha 342):

Trocar a cor dos ícones/contadores:
- **Verde** (`text-success`) quando `restante > 0` (há créditos disponíveis).
- **Vermelho** (`text-destructive`) quando `restante <= 0` (todos os créditos foram utilizados).
- Ilimitado (`∞`) permanece verde (`text-success`).

Atualmente a regra usa `text-primary` para o caso "com crédito", o que não diferencia visualmente de forma clara o "disponível" do "esgotado" conforme o padrão verde/vermelho usado nas demais telas do aluno (Plano / Serviços).

Mesma mudança vale para a coluna **Serviços Contratados** (mesmo `CreditsCell`), mantendo consistência entre as duas colunas.

### Arquivo alterado
- `src/pages/StudentList.tsx` (apenas a linha de cor do `CreditsCell`)