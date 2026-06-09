import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EXERCICIO_ENUM = [
  "rotacao_interna",
  "rotacao_externa",
  "dorsiflexao",
  "flexao_plantar",
  "flexao_joelho",
  "extensao_joelho",
  "flexao_quadril",
  "extensao_quadril",
  "abducao_quadril",
  "aducao_quadril",
] as const;

interface ParsedExercise {
  nome: typeof EXERCICIO_ENUM[number];
  data?: string;
  direito_kg: number;
  esquerdo_kg: number;
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

    const { data: file, error: dlErr } = await admin.storage
      .from("aluno-files")
      .download(storage_path);
    if (dlErr || !file) throw new Error(`Falha ao baixar laudo: ${dlErr?.message}`);

    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))),
      );
    }
    const base64 = btoa(binary);

    const systemPrompt = `Você extrai dados de laudos de dinamometria isométrica do equipamento Kinology.
Analise APENAS as tabelas das páginas tituladas "Assimetria e Indicativos de Risco | Membros Superiores" e "Assimetria e Indicativos de Risco | Membros Inferiores".
Ignore seções de Desequilíbrio Muscular, Histórico, Dinâmica e Desempenho.
Para cada linha da tabela, extraia o nome do exercício (mapeie para o enum), a data e os valores em kg do lado Direito (D) e Esquerdo (E).
Mapeamento de nomes:
- "Rotação interna" → rotacao_interna
- "Rotação externa" → rotacao_externa
- "Dorsiflexão" → dorsiflexao
- "Flexão plantar" → flexao_plantar
- "Flexão de joelho" → flexao_joelho
- "Extensão de joelho" → extensao_joelho
- "Flexão de quadril" → flexao_quadril
- "Extensão de quadril" → extensao_quadril
- "Abdução de quadril" → abducao_quadril
- "Adução de quadril" → aducao_quadril
Retorne SOMENTE JSON válido, sem comentários ou markdown.`;

    const userPrompt = `Extraia os dados das tabelas de Assimetria.
Formato de resposta:
{
  "paciente": "<nome>",
  "dataEmissao": "<dd/mm/aaaa ou vazio>",
  "exercicios": [
    { "nome": "<enum>", "data": "<dd/mm/aaaa>", "direito_kg": <number>, "esquerdo_kg": <number> }
  ]
}`;

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
                  file_data: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

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

    return new Response(
      JSON.stringify({
        paciente: parsed.paciente ?? null,
        dataEmissao: parsed.dataEmissao ?? null,
        exercicios,
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
