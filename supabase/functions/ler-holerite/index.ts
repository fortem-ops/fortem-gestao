import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Lê o TEXTO de um holerite (extraído no navegador — o PDF nunca é armazenado)
// e devolve os itens + mapeamento para os campos da tela "Lançar Folha".

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["funcionario", "cpf", "competencia", "itens", "total_vencimentos", "total_descontos", "valor_liquido"],
  properties: {
    funcionario: { type: ["string", "null"] },
    cpf: { type: ["string", "null"] },
    competencia: { type: ["string", "null"], description: "MM/AAAA" },
    total_vencimentos: { type: ["number", "null"] },
    total_descontos: { type: ["number", "null"] },
    valor_liquido: { type: ["number", "null"] },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["codigo", "descricao", "referencia", "vencimento", "desconto"],
        properties: {
          codigo: { type: ["string", "null"] },
          descricao: { type: "string" },
          referencia: { type: ["string", "null"] },
          vencimento: { type: ["number", "null"] },
          desconto: { type: ["number", "null"] },
        },
      },
    },
  },
};

type Item = { codigo: string | null; descricao: string; referencia: string | null; vencimento: number | null; desconto: number | null };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[.]/g, "").replace(/\s+/g, " ");

function mapear(itens: Item[]) {
  const c: Record<string, number> = {};
  const outrosV: string[] = [], outrosD: string[] = [];
  let outrosVenc = 0, outrosDesc = 0;
  const add = (k: string, v: number) => { c[k] = Math.round(((c[k] ?? 0) + v) * 100) / 100; };
  for (const it of itens) {
    const d = norm(it.descricao);
    const v = Number(it.vencimento) || 0, ds = Number(it.desconto) || 0;
    let campo: string | null = null;
    if (d.includes("ADIANTAMENTO") && d.includes("FERIAS")) campo = "adiantFerias";
    else if (d.includes("1/3")) campo = "tercoFerias";
    else if (d.includes("MEDIA") && d.includes("FERIAS")) campo = "mediaFerias";
    else if (d.includes("HORAS FERIAS") || d === "FERIAS") campo = "horasFerias";
    else if (d.includes("DSR")) campo = "dsr";
    else if (d.includes("COMISS")) campo = "com";
    else if (d.includes("HORAS NORMAIS") || d.includes("SALARIO BASE")) campo = "horas";
    else if (d.includes("GRATIFICACAO")) campo = "grat";
    else if (d.includes("INSS")) campo = "inss";
    else if (d.includes("VALE TRANSPORTE") || d.includes("VALE-TRANSPORTE")) campo = "vt";
    const desc = ["adiantFerias", "inss", "vt"].includes(campo ?? "");
    if (campo) add(campo, desc ? ds || v : v || ds);
    else if (v > 0) { outrosVenc += v; outrosV.push(it.descricao.trim()); }
    else if (ds > 0) { outrosDesc += ds; outrosD.push(it.descricao.trim()); }
  }
  return {
    campos: c,
    outrosVenc: Math.round(outrosVenc * 100) / 100, outrosVencDesc: outrosV.join(", "),
    outrosDesc: Math.round(outrosDesc * 100) / 100, outrosDescDesc: outrosD.join(", "),
    ferias: !!(c.horasFerias || c.mediaFerias || c.tercoFerias || c.adiantFerias),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Leitura por IA não configurada." }, 500);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autenticado" }, 401);
    const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: u } = await uc.auth.getUser();
    if (!u.user) return json({ error: "Sessão inválida" }, 401);
    const { data: ok } = await uc.rpc("is_coordinator_or_admin", { _user_id: u.user.id });
    if (!ok) return json({ error: "Acesso negado" }, 403);

    const body = await req.json().catch(() => ({}));
    const texto = typeof body?.texto === "string" ? body.texto.slice(0, 60000) : "";
    if (texto.replace(/\s/g, "").length < 30) return json({ error: "Texto do holerite vazio." }, 400);

    // Extrato Mensal: vários blocos "Empr.: <n> <NOME>". Cada bloco é lido separadamente.
    const re = /Empr(?:egado)?\s*\.?\s*:\s*\d+/gi;
    const pos: number[] = [];
    for (let m; (m = re.exec(texto)); ) pos.push(m.index);
    if (pos.length >= 2) {
      // Do cabeçalho geral só aproveitamos linhas de competência/período — nunca itens de folha,
      // senão a IA pode ler os valores do 1º funcionário em todos os blocos.
      const cab = texto.slice(0, pos[0]).split("\n")
        .filter((l) => /compet|per[ií]odo|refer[eê]ncia|\b\d{2}\/\d{4}\b/i.test(l) && !/\d+[.,]\d{2}\s*$/.test(l.trim()))
        .slice(0, 4).join("\n");
      const blocos = pos.map((p, i) => {
        const corpo = texto.slice(p, pos[i + 1] ?? texto.length);
        const nome = /Empr(?:egado)?\s*\.?\s*:\s*\d+\s+([^\n\d]+)/i.exec(corpo)?.[1]?.trim() ?? "";
        return `FUNCIONÁRIO DESTE BLOCO: ${nome}\nLeia SOMENTE os itens deste funcionário.\n${cab ? `Cabeçalho do documento (apenas competência):\n${cab}\n` : ""}---\n${corpo}`;
      }).slice(0, 60);
      const registros: unknown[] = new Array(blocos.length);
      let idx = 0;
      const worker = async () => {
        while (idx < blocos.length) {
          const i = idx++;
          try { registros[i] = await lerUm(key, blocos[i]); }
          catch (e) { registros[i] = { erro: (e as Error).message || "Não foi possível ler este funcionário.", status: (e as { status?: number }).status }; }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
      const credito = registros.find((r) => (r as { status?: number })?.status === 402);
      if (credito) return json({ error: "Créditos de IA esgotados." }, 402);
      return json({ modo: "extrato", registros });
    }
    try { return json({ modo: "recibo", ...(await lerUm(key, texto)) }); }
    catch (e) { const st = (e as { status?: number }).status ?? 502; return json({ error: (e as Error).message }, st); }
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível ler o holerite." }, 500);
  }
});

