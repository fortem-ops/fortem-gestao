// assistant-chat v1.2 — fixed credits query + service credits
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { messages, aluno_id, conversation_id } = await req.json();
  const userMessage = messages[messages.length - 1]?.content ?? "";

  // Buscar contratos ativos primeiro (para IDs dos ciclos)
  const { data: contratosAtivos } = await supabase
    .from("contratos")
    .select("id")
    .eq("aluno_id", aluno_id)
    .eq("status", "ativo");

  const contratoIds = (contratosAtivos || []).map((c: any) => c.id);
  const hoje = new Date().toISOString().slice(0, 10);

  // 1. Buscar dados contextuais do aluno
  const [alunoRes, planoRes, pontosRes, agendamentosRes, avaliacaoRes, cicloRes, servicosRes] = await Promise.all([
    supabase.from("alunos").select("nome, email").eq("id", aluno_id).maybeSingle(),
    supabase
      .from("planos")
      .select("tipo, data_inicio, data_fim, servicos, ativo")
      .eq("aluno_id", aluno_id)
      .eq("ativo", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("clube_pontos").select("saldo, nivel").eq("aluno_id", aluno_id).maybeSingle(),
    supabase
      .from("treino_agendamentos")
      .select("data, horario_inicio, status")
      .eq("aluno_id", aluno_id)
      .gte("data", hoje)
      .in("status", ["agendado", "confirmado"])
      .order("data")
      .limit(3),
    supabase
      .from("avaliacoes")
      .select("data, tipo")
      .eq("aluno_id", aluno_id)
      .in("tipo", ["funcional_v2", "funcional"])
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle(),
    contratoIds.length > 0
      ? supabase
          .from("ciclos_credito")
          .select("creditos_liberados, creditos_usados, data_fim, status")
          .eq("status", "ativo")
          .gte("data_fim", hoje)
          .in("contrato_id", contratoIds)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("creditos_aluno")
      .select("atividade, quantidade_inicial, quantidade_usada, ilimitado")
      .eq("aluno_id", aluno_id)
      .eq("ativo", true)
      .neq("atividade", "Treino"),
  ]);

  const aluno = alunoRes.data;
  const plano = planoRes.data;
  const pontos = pontosRes.data;
  const agendamentos = agendamentosRes.data || [];
  const ultimaAvaliacao = avaliacaoRes.data;
  const ciclo = cicloRes.data;
  const creditosDisponiveis = ciclo
    ? (ciclo.creditos_liberados - ciclo.creditos_usados)
    : null;
  const servicosCreditos = servicosRes.data || [];
  const servicosStr = servicosCreditos.length > 0
    ? servicosCreditos.map((s: any) => {
        const saldo = s.ilimitado ? "ilimitado" : `${s.quantidade_inicial - s.quantidade_usada} disponível(is) de ${s.quantidade_inicial}`;
        return `${s.atividade}: ${saldo}`;
      }).join(", ")
    : "nenhum serviço com crédito incluso";

  // 2. Buscar artigos relevantes da base de conhecimento
  const { data: allArticles } = await supabase
    .from("knowledge_articles")
    .select("pergunta, resposta, palavras_chave, aliases")
    .eq("ativo", true);

  const msgLower = userMessage.toLowerCase();
  const relevant = (allArticles || [])
    .map((a: any) => {
      let score = 0;
      const allText = [
        a.pergunta.toLowerCase(),
        a.resposta.toLowerCase(),
        ...(a.palavras_chave || []).map((k: string) => k.toLowerCase()),
        ...(a.aliases || []).map((al: string) => al.toLowerCase()),
      ].join(" ");

      const words = msgLower.split(/\s+/).filter((w: string) => w.length > 3);
      words.forEach((word: string) => {
        if (allText.includes(word)) score += 1;
      });

      if (a.pergunta.toLowerCase().includes(msgLower.slice(0, 30))) score += 3;

      return { ...a, score };
    })
    .filter((a: any) => a.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);

  // 3. Montar contexto do aluno
  const diasUltimaAval = ultimaAvaliacao
    ? Math.floor((Date.now() - new Date(ultimaAvaliacao.data).getTime()) / 86400000)
    : null;

  const alunoContext = `
DADOS DO ALUNO:
- Nome: ${aluno?.nome ?? "—"}
- Plano: ${plano?.tipo ?? "sem plano ativo"}
- Vigência: ${plano?.data_inicio ?? "—"} a ${plano?.data_fim ?? "—"}
- Créditos de treino disponíveis: ${creditosDisponiveis !== null ? `${creditosDisponiveis} créditos restantes (de ${ciclo?.creditos_liberados ?? 0} no total, ${ciclo?.creditos_usados ?? 0} utilizados)` : "informação não disponível"}
- Serviços inclusos no plano: ${servicosStr}
- Pontos no Clube FORTEM: ${pontos?.saldo ?? 0} (nível ${pontos?.nivel ?? "—"})
- Próximos treinos agendados: ${
    agendamentos.length > 0
      ? agendamentos.map((a: any) => `${a.data} às ${a.horario_inicio?.slice(0, 5)}`).join(", ")
      : "nenhum"
  }
- Última avaliação funcional: ${
    ultimaAvaliacao ? `${ultimaAvaliacao.data} (há ${diasUltimaAval} dias)` : "nunca realizada"
  }
- Data atual: ${hoje}
`.trim();

  const knowledgeContext =
    relevant.length > 0
      ? `\nINFORMAÇÕES RELEVANTES DA BASE DE CONHECIMENTO:\n${relevant
          .map((a: any) => `P: ${a.pergunta}\nR: ${a.resposta}`)
          .join("\n\n")}`
      : "";

  const systemPrompt = `Você é o Assistente FORTEM, um atendente virtual inteligente e simpático do centro de treinamento FORTEM em Porto Alegre, RS.

Seu objetivo é responder dúvidas dos alunos de forma clara, rápida e personalizada, usando os dados reais do aluno e a base de conhecimento fornecida.

${alunoContext}
${knowledgeContext}

DIRETRIZES:
- Responda SEMPRE em português brasileiro
- Seja direto e conciso — respostas de 2 a 4 frases no máximo, a menos que precise explicar algo complexo
- Use o nome do aluno ocasionalmente para personalizar
- Quando souber a resposta com certeza, responda diretamente
- Quando a dúvida for sobre dados específicos do aluno (créditos, agendamentos, plano), use os dados fornecidos acima
- Quando não souber ou a questão precisar de ação humana (cancelamento, pagamento, problema técnico grave), diga que vai conectar com a equipe
- Nunca invente informações — se não sabe, diga claramente
- Tom: amigável, profissional, motivador — como um personal trainer que também é ótimo em atendimento
- NÃO use markdown com asteriscos ou hashtags — use texto simples
- Não mencione que é uma IA — apenas "Assistente FORTEM"

QUANDO ESCALAR PARA HUMANO:
Se o aluno pedir para falar com alguém, reclamar, ou a dúvida não estiver na base de conhecimento, finalize com: [ESCALAR_WHATSAPP]`;

  const claudeMessages = [
    ...messages.slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: claudeMessages,
    }),
  });

  const claudeData = await claudeRes.json();
  const assistantText =
    claudeData.content?.[0]?.text ??
    "Desculpe, não consegui processar sua mensagem. Tente novamente.";

  const shouldEscalate = assistantText.includes("[ESCALAR_WHATSAPP]");
  const cleanText = assistantText.replace("[ESCALAR_WHATSAPP]", "").trim();

  // 5. Salvar conversa
  let convId = conversation_id;
  if (!convId) {
    const { data: conv } = await supabase
      .from("assistant_conversations")
      .insert({
        aluno_id,
        messages: JSON.stringify([
          { role: "user", content: userMessage, timestamp: new Date().toISOString() },
          { role: "assistant", content: cleanText, timestamp: new Date().toISOString() },
        ]),
        escalou_para_humano: shouldEscalate,
      })
      .select("id")
      .single();
    convId = conv?.id;
  } else {
    const { data: conv } = await supabase
      .from("assistant_conversations")
      .select("messages")
      .eq("id", convId)
      .single();
    const existingMessages =
      typeof conv?.messages === "string" ? JSON.parse(conv.messages) : conv?.messages || [];
    await supabase
      .from("assistant_conversations")
      .update({
        messages: JSON.stringify([
          ...existingMessages,
          { role: "user", content: userMessage, timestamp: new Date().toISOString() },
          { role: "assistant", content: cleanText, timestamp: new Date().toISOString() },
        ]),
        escalou_para_humano: shouldEscalate,
        escalou_em: shouldEscalate ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", convId);
  }

  return new Response(
    JSON.stringify({
      message: cleanText,
      should_escalate: shouldEscalate,
      conversation_id: convId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
