## Diagnóstico — 400 na importação Kinology (somente leitura)

### Onde o 400 aconteceu

**Não** foi na edge function. **Não** foi na chamada à IA. Foi no `INSERT` que o cliente faz no PostgREST logo depois.

Logs de `parse-kinology-pdf` na tentativa de 17:36 UTC:

```text
17:36:15  boot
17:36:16  [parse-kinology] signed URL pronta em 161ms      ← createSignedUrl OK (25s → 161ms 🎉)
17:36:16  [parse-kinology] chamando IA via URL assinada
17:36:59  [parse-kinology] IA respondeu em 42337ms, status 200
17:36:59  [parse-kinology] retornando 6 exercício(s) ao cliente
```

Edge function retornou **200 OK com 6 exercícios**. Wall-clock caiu de ~47 s para ~44 s (a IA em si é lenta — 42 s — mas isso é do modelo, não do nosso código).

Confirmado no banco: nenhuma linha nova em `avaliacoes` para o aluno após 17:30 — ou seja, o INSERT do cliente falhou.

### Causa raiz

A tabela `public.avaliacoes` tem um CHECK constraint:

```sql
avaliacoes_tipo_check:
  CHECK (tipo = ANY (ARRAY['funcional','composicao_corporal','pliometria','forca','experimental','kinology']))
```

`'funcional_v2'` **não está na lista**. Quando `PremiumKinologyImport` chama `supabase.from("avaliacoes").insert({ tipo: "funcional_v2", ... })`, o Postgres rejeita com `check_violation`, e o PostgREST devolve **HTTP 400** — exatamente o "Failed to load resource: 400" que apareceu no console.

Isso explica por que:
- Toda a infra nova (`avaliacao_tipos.engine='funcional_v2'`, protocolo default, trigger de comissão v2, `useAlunoAvaliacoesConsolidadas` incluindo `funcional_v2`, `PremiumBodyMap` mostrando chip) foi criada com sucesso, mas
- **Nenhuma linha `funcional_v2` jamais foi inserida** (nem manualmente pela UI de funcional_v2, nem por esse import) — o CHECK está bloqueando desde antes desta sessão.

### Correção necessária (proposta — não aplicada)

Uma migration mínima que adiciona `'funcional_v2'` ao CHECK:

```sql
ALTER TABLE public.avaliacoes DROP CONSTRAINT avaliacoes_tipo_check;
ALTER TABLE public.avaliacoes ADD CONSTRAINT avaliacoes_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'funcional','composicao_corporal','pliometria','forca',
    'experimental','kinology','funcional_v2'
  ]));
```

Risco: nenhum — só amplia o conjunto aceito, não altera linhas existentes.

### O que NÃO precisa mudar

- Edge function `parse-kinology-pdf` — funcionando 100%.
- Cliente `PremiumKinologyImport` — a lógica de merge/insert está correta.
- Signed URL — funcionou (161 ms).
- Sanitização de nome de arquivo — funcionou.
- IA — retornou JSON válido com 6 exercícios.

### Observações laterais (não bloqueantes)

- 42 s de latência do gemini-2.5-pro é alto mas dentro do orçamento agora que o boot+I/O caiu drasticamente. Se quiser respostas mais rápidas depois, dá pra testar `google/gemini-2.5-flash` (menos raciocínio, provavelmente 5–10 s pra essa tarefa que é bem estruturada).
- Vale considerar aplicar a mesma correção do CHECK como parte do mesmo item se quisermos evitar viagens futuras.

### Próximo passo sugerido

Sair do plan mode e aplicar a migration acima. Uma linha só, uma migration só.
