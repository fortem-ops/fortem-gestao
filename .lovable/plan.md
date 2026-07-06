## Diagnóstico (somente leitura — nada foi alterado)

### O que aconteceu na tentativa (17:25–17:26 UTC de hoje)

1. **Upload no Storage** — OK. Arquivo salvo em `aluno-files/avaliacoes/laudos-dinamometria/9fe79b6b…/1783358750286-2026_-_AVALIACAO_FORCA_-_Filipe_de_Oliveira_Freitas.pdf` (2,17 MB). A sanitização do nome funcionou perfeitamente (sem acentos, espaços viraram `_`).
   - Observação lateral: o `aluno_id` é o do Lourival, mas o PDF em si é do Filipe — provavelmente o usuário selecionou o arquivo errado. Não é a causa do erro.

2. **Edge function `parse-kinology-pdf`** — só há eventos de boot no log, nenhum throw explícito, nenhum shutdown com erro.

3. **AI Gateway** — sucesso. `log_id 019f3877-1e02-78e9-a189-badee01ee309`, gemini-2.5-pro, HTTP 200, **22.438 ms**, JSON válido com 6 exercícios (todos passariam pelo filtro do enum + números).

4. **Banco** — nenhuma linha `funcional_v2` foi criada. Só há a `experimental` antiga (29/06). O protocolo default `funcional_v2` existe e está ativo (`f6c9aa11-adbc-43d4-be41-7b3e09e42b30`), então essa não é a causa. Triggers e RLS de `avaliacoes` não bloqueiam esse insert.

### Causa raiz mais provável

**Timeout de wall-clock da edge function.** Timeline:

```text
17:25:52  upload OK
17:25:54  cold boot #1
17:25:55  cold boot #2
17:25:55  função baixa PDF do Storage + faz base64 do buffer de 2,17 MB
17:26:20  começa chamada IA  (25 s desde o boot)
17:26:42  IA responde OK (22,4 s de duração)
~17:26:42 função tenta retornar → cortada antes de o cliente receber
```

Total ~47 s de wall-clock. O runtime provavelmente encerrou o worker (ou o `functions.invoke` do cliente estourou timeout) antes de a resposta chegar ao browser, o que na UI aparece exatamente como "Erro ao importar laudo" após o toast "Lendo laudo com IA…". Consistente com:

- ausência de INSERT `funcional_v2` (o cliente nunca chegou a rodar `buildForcaPayload` + `.insert(...)`),
- ausência de linha de erro/shutdown na função (kill é externo),
- tempo total bater com o "ficou carregando um tempo" reportado.

Hipótese secundária (menos provável): throw silencioso no cliente entre `uploadAndParseKinology` e o INSERT — sem `console.log` intermediário ou log server-side não dá pra confirmar 100%.

### O que NÃO é a causa

- Não é o nome do arquivo — a sanitização funcionou.
- Não é RLS/trigger no `avaliacoes`.
- Não é protocolo default ausente.
- Não é falha da IA — retornou 200 com JSON válido.

### Sugestões (a decidir depois — nada implementado)

1. **Encurtar o wall-clock**: enviar o PDF diretamente pra IA por URL assinada em vez de baixar → base64 → mandar inline. Elimina ~25 s de I/O + encoding.
2. **Adicionar `console.log`** em pontos-chave da edge function (após download, após base64, após IA, antes do retorno) para diagnóstico futuro sem depender de reconstrução por timeline.
3. **Fallback assíncrono**: enfileirar o job em uma tabela `processing_queue` (o edge retorna imediato com `jobId`), um worker/cron processa em background, cliente escuta via realtime. Padrão robusto se PDFs grandes forem comuns.
4. **Log/handler no cliente**: no `catch` do `PremiumKinologyImport`, logar o erro completo (nome, mensagem, contexto) via `console.error` para o próximo diagnóstico ser instantâneo.

Quando você quiser sair do plan mode, sugiro começarmos pela combinação **(1) + (2) + (4)** — resolve a causa raiz e instrumenta pra próxima ocorrência. Se PDFs de 5+ MB forem comuns, aí vale (3).
