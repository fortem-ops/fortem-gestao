## Mudança

Em `src/components/ponto/AdminPontoHorarios.tsx`, expandir a lista `HORARIOS` para começar às **05:00** em vez de 06:00, adicionando os slots 05:00, 05:15, 05:30 e 05:45 (mantendo o passo de 15 min até 21:15).

### Detalhe técnico

Trocar o loop:
```ts
for (let h = 6; h <= 21; h++) { ... }
```
por:
```ts
for (let h = 5; h <= 21; h++) { ... }
```

Atualizar também o texto descritivo do card de "06:00–21:15" para "05:00–21:15".

Nenhuma alteração no banco — o campo já aceita qualquer `time`.