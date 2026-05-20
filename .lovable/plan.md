
# Plano — Camada "Força" via Laudo Kinology

Adicionar uma terceira camada (**Força**) à Avaliação Funcional v2, alimentada pelo upload do PDF da Kinology. A IA lê o laudo e pré-preenche os campos; o avaliador valida/edita antes de salvar.

## 1. Escopo dos testes do laudo Kinology

Do PDF analisado, capturamos da seção **"Assimetria e Indicativos de Risco"** (páginas 2 e 3 — dados primários, em kg, sempre D/E):

**MMSS (2 testes):**
- Rotação interna (ombro) — `shoulder-l` / `shoulder-r`
- Rotação externa (ombro) — `shoulder-re-l` / `shoulder-re-r`

**MMII (8 testes):**
- Dorsiflexão → `ankle-l/r`
- Flexão plantar → `ankle-l/r`
- Flexão de joelho → `ham-l/r`
- Extensão de joelho → `quad-l/r`
- Flexão de quadril → `psoas-l/r`
- Extensão de quadril → `ham-l/r` + `lumbar`
- Abdução de quadril → `hip-re-l/r`
- Adução de quadril → `hip-l/r`

Demais seções do PDF (Desequilíbrio Muscular, Dinâmica, Histórico) ficam **fora desta entrega** — extraímos só o essencial para alimentar o BodyMap.

## 2. Fluxo do usuário

1. Em `FuncionalV2Assessment`, nova seção **"Força (Dinamometria)"** com botão **"Importar Laudo Kinology (PDF)"**.
2. Upload do PDF → armazenado em bucket privado `laudos-dinamometria`.
3. Edge function `parse-kinology-pdf` envia o PDF ao Lovable AI (`google/gemini-2.5-pro`, multimodal) com schema estruturado (`Output.object` via AI SDK).
4. Resposta volta como JSON tipado: `{ data, exercicios: [{ nome, D, E, unidade }] }`.
5. Campos da seção Força são pré-preenchidos com badge "importado do laudo" (azul) — todos editáveis.
6. Avaliador confirma e salva. PDF original fica anexado à avaliação.

## 3. Cálculo da camada Força

Novo `layer: "strength"` em `bodyMapLogic.ts`:

- **Classificação por valor**: como o ACSM/normativas variam muito por equipamento, usamos **classificação relativa por assimetria** (espelha a lógica já validada da Kinology):
  - `|D−E| / max(D,E) × 100`
  - `< 10%` = Baixo risco (Bom); `10–20%` = Médio (Atenção); `> 20%` = Alto (Déficit).
- `scoreForca` por região = média ponderada dos exercícios que afetam aquela região (mesmo padrão de `METRIC_META`).
- **Penalidade adicional**: se houver ≥ 1 teste com assimetria ≥ 20%, subtrai 10 pts do score final de Força (mínimo 0).
- Halo no BodyMap (verde/amarelo/vermelho) reaproveita `SEVERITY_COLOR_VAR`.

## 4. `scoreGeral` redistribuído

Quando a camada Força tem dados:
- Mobilidade **30** / Simetria **25** / Estabilidade **25** / **Força 20**

Quando NÃO tem dados de Força, mantém o atual (40/30/30) via renormalização — sem regredir avaliações antigas.

## 5. Mudanças no banco

```text
storage.buckets: 'laudos-dinamometria' (privado, RLS por aluno_id)
avaliacoes.dados (jsonb):
  + forca: { 
      laudoPath, laudoData, importadoEm,
      exercicios: [{ chave, D, E, unidade, assimetria, classificacao }],
      scoreForca
    }
```

Nenhuma nova tabela; tudo persiste em `avaliacoes.dados`.

## 6. Arquivos a alterar/criar

- **Novo** `supabase/functions/parse-kinology-pdf/index.ts` — edge function com AI SDK + Lovable AI Gateway.
- **Novo** migration: bucket `laudos-dinamometria` + policies (avaliador insere; aluno e equipe lêem).
- `bodyMapLogic.ts` — `Layer` ganha `"strength"`, `STRENGTH_EXERCISES` const com mapeamento exercício→regiões, `analyze()` agrega scores de Força, novo `scoreForca`, redistribuição de pesos no `scoreGeral`.
- `FuncionalV2Assessment.tsx` — nova seção "Força (Dinamometria)" com botão de upload, tabela editável (Exercício | D kg | E kg | Assimetria % | Classificação).
- `BodyMap.tsx` / `BodyMapSVG.tsx` — opção de toggle para camada `strength`.
- `AssessmentViewerDialog.tsx` — exibe bloco Força + link para o PDF original.

## 7. Detalhes técnicos da extração (IA)

Schema enviado ao Gemini:
```ts
z.object({
  paciente: z.string().optional(),
  dataEmissao: z.string().optional(),
  exercicios: z.array(z.object({
    nome: z.enum([
      "rotacao_interna", "rotacao_externa",
      "dorsiflexao", "flexao_plantar",
      "flexao_joelho", "extensao_joelho",
      "flexao_quadril", "extensao_quadril",
      "abducao_quadril", "aducao_quadril"
    ]),
    data: z.string(),
    direito_kg: z.number(),
    esquerdo_kg: z.number(),
  }))
})
```

System prompt foca em "extrair apenas as tabelas das páginas de Assimetria e Indicativos de Risco; ignorar gráficos de Desequilíbrio e Dinâmica nesta versão". Robusto a variações de quantidade de testes (o avaliador pode ter feito só MMII, por exemplo).

## 8. Fora do escopo desta entrega

- Parsing das seções "Desequilíbrio Muscular" e "Dinâmica/RFD" (fica para v2 da Força).
- Histórico evolutivo do laudo (a Kinology já faz; podemos espelhar depois).
- Suporte a outras marcas de dinamômetro (usuário confirmou: sempre Kinology).
- Mudança na v1 da avaliação funcional.
