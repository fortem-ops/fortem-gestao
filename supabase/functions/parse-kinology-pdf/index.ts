import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";
import {
  EXERCICIO_ENUM,
  tryParseKinologyDeterministic,
  type HistoricoEntrada,
  type ParsedExercise,
} from "../_shared/kinology-parser.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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
    let historicoIncerto = false;

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
      historicoIncerto = det.historicoIncerto;
      console.log(
        `[parse-kinology] determinístico: ${deterministicExercicios.length} exercício(s) reconhecido(s), ` +
          `${deterministicHistorico.length} data(s) no histórico` +
          (historicoIncerto ? " (histórico incerto — vai pra IA)" : "") +
          deterministicHistorico
            .map((h) => ` | ${h.data}: ${h.exercicios.length}`)
            .join(""),
      );
    } catch (extractErr) {
      console.log(
        `[parse-kinology] extração determinística falhou: ${extractErr instanceof Error ? extractErr.message : String(extractErr)} — caindo pra IA`,
      );
    }

    if (deterministicExercicios.length >= 1 && !historicoIncerto) {
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
    console.log(
      historicoIncerto
        ? `[parse-kinology] fallback IA — histórico não validado no parser determinístico`
        : `[parse-kinology] fallback IA — 0 exercícios via parser determinístico`,
    );

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
    let parsed: {
      paciente?: string;
      dataEmissao?: string;
      exercicios?: ParsedExercise[];
      historico?: HistoricoEntrada[];
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const isValidEx = (e: ParsedExercise) =>
      !!e &&
      EXERCICIO_ENUM.includes(e.nome) &&
      typeof e.direito_kg === "number" &&
      typeof e.esquerdo_kg === "number";

    const aiExercicios = (parsed.exercicios ?? []).filter(isValidEx);
    // Quando o determinístico já leu a medição atual (e só o histórico ficou
    // incerto), a medição determinística tem prioridade — ela é exata.
    const exercicios =
      deterministicExercicios.length >= 1 ? deterministicExercicios : aiExercicios;

    const historico = (parsed.historico ?? [])
      .filter((h) => h && typeof h.data === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(h.data))
      .map((h) => ({
        data: h.data,
        exercicios: (h.exercicios ?? [])
          .filter(isValidEx)
          .map((e) => ({ ...e, data: h.data })),
      }))
      .filter((h) => h.exercicios.length > 0);

    console.log(
      `[parse-kinology] retornando ${exercicios.length} exercício(s) e ${historico.length} data(s) de histórico ao cliente (source=ai)`,
    );
    return new Response(
      JSON.stringify({
        paciente: deterministicPaciente ?? parsed.paciente ?? null,
        dataEmissao: deterministicDataEmissao ?? parsed.dataEmissao ?? null,
        exercicios,
        historico,
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
