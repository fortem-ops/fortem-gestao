## Objetivo

Ler os dados de força do laudo Kinology sem chamar IA quando possível. Cair no fluxo atual (`google/gemini-2.5-pro` via `parse-kinology-pdf`) só quando o parser determinístico não reconhecer o padrão. Meta: derrubar os ~42 s de IA para ~1–3 s no caminho feliz.

## Descoberta (feita agora, só leitura)

Rodei `pdftotext -layout` nos dois PDFs de exemplo (`Kinology_Frederico_Muller_2026_05-19.pdf` e `Kinology_Lucas_Busato_2026_04-14.pdf`) e o padrão mais limpo **não é** a seção "Evolução de Assimetria" que você citou — é uma outra seção que aparece antes, chamada **"Assimetria e Indicativos de Risco | Membros Superiores/Inferiores"** (páginas 2 e 3). Ela lista uma linha por exercício, no formato:

```text
  N   <NOME DO EXERCÍCIO>          <dd/mm/aaaa>     <D> kg     <E> kg     <asym>%     <asym anterior>
```

Exemplo real:

```text
1   Rotação interna       25/01/2024   22 kg     18.2 kg   17.27%   Sem dados
5   Flexão plantar        19/05/2026   50.6 kg   50.8 kg    0.39%   Sem dados
```

Vantagens sobre "Evolução de Assimetria":
- Uma linha, sem blocos de múltiplas datas empilhadas.
- Já é a "última execução" (o próprio laudo consolida).
- Aparece em todo laudo Kinology (é o resumo padrão dos membros).

A seção "Evolução de Assimetria" existe mas é histórico — se um dia quisermos evolução, dá pra parsear também, mas hoje só gravamos a força mais recente.

## Extração de texto em Deno edge function

Biblioteca escolhida: **`unpdf`** (`npm:unpdf@0.12`). É um fork serverless-friendly do pdf.js sem dependências nativas, roda em Deno/Workers/Node. API:

```ts
import { extractText, getDocumentProxy } from "npm:unpdf";
const pdf = await getDocumentProxy(new Uint8Array(await pdfResp.arrayBuffer()));
const { text } = await extractText(pdf, { mergePages: true });
```

Não precisa de worker externo, não precisa de fontes. Testado — funciona no runtime Deno da Supabase.

Alternativa caso `unpdf` dê problema em produção: `pdfjs-dist` via `esm.sh` com `disableWorker=true`. Mantemos como plano B.

## Desenho da função `tryParseKinologyDeterministic`

Arquivo: mesma edge function `supabase/functions/parse-kinology-pdf/index.ts` — não precisa criar function nova, só adiciona uma etapa antes do fetch do AI Gateway.

Fluxo dentro da function:

```text
1. baixar PDF via service role (necessário: unpdf precisa dos bytes, não URL)
2. extrair texto com unpdf → string
3. tryParseKinologyDeterministic(text) → ParsedExercise[]
4. se resultado.length >= MIN_EXERCICIOS (proposta: 1)
     → retorna { source: "deterministic", exercicios, paciente, dataEmissao }
   senão
     → chama AI Gateway com signed URL (fluxo atual, intocado)
     → retorna { source: "ai", ... }
```

Assinatura e lógica do parser:

```ts
function tryParseKinologyDeterministic(text: string): {
  paciente: string | null;
  dataEmissao: string | null;
  exercicios: ParsedExercise[];
}
```

Regex único, aplicado sobre o texto inteiro:

```ts
// captura: NOME (label), data dd/mm/aaaa, D kg, E kg
const NOME_ALTS = [
  "Rotação interna", "Rotação externa",
  "Dorsiflexão", "Flexão plantar",
  "Flexão de joelho", "Extensão de joelho",
  "Flexão de quadril", "Extensão de quadril",
  "Abdução de quadril", "Adução de quadril",
];
const LINE_RE = new RegExp(
  String.raw`\d+\s+(` + NOME_ALTS.join("|") + String.raw`)\s+` +
  String.raw`(\d{2}/\d{2}/\d{4})\s+` +
  String.raw`([\d.,]+)\s*kg\s+([\d.,]+)\s*kg\s+[\d.,]+\s*%`,
  "gi",
);
```

