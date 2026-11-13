# Reabrir a confirmação de presença em /10anos até 14/11

## O que muda
- A confirmação de presença volta a ficar aberta até **14/11/2026, 23:59 (Brasília)**.
- O texto da página passa a dizer "até 14 de novembro".
- O Pix gerado na confirmação continua valendo até o fim do novo prazo.
- Valores (R$ 75 por adulto, crianças isentas), confirmações e pagamentos já feitos não mudam.

## Detalhes técnicos
- `supabase/functions/_shared/festa-prazo.ts`: `FESTA_PRAZO_ISO = "2026-11-14"`, `FESTA_PRAZO_TEXTO = "até 14 de novembro"` (fonte única usada por site, `festa-confirmar` e `festa-pix`).
- Atualizar `src/test/festa10anos.test.ts` para o novo prazo (aberto em 14/11 23:59, fechado em 15/11 00:00).
- Republicar `festa-confirmar` (e funções que importam o prazo); atualizar a memória do prazo.
- Rodar `bunx vitest run` e lint; a página precisa de Publish.
