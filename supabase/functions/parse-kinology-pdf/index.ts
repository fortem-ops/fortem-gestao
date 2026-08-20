import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EXERCICIO_ENUM = [
  "rotacao_interna",
  "rotacao_externa",
  "flexao_ombro",
  "extensao_ombro",
  "abducao_ombro",
  "aducao_ombro",
  "flexao_cotovelo",
  "extensao_cotovelo",
  "pronacao_antebraco",
  "supinacao_antebraco",
  "flexao_punho",
  "extensao_punho",
  "dorsiflexao",
  "flexao_plantar",
  "inversao",
  "flexao_joelho",
  "extensao_joelho",
  "flexao_quadril",
  "extensao_quadril",
  "abducao_quadril",
  "aducao_quadril",
] as const;

type ExercicioEnum = typeof EXERCICIO_ENUM[number];

interface ParsedExercise {
  nome: ExercicioEnum;
  data?: string;
  direito_kg: number;
  esquerdo_kg: number;
}

// Mapa label PT-BR (como aparece no PDF Kinology) → enum interno.
const NOME_LABEL_TO_ENUM: Record<string, ExercicioEnum> = {
  "rotação interna": "rotacao_interna",
  "rotação externa": "rotacao_externa",
  "flexão de ombro": "flexao_ombro",
  "extensão de ombro": "extensao_ombro",
  "abdução de ombro": "abducao_ombro",
  "adução de ombro": "aducao_ombro",
  "flexão de cotovelo": "flexao_cotovelo",
  "extensão de cotovelo": "extensao_cotovelo",
  "pronação do antebraço": "pronacao_antebraco",
  "supinação do antebraço": "supinacao_antebraco",
  "flexão de punho": "flexao_punho",
  "extensão de punho": "extensao_punho",
  "dorsiflexão": "dorsiflexao",
  "flexão plantar": "flexao_plantar",
  "inversão": "inversao",
  "flexão de joelho": "flexao_joelho",
  "extensão de joelho": "extensao_joelho",
  "flexão de quadril": "flexao_quadril",
  "extensão de quadril": "extensao_quadril",
  "abdução de quadril": "abducao_quadril",
  "adução de quadril": "aducao_quadril",
};

const NOME_LABELS = Object.keys(NOME_LABEL_TO_ENUM);

// Regex que casa uma linha da tabela "Assimetria e Indicativos de Risco":
//   <NOME> <dd/mm/aaaa> <D> kg <E> kg <asym>%
// Testado nos laudos Kinology reais dos exemplos do projeto (Frederico Muller e Lucas Busato).
const LINE_RE = new RegExp(
  String.raw`(` +
    NOME_LABELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
    String.raw`)\s+` +
    String.raw`(\d{2}\/\d{2}\/\d{4})\s+` +
    String.raw`([\d.,]+)\s*kg\s+([\d.,]+)\s*kg\s+[\d.,]+\s*%`,
  "gi",
);

function toNumber(s: string): number {
  return parseFloat(s.replace(",", "."));
}

interface HistoricoEntrada {
  data: string; // dd/mm/aaaa
  exercicios: ParsedExercise[];
}

const LABEL_ALT = NOME_LABELS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

// Seção "Evolução de Assimetria": para cada exercício, uma tabela com linhas
//   <dd/mm/aa|dd/mm/aaaa> <D> kg <E> kg <asym>%
// Varremos sequencialmente: cada rótulo de exercício encontrado passa a ser o
// "exercício corrente" e as linhas seguintes pertencem a ele.
const EVOL_TOKEN_RE = new RegExp(
  String.raw`(${LABEL_ALT})|(\d{2}\/\d{2}\/(?:\d{4}|\d{2}))\s+([\d.,]+)\s*kg\s+([\d.,]+)\s*kg\s+[\d.,]+\s*%`,
  "gi",
);

function normalizeDate(d: string): string {
  const [dd, mm, yy] = d.split("/");
  return `${dd}/${mm}/${yy.length === 2 ? `20${yy}` : yy}`;
}

function parseEvolucao(text: string): HistoricoEntrada[] {
  const idx = text.search(/Evolu[çc][ãa]o de Assimetria/i);
  if (idx < 0) return [];
  const trecho = text.slice(idx);

  // data → exercício → valores (última execução da mesma data vence)
  const byDate = new Map<string, Map<ExercicioEnum, ParsedExercise>>();
  let atual: ExercicioEnum | null = null;

  for (const m of trecho.matchAll(EVOL_TOKEN_RE)) {
    if (m[1]) {
      atual = NOME_LABEL_TO_ENUM[m[1].toLowerCase()] ?? null;
      continue;
    }
    if (!atual) continue;
    const data = normalizeDate(m[2]);
    const d = toNumber(m[3]);
    const e = toNumber(m[4]);
    if (!isFinite(d) || !isFinite(e)) continue;
    if (!byDate.has(data)) byDate.set(data, new Map());
    byDate.get(data)!.set(atual, { nome: atual, data, direito_kg: d, esquerdo_kg: e });
  }

  const toSortKey = (s: string) => {
    const [dd, mm, yyyy] = s.split("/");
    return `${yyyy}-${mm}-${dd}`;
  };

  return [...byDate.entries()]
    .map(([data, exs]) => ({ data, exercicios: [...exs.values()] }))
    .filter((h) => h.exercicios.length > 0)
    .sort((a, b) => (toSortKey(a.data) < toSortKey(b.data) ? 1 : -1));
}