class LeituraErro extends Error { constructor(msg: string, public status: number) { super(msg); } }

async function lerUm(key: string, texto: string) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [
          { role: "system", content: "Você extrai dados de holerites (contracheques) brasileiros. Liste SOMENTE as linhas de proventos/descontos da tabela de itens (não inclua bases de cálculo como Base INSS, Base FGTS, FGTS do mês, Base IRRF, salário contratual). Para cada linha: código, descrição exatamente como no documento, referência, valor na coluna Vencimentos (ou null) e valor na coluna Descontos (ou null). Números em formato decimal (1.234,56 → 1234.56). Também o nome do funcionário, o CPF, a competência MM/AAAA e os totais." },
          { role: "user", content: texto },
        ],
        text: { format: { type: "json_schema", name: "holerite", strict: true, schema } },
      }),
    });
    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => "");
      console.error("gateway", r.status, t.slice(0, 500));
      const msg = r.status === 402 ? "Créditos de IA esgotados." : r.status === 429 ? "Muitas leituras seguidas, tente em instantes." : "Não foi possível ler o holerite.";
      throw new LeituraErro(msg, r.status === 402 || r.status === 429 ? r.status : 502);
    }
    // consome SSE
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "", out = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
          if (ev.type === "response.failed" || ev.type === "error") throw new Error("falha");
        } catch (e) { if ((e as Error).message === "falha") throw e; }
      }
    }
    let dados: { itens: Item[] } & Record<string, unknown>;
    try { dados = JSON.parse(out); } catch { throw new LeituraErro("A IA não conseguiu ler este holerite.", 422); }
    if (!Array.isArray(dados.itens) || !dados.itens.length) throw new LeituraErro("Não encontrei itens de vencimento/desconto neste PDF. Confira se é o recibo ou o extrato mensal da folha.", 422);
  return { ...dados, mapeado: mapear(dados.itens) };
}
