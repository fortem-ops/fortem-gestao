## Regra: jornadas até 4h não têm intervalo

Hoje a regra já existe parcialmente: na tela de Ponto (`src/pages/Ponto.tsx`), quando a janela do dia tem ≤ 240 minutos (4h), o `BotaoInteligente` recebe `pularIntervalo=true` e pula direto de "Iniciar jornada" para "Encerrar jornada", sem botões de intervalo.

O que falta é a configuração do Admin refletir isso: hoje o coordenador/admin pode salvar uma janela de 3h com "15 min de intervalo" e gerar divergência no relatório. Vamos fechar essa porta.

### Mudanças (somente frontend)

**`src/components/ponto/AdminPontoHorarios.tsx` (linha do `DiaRow`)**

1. Calcular `janelaMin = (fim - início) em minutos` reativamente conforme o usuário muda os selects.
2. Se `janelaMin > 0 && janelaMin <= 240`:
   - Forçar `intervalo = 0` (efeito que reseta quando a janela cruza o limite).
   - Desabilitar o `Select` de Intervalo e fixar o valor visível em "Sem intervalo".
   - Mostrar um hint discreto abaixo: "Jornadas até 4h não têm intervalo (apenas entrada e saída)."
3. Se `janelaMin > 240`: comportamento atual (Sem intervalo / 15 min / 1 hora).

**`src/pages/Ponto.tsx`**

- Sem mudança de lógica — a regra `pularIntervalo` já cobre os dois caminhos:
  - há horário cadastrado: `intervaloPrevistoMin === 0 || cargaPrevistaMin ≤ 240`
  - sem horário cadastrado: fallback `cargaMin ≤ 240`
- Apenas atualizar o texto do header (linha 185) para deixar a regra explícita quando a janela for ≤ 4h: `"jornada de até 4h • sem intervalo"`.

### Por que não mexer no banco

- Não há registros corrompidos que motivem migração agora; a UI passa a impedir entradas inválidas daqui pra frente.
- Se quiser, posso adicionar depois um trigger em `ponto_horarios_professor` que zera `intervalo_min` quando `(horario_fim - horario_inicio) ≤ '4 hours'`. Hoje seria overkill — a regra é só de UX.

### Fora de escopo

- Recalcular jornadas históricas com intervalo configurado errado.
- Mudar o cálculo de divergências/banco de horas (`pontoTolerancia.ts`) — segue usando `prev_intervalo_min` da própria jornada.
