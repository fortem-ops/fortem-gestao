import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Lê o TEXTO de uma fatura de cartão (extraído no navegador — o PDF nunca é armazenado)
// e devolve cabeçalho + linhas da seção "Despesas da fatura".

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["emissor", "cartao_final", "vencimento", "valor_total", "mes_referencia", "linhas"],
  properties: {
    emissor: { type: ["string", "null"], description: "Banco/emissor do cartão" },
    cartao_final: { type: ["string", "null"], description: "Últimos dígitos do cartão" },
    vencimento: { type: ["string", "null"], description: "AAAA-MM-DD" },
    valor_total: { type: ["number", "null"] },
    mes_referencia: { type: ["string", "null"], description: "MM/AAAA do mês de vencimento da fatura" },
    linhas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["data", "beneficiario", "valor", "sinal", "parcela_atual", "parcela_total"],
        properties: {
          data: { type: ["string", "null"], description: "AAAA-MM-DD" },
          beneficiario: { type: "string" },
          valor: { type: "number", description: "Valor absoluto, sempre positivo" },
          sinal: { type: "string", enum: ["+", "-"] },
          parcela_atual: { type: ["integer", "null"] },
          parcela_total: { type: ["integer", "null"] },
        },
      },
    },
  },
};

const PROMPT = `Você extrai dados de faturas de cartão de crédito brasileiras (qualquer banco).
Cabeçalho: emissor (nome do banco), últimos dígitos do cartão, data de vencimento (AAAA-MM-DD), valor total da fatura e mês de referência (MM/AAAA do vencimento).
Linhas: liste TODAS as transações da fatura atual (seção "Despesas da fatura", "Lançamentos", "Compras" etc.), de todos os cartões/adicionais.
IGNORE completamente a seção "Próxima fatura"/"Lançamentos futuros"/"Compras parceladas a vencer" — são só prévia de meses seguintes.
Não inclua totais, subtotais, limites, encargos projetados nem resumo.
Para cada linha: data da compra (AAAA-MM-DD; se só houver dia/mês, deduza o ano pela fatura), beneficiário (estabelecimento, como está no documento, sem o texto da parcela), valor absoluto (1.234,56 → 1234.56),
sinal "+" quando for crédito/entrada (pagamento da fatura anterior, estorno, devolução, crédito) e "-" quando for despesa/compra/tarifa/IOF (o padrão).
Parcela: "Parcela 04 de 09" ou "04/09" → parcela_atual 4, parcela_total 9; senão null.`;

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
    const texto = typeof body?.texto === "string" ? body.texto.slice(0, 80000) : "";
    if (texto.replace(/\s/g, "").length < 30) return json({ error: "Texto da fatura vazio." }, 400);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [{ role: "system", content: PROMPT }, { role: "user", content: texto }],
        text: { format: { type: "json_schema", name: "fatura", strict: true, schema } },
      }),
    });
    if (!r.ok || !r.body) {
      const t = await r.text().catch(() => "");
      console.error("gateway", r.status, t.slice(0, 500));
      if (r.status === 402) return json({ error: "Créditos de IA esgotados." }, 402);
      if (r.status === 429) return json({ error: "Muitas leituras seguidas, tente em instantes." }, 429);
      return json({ error: "Não foi possível ler a fatura." }, 502);
    }
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "", out = "", falhou = false;
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
          if (ev.type === "response.failed" || ev.type === "error") falhou = true;
        } catch { /* ignora */ }
      }
    }
    if (falhou) return json({ error: "Não foi possível ler a fatura." }, 502);
    let dados: { linhas?: unknown[] };
    try { dados = JSON.parse(out); } catch { return json({ error: "A IA não conseguiu ler esta fatura." }, 422); }
    if (!Array.isArray(dados.linhas) || !dados.linhas.length) return json({ error: "Não encontrei lançamentos nesta fatura." }, 422);
    return json(dados);
  } catch (e) {
    console.error(e);
    return json({ error: "Não foi possível ler a fatura." }, 500);
  }
});
