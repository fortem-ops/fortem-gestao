# Ajuste de rótulos na camada Força do mapa corporal

## Objetivo
Renomear os exercícios de força relacionados ao quadril para refletir a musculatura alvo:
- **Abdução de quadril** → **Glúteo Médio**
- **Extensão de quadril** → **Glúteo**

## Escopo
- Alteração somente nos rótulos de exibição da camada **Força**.
- Nenhuma mudança em chaves internas, IDs de região, cálculos de assimetria, cores ou lógica de negócio.
- Modo **Lançamento** e **Resultados** permanecem inalterados em estrutura.

## Arquivos envolvidos
- `src/components/student/assessment/funcionalV2/bodyMapLogic.ts`
  - Atualizar `FORCA_EXERCICIO_LABEL`:
    - `abducao_quadril`: `"Abdução de quadril"` → `"Glúteo Médio"`
    - `extensao_quadril`: `"Extensão de quadril"` → `"Glúteo"`

## Validação
- Executar `bunx tsc --noEmit` (ou `tsgo --noEmit`) para garantir que não há quebra de tipos.
- Verificar visualmente no modo Resultados > Força se os cards/painéis exibem os novos rótulos.
- Confirmar que testes existentes não dependem dos textos antigos (busca por `"Abdução de quadril"` / `"Extensão de quadril"`).

## Riscos
- Baixo: alteração puramente textual em constante de exibição.
- Médio: se algum teste de snapshot ou texto espera o label antigo, precisará de atualização.