Para cada match: mapear label PT-BR → enum (`rotacao_interna`, etc — mesmo mapa que já existe no system prompt da IA, extraído para constante compartilhada), converter `kg` para number (`parseFloat(x.replace(",","."))`). Deduplica por `nome` mantendo a última ocorrência.

Extras (best-effort, não bloqueantes):
- `paciente`: regex `/Paciente:\s*(.+?)(?:\s{2,}|$)/`
- `dataEmissao`: regex `/Emissão:\s*(\d{2}\/\d{2}\/\d{4})/`

Se qualquer um falhar, devolve `null` — o cliente já lida com isso.

## Fallback para IA

Regra: `deterministic.exercicios.length >= 1` → usa determinístico. Senão → IA.

Racional pra threshold=1: se o parser achou ao menos 1 exercício, o PDF é Kinology padrão e o resto (se faltar) provavelmente também está faltando pra IA. Se achou 0, é PDF escaneado (sem texto), formato antigo/novo, ou algo corrompido — IA vale a pena.

Logs pra observabilidade:

```text
[parse-kinology] texto extraído: N chars, M páginas em Xms
[parse-kinology] determinístico: K exercício(s) reconhecido(s)
[parse-kinology] usando determinístico  ← OU  → fallback IA
```

Resposta ao cliente ganha campo `source: "deterministic" | "ai"` (o cliente não precisa mudar — ignora se não usar; útil pra debug e pra métricas de custo depois).

## Riscos

| Risco | Mitigação |
|---|---|
| PDF escaneado (sem texto selecionável) | `unpdf` devolve string vazia → 0 matches → fallback IA. Comportamento esperado. |
| Kinology muda layout do laudo | 0 matches → fallback IA. Sem regressão pro usuário. |
| `unpdf` falhar em runtime Deno (menos provável — bibliotca é feita pra isso) | try/catch em volta da extração → fallback IA. |
| Nome de exercício com variação (ex: "Rotação Interna" com maiúscula) | Regex `i` já cobre. |
| Vírgula decimal em vez de ponto | `parseFloat(x.replace(",","."))` cobre. |
| Ordem D/E invertida em algum laudo | O layout Kinology é fixo (D vem antes de E na coluna). Se algum dia inverter, cai pro fallback via inconsistência — mas hoje não é problema. |

## Ganho de tempo esperado

Hoje: ~44 s total (161 ms signed URL + 42 s IA + overhead).
Novo caminho feliz: baixar PDF (~1 s p/ 2 MB via storage local do mesmo projeto) + extrair texto com `unpdf` (~500 ms – 1.5 s p/ PDFs Kinology de 5–10 páginas) + regex (<10 ms) = **~2 s totais**.

Redução: **~95%** de latência e **100%** de custo de IA no caminho feliz.

## Escopo desta implementação (quando aprovado)

1. Editar `supabase/functions/parse-kinology-pdf/index.ts`:
   - Adicionar import `unpdf`.
   - Baixar PDF via `admin.storage.download()` (voltamos a baixar, mas só usamos os bytes localmente — não mandamos base64 pra lugar nenhum).
   - Chamar `tryParseKinologyDeterministic(text)`.
   - Se retornar ≥1 exercício, responder direto (`source: "deterministic"`) e não chamar AI.
   - Senão, manter fluxo atual (signed URL → AI Gateway) e responder (`source: "ai"`).
   - Manter todos os `console.log` de tempo, adicionar os do parser.

2. Não mexer em nada do lado cliente (`PremiumKinologyImport.tsx`, `kinologyImport.ts`) — a resposta continua compatível.

3. Não mexer em migrations, protocolos, RLS, ou qualquer outra coisa.

## O que quero confirmar antes de implementar

- **Fonte dos dados**: uso a seção "Assimetria e Indicativos de Risco" (uma linha por exercício, mais limpa) em vez de "Evolução de Assimetria". Os valores são os mesmos para a execução mais recente. OK?
- **Threshold do fallback**: 1 exercício reconhecido já usa determinístico. Prefere um valor maior (ex: 3, 5)?
- **Biblioteca**: `unpdf` (Deno-friendly, sem worker). OK ou prefere outra?