/**
 * Parser determinístico do laudo Kinology. Não usa IA.
 * Retorna o mesmo shape que o fluxo de IA — { paciente, dataEmissao, exercicios[] }.
 * Se não reconhecer o padrão, devolve `exercicios: []` e o caller decide o fallback.
 */
function tryParseKinologyDeterministic(text: string): {
  paciente: string | null;
  dataEmissao: string | null;
  exercicios: ParsedExercise[];
  historico: HistoricoEntrada[];
} {
  const seen = new Map<ExercicioEnum, ParsedExercise>();
  // A seção de evolução também casa com LINE_RE? Não: LINE_RE exige o rótulo do
  // exercício na mesma linha da data, o que só ocorre nas tabelas de assimetria.
  for (const m of text.matchAll(LINE_RE)) {
    const label = m[1].toLowerCase();
    const enumName = NOME_LABEL_TO_ENUM[label];
    if (!enumName) continue;
    const d = toNumber(m[3]);
    const e = toNumber(m[4]);
    if (!isFinite(d) || !isFinite(e)) continue;
    // Última ocorrência vence (o laudo lista membros superiores e inferiores em sequência,
    // e cada exercício aparece uma única vez na seção-fonte).
    seen.set(enumName, {
      nome: enumName,
      data: m[2],
      direito_kg: d,
      esquerdo_kg: e,
    });
  }

  const pacienteMatch = text.match(/Paciente:\s*([^\n\r]+?)\s{2,}/);
  const emissaoMatch = text.match(/Emiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/);

  return {
    paciente: pacienteMatch ? pacienteMatch[1].trim() : null,
    dataEmissao: emissaoMatch ? emissaoMatch[1] : null,
    exercicios: [...seen.values()],
    historico: parseEvolucao(text),
  };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const { storage_path } = await req.json();
    if (!storage_path || typeof storage_path !== "string") {
      throw new Error("storage_path obrigatório");
    }

    // Validate user via JWT
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) throw new Error("Sessão inválida");

    // Download PDF with service role
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Authorize: only staff (admin/coord/professor/nutri/fisio) may invoke this parser,
    // otherwise any authenticated student could read other students' files via service role.
    const { data: isStaff, error: staffErr } = await admin.rpc("is_staff", { _user_id: userRes.user.id });
    if (staffErr || !isStaff) throw new Error("Acesso negado");

    // ETAPA 1 — extração determinística (rápida, sem IA).
    // Baixa o PDF, extrai texto com unpdf e roda regex sobre a seção
    // "Assimetria e Indicativos de Risco". Se casar ≥1 exercício, retorna direto.
    let deterministicExercicios: ParsedExercise[] = [];
    let deterministicPaciente: string | null = null;
    let deterministicDataEmissao: string | null = null;
    let deterministicHistorico: HistoricoEntrada[] = [];

    try {
      const tDl = Date.now();
      const { data: pdfBlob, error: dlErr } = await admin.storage
        .from("aluno-files")
        .download(storage_path);
      if (dlErr || !pdfBlob) throw new Error(dlErr?.message ?? "download vazio");
      const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
      console.log(
        `[parse-kinology] PDF baixado em ${Date.now() - tDl}ms (${bytes.byteLength} bytes)`,
      );

      const tExtract = Date.now();
      const pdf = await getDocumentProxy(bytes);
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      const textStr = typeof text === "string" ? text : text.join("\n");
      console.log(
        `[parse-kinology] texto extraído: ${textStr.length} chars, ${totalPages} páginas em ${Date.now() - tExtract}ms`,
      );

      const det = tryParseKinologyDeterministic(textStr);
      deterministicExercicios = det.exercicios;
      deterministicPaciente = det.paciente;
      deterministicDataEmissao = det.dataEmissao;
      deterministicHistorico = det.historico;
      console.log(
        `[parse-kinology] determinístico: ${deterministicExercicios.length} exercício(s) reconhecido(s), ` +
          `${deterministicHistorico.length} data(s) no histórico`,
      );
    } catch (extractErr) {
      console.log(
        `[parse-kinology] extração determinística falhou: ${extractErr instanceof Error ? extractErr.message : String(extractErr)} — caindo pra IA`,
      );
    }

    if (deterministicExercicios.length >= 1) {
      console.log(`[parse-kinology] usando determinístico — retornando ${deterministicExercicios.length} exercício(s)`);
      return new Response(
        JSON.stringify({
          paciente: deterministicPaciente,
          dataEmissao: deterministicDataEmissao,
          exercicios: deterministicExercicios,
          historico: deterministicHistorico,
          source: "deterministic",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // ETAPA 2 — fallback IA (fluxo original intocado): gera URL assinada curta
    // e deixa o AI Gateway buscar o arquivo diretamente.
    console.log(`[parse-kinology] fallback IA — 0 exercícios via parser determinístico`);
    const tSign = Date.now();
    const { data: signed, error: signErr } = await admin.storage
      .from("aluno-files")
      .createSignedUrl(storage_path, 300);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Falha ao gerar URL do laudo: ${signErr?.message ?? "sem url"}`);
    }
    const pdfUrl = signed.signedUrl;
    console.log(`[parse-kinology] signed URL pronta em ${Date.now() - tSign}ms`);


    const systemPrompt = `Você extrai dados de laudos de dinamometria isométrica do equipamento Kinology.
Analise as tabelas das páginas tituladas "Assimetria e Indicativos de Risco | Membros Superiores" e "Assimetria e Indicativos de Risco | Membros Inferiores" e, quando existir, também a página "Evolução de Assimetria".
Ignore seções de Desequilíbrio Muscular, Dinâmica e Desempenho.
Para cada linha da tabela, extraia o nome do exercício (mapeie para o enum), a data e os valores em kg do lado Direito (D) e Esquerdo (E).
Na página "Evolução de Assimetria" cada exercício tem uma tabela com várias datas (ano pode vir com 2 dígitos — normalize para 4, ex. 20/03/25 → 20/03/2025). Agrupe esses dados por DATA no campo "historico".
Mapeamento de nomes:
- "Rotação interna" → rotacao_interna
- "Rotação externa" → rotacao_externa
- "Flexão de ombro" → flexao_ombro
- "Extensão de ombro" → extensao_ombro
- "Abdução de ombro" → abducao_ombro
- "Adução de ombro" → aducao_ombro
- "Flexão de cotovelo" → flexao_cotovelo
- "Extensão de cotovelo" → extensao_cotovelo
- "Pronação do antebraço" → pronacao_antebraco
- "Supinação do antebraço" → supinacao_antebraco
- "Flexão de punho" → flexao_punho
- "Extensão de punho" → extensao_punho
- "Dorsiflexão" → dorsiflexao
- "Flexão plantar" → flexao_plantar
- "Inversão" → inversao
- "Flexão de joelho" → flexao_joelho
- "Extensão de joelho" → extensao_joelho
- "Flexão de quadril" → flexao_quadril
- "Extensão de quadril" → extensao_quadril
- "Abdução de quadril" → abducao_quadril
- "Adução de quadril" → aducao_quadril
Retorne SOMENTE JSON válido, sem comentários ou markdown.`;

    const userPrompt = `Extraia os dados das tabelas de Assimetria e, se houver, da Evolução de Assimetria.
Formato de resposta:
{
  "paciente": "<nome>",
  "dataEmissao": "<dd/mm/aaaa ou vazio>",
  "exercicios": [
    { "nome": "<enum>", "data": "<dd/mm/aaaa>", "direito_kg": <number>, "esquerdo_kg": <number> }
  ],
  "historico": [
    { "data": "<dd/mm/aaaa>", "exercicios": [ { "nome": "<enum>", "direito_kg": <number>, "esquerdo_kg": <number> } ] }
  ]
}`;


    console.log(`[parse-kinology] chamando IA (google/gemini-2.5-pro) via URL assinada`);
    const tAi = Date.now();
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "file",
                file: {
                  filename: "laudo.pdf",
                  file_data: pdfUrl,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    console.log(`[parse-kinology] IA respondeu em ${Date.now() - tAi}ms, status ${aiRes.status}`);

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
      if (aiRes.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
      throw new Error(`Falha na IA [${aiRes.status}]: ${txt.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { paciente?: string; dataEmissao?: string; exercicios?: ParsedExercise[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const exercicios = (parsed.exercicios ?? []).filter(
      (e) =>
        e &&
        EXERCICIO_ENUM.includes(e.nome) &&
        typeof e.direito_kg === "number" &&
        typeof e.esquerdo_kg === "number",
    );

    console.log(`[parse-kinology] retornando ${exercicios.length} exercício(s) ao cliente (source=ai)`);
    return new Response(
      JSON.stringify({
        paciente: parsed.paciente ?? null,
        dataEmissao: parsed.dataEmissao ?? null,
        exercicios,
        source: "ai",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
