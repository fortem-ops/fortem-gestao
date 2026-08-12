import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Rota = "aluno" | "somente_corrida" | "prospect" | "somente_provas";

const TIER_CATALOGO: Record<string, string> = {
  start: "Corrida - Start",
  start_plus: "Corrida - Start+",
  power: "Corrida - Power",
  pro: "Corrida - Pro",
  max: "Corrida - Max",
};

const PLANO_BASE_LABEL: Record<string, string> = {
  start: "Start",
  start_plus: "Start+",
  power: "Power",
  pro: "Pro",
  max: "Max",
};

const VALOR_PROVA = 289;

// Hash SHA-256 do CPF autorizado a testar cobrança real com valor simbólico.
const CPF_TESTE_HASH = "9d4b1135d02aa574942b053143c2c76ceb5d4d472be2c04138b314d179482ee3";
const VALOR_TESTE = 10;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const brl = (v: number) =>
  `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pad = (n: number) => String(n).padStart(2, "0");

function formatarCPF(cpf: string) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : (cpf ?? "");
}

function formatarData(d?: string | null) {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function vigenciaTexto(meses: number | null) {
  if (meses === 1) return "1 (um) mês";
  if (meses === 6) return "6 (seis) meses";
  if (meses === 12) return "12 (doze) meses";
  return meses ? `${meses} meses` : "";
}

function preencher(conteudo: string, vars: Record<string, string>) {
  return conteudo.replace(/%([A-Z_0-9]+)%/g, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // rollback manual — registros criados nesta execução, na ordem de criação
  const criados: { tabela: string; id: string }[] = [];
  const rollback = async () => {
    for (const r of [...criados].reverse()) {
      try {
        await admin.from(r.tabela).delete().eq("id", r.id);
      } catch (e) {
        console.error("rollback falhou", r, e);
      }
    }
  };

  try {
    const body = await req.json().catch(() => ({}));
    const rota = String(body?.rota ?? "") as Rota;
    if (!["aluno", "somente_corrida", "prospect", "somente_provas"].includes(rota)) {
      return json(400, { error: "rota_invalida" });
    }

    const dp = body?.dadosPessoais ?? {};
    const pedidoResumo = body?.pedidoResumo ?? {};
    let total = Number(pedidoResumo?.total ?? 0);
    if (!Number.isFinite(total) || total < 0) return json(400, { error: "total_invalido" });

    const cortesiaNb = body?.cortesiaNb ?? null;
    const mipoa = body?.mipoa ?? null;
    const provasSel: any[] = Array.isArray(body?.provasSel) ? body.provasSel : [];
    const temProva = Boolean(cortesiaNb?.ativo) || Boolean(mipoa?.ativo);

    const nomeCompleto = [dp?.nome, dp?.sobrenome].filter(Boolean).join(" ").trim();

    const cpfDigitsPayload = String(dp?.cpf ?? "").replace(/\D/g, "");
    const cpfHashPayload = cpfDigitsPayload.length === 11 ? await sha256Hex(cpfDigitsPayload) : null;

    // gera um novo token de sessão para cadastro de cartão
    const gerarTokenCartao = async (aid: string) => {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const valor = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { data, error } = await admin
        .from("links_cartao")
        .insert({
          aluno_id: aid,
          token: valor,
          origem: "link_cadastro",
          criado_por: null,
          expira_em: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`falha_criar_link_cartao: ${error?.message}`);
      return { valor, id: data.id as string };
    };

    // ---------- 0. idempotência ----------
    const idempotencyKey = String(body?.idempotency_key ?? "").trim() || null;
    if (idempotencyKey) {
      const { data: vendaExistente } = await admin
        .from("vendas")
        .select("id, aluno_id, plano_id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (vendaExistente) {
        const { data: contratoExistente } = await admin
          .from("contratos")
          .select("id")
          .eq("aluno_id", vendaExistente.aluno_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();


        let docsQuery = admin
          .from("contratos_documentos")
          .select("id, conteudo_gerado, template_id")
          .order("created_at", { ascending: true });
        docsQuery = contratoExistente?.id
          ? docsQuery.eq("contrato_id", contratoExistente.id)
          : docsQuery.eq("aluno_id", vendaExistente.aluno_id);
        const { data: docs } = await docsQuery;

        const templateIds = [...new Set((docs ?? []).map((d: any) => d.template_id).filter(Boolean))];
        const { data: templates } = templateIds.length
          ? await admin.from("contrato_templates").select("id, nome").in("id", templateIds)
          : { data: [] as any[] };
        const nomePorTemplate = new Map((templates ?? []).map((t: any) => [t.id, t.nome]));
        const docsDoContrato = docs ?? [];


        // token de cartão: reaproveita um válido ou gera outro
        const { data: linkValido } = await admin
          .from("links_cartao")
          .select("token")
          .eq("aluno_id", vendaExistente.aluno_id)
          .eq("usado", false)
          .gt("expira_em", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const tokenCartao = linkValido?.token ?? (await gerarTokenCartao(vendaExistente.aluno_id!)).valor;

        return json(200, {
          ok: true,
          reused: true,
          aluno_id: vendaExistente.aluno_id,
          plano_id: vendaExistente.plano_id,
          contrato_id: contratoExistente?.id ?? null,
          venda_id: vendaExistente.id,
          contratos_documentos_ids: docsDoContrato.map((d: any) => d.id),
          contratos_documentos: docsDoContrato.map((d: any) => ({
            id: d.id,
            nome: nomePorTemplate.get(d.template_id) ?? "Contrato",
            conteudo_gerado: d.conteudo_gerado,
          })),
          cartao_token: tokenCartao,
        });
      }
    }

    // ---------- 1. aluno ----------
    let alunoId: string | null = body?.alunoId ?? null;

    // CPF é a fonte da verdade: se já existe aluno com esse CPF, reaproveita.
    if (cpfHashPayload) {
      const { data: alunoCpf } = await admin
        .from("alunos")
        .select("id")
        .eq("cpf_hash", cpfHashPayload)
        .limit(1)
        .maybeSingle();
      if (alunoCpf?.id) alunoId = alunoCpf.id;
    }

    if (!alunoId) {
      if (!nomeCompleto) return json(400, { error: "nome_obrigatorio" });
      const end = dp?.endereco ?? {};
      const { data: novoAluno, error: alunoErr } = await admin
        .from("alunos")
        .insert({
          nome: nomeCompleto,
          email: dp?.email ?? null,
          telefone: dp?.telefone ?? null,
          data_nascimento: dp?.data_nascimento ?? null,
          status: rota === "somente_provas" ? "avulso" : "prospect",
          cep: end?.cep ?? null,
          logradouro: end?.logradouro ?? null,
          numero: end?.numero ?? null,
          complemento: end?.complemento ?? null,
          bairro: end?.bairro ?? null,
          cidade: end?.cidade ?? null,
          uf: end?.uf ?? null,
          observacoes: "Cadastro criado pelo checkout público /corrida",
        })
        .select("id")
        .single();
      if (alunoErr || !novoAluno) throw new Error(`falha_criar_aluno: ${alunoErr?.message}`);
      alunoId = novoAluno.id;
      criados.push({ tabela: "alunos", id: alunoId! });

      if (dp?.cpf) {
        const { error: cpfErr } = await admin.rpc("fn_service_set_cpf", {
          p_aluno_id: alunoId,
          p_cpf: String(dp.cpf),
        });
        if (cpfErr) console.error("fn_service_set_cpf falhou:", cpfErr.message);
      }
    }

    // dados do aluno para o contrato
    const { data: aluno } = await admin
      .from("alunos")
      .select("nome, email, rg, data_nascimento, logradouro, numero, complemento, bairro, cidade, uf, cep")
      .eq("id", alunoId)
      .single();

    let cpfCompleto = String(dp?.cpf ?? "").replace(/\D/g, "");
    if (!cpfCompleto) {
      const { data: cpfRpc } = await admin.rpc("fn_reveal_cpf", { p_aluno_id: alunoId });
      if (typeof cpfRpc === "string") cpfCompleto = cpfRpc;
    }
    cpfCompleto = cpfCompleto.replace(/\D/g, "");

    // Modo teste: CPF autorizado paga valor simbólico (só o valor muda).
    if (cpfCompleto.length === 11 && (await sha256Hex(cpfCompleto)) === CPF_TESTE_HASH) {
      total = VALOR_TESTE;
      console.log("modo_teste_valor_simbolico aplicado");
    }

    let planoId: string | null = null;
    let contratoId: string | null = null;
    let vendaId: string | null = null;
    const documentosIds: string[] = [];
    const documentos: { id: string; nome: string; conteudo_gerado: string }[] = [];
    let catalogoId: string | null = null;
    let nomeSnapshot = "";
    let formaPagamento = "cartao_parcelado";
    let parcelas = 1;
    let tipoVenda: "plano" | "servico" = "plano";
    let planoNomeCatalogo = "";

    if (rota === "somente_provas") {
      // ---------- 4. venda avulsa de serviço ----------
      tipoVenda = "servico";
      const { data: servico, error: srvErr } = await admin
        .from("servicos_catalogo")
        .select("id, nome")
        .eq("nome", "Inscrição em Prova Avulsa (Corrida)")
        .maybeSingle();
      if (srvErr || !servico) throw new Error("servico_catalogo_nao_encontrado");
      catalogoId = servico.id;
      const nomesProvas = provasSel
        .map((p: any) => [p?.nome ?? p?.prova, p?.distancia].filter(Boolean).join(" "))
        .filter(Boolean);
      nomeSnapshot = nomesProvas.length
        ? `Inscrição em prova avulsa — ${nomesProvas.join(", ")}`
        : "Inscrição em prova avulsa (Corrida)";
      formaPagamento = "cartao_parcelado";
      parcelas = 1;
    } else {
      // ---------- 2. plano + contrato ----------
      const periodo: "mensal" | "anual" =
        rota === "prospect" ? (body?.periodo === "mensal" ? "mensal" : "anual") : "anual";
      const periodoMeses = periodo === "mensal" ? 1 : 12;

      if (rota === "aluno") {
        const tier = String(body?.tier ?? "");
        planoNomeCatalogo = TIER_CATALOGO[tier] ?? "";
        if (!planoNomeCatalogo) throw new Error("tier_invalido");
      } else if (rota === "somente_corrida") {
        planoNomeCatalogo = "Corrida - Sem Plano";
      } else {
        planoNomeCatalogo = "Corrida - Prospect";
      }

      const { data: catalogo, error: catErr } = await admin
        .from("planos_catalogo")
        .select("id, nome, valor, periodo_meses, plano_base_requerido")
        .eq("atividade", "corrida")
        .eq("nome", planoNomeCatalogo)
        .eq("periodo_meses", periodoMeses)
        .maybeSingle();
      if (catErr || !catalogo) throw new Error(`catalogo_nao_encontrado: ${planoNomeCatalogo} ${periodoMeses}m`);
      catalogoId = catalogo.id;

      formaPagamento = periodo === "mensal" ? "cartao_recorrencia" : "cartao_parcelado";
      parcelas = rota === "prospect" ? (periodo === "mensal" ? 1 : 12) : 10;

      const hoje = new Date();
      const dataInicio = `${hoje.getUTCFullYear()}-${pad(hoje.getUTCMonth() + 1)}-${pad(hoje.getUTCDate())}`;
      const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + periodoMeses, hoje.getUTCDate()));
      const dataFim = `${fim.getUTCFullYear()}-${pad(fim.getUTCMonth() + 1)}-${pad(fim.getUTCDate())}`;

      const { data: plano, error: planoErr } = await admin
        .from("planos")
        .insert({
          aluno_id: alunoId,
          tipo: catalogo.nome,
          atividade: "corrida",
          data_inicio: dataInicio,
          data_fim: dataFim,
          duracao_meses: periodoMeses,
          valor: catalogo.valor,
          ativo: true,
          // recorrência mensal: renova/cobra automaticamente no próximo ciclo.
          // parcelado anual: cobrança única parcelada, sem renovação automática.
          renovacao_automatica: formaPagamento === "cartao_recorrencia",
          forma_pagamento_padrao: formaPagamento,
          parcelas_padrao: parcelas,
          observacoes: "Pedido /corrida — aguardando pagamento",
        })
        .select("id")
        .single();
      if (planoErr || !plano) throw new Error(`falha_criar_plano: ${planoErr?.message}`);
      planoId = plano.id;
      criados.push({ tabela: "planos", id: planoId! });

      // o gatilho trg_auto_criar_contrato_ciclo pode ter criado um contrato
      // placeholder — removemos para escrever o contrato real do pedido
      const { data: contratosAuto } = await admin.from("contratos").select("id").eq("plano_id", planoId);
      for (const c of contratosAuto ?? []) {
        await admin.from("contratos_documentos").delete().eq("contrato_id", c.id);
        await admin.from("contratos").delete().eq("id", c.id);
      }

      const { data: contrato, error: contratoErr } = await admin
        .from("contratos")
        .insert({
          aluno_id: alunoId,
          plano_id: planoId,
          plano_tipo: "corrida", // único valor aceito pelo CHECK de contratos
          vigencia_tipo: periodo,
          data_inicio: dataInicio,
          data_fim: dataFim,
          forma_pagamento: formaPagamento,
          valor_base: catalogo.valor,
          valor_cobrado: total,
          parcelas,
          // não existe status "pendente_pagamento" no CHECK de contratos;
          // o contrato nasce suspenso e é ativado quando o pagamento entrar
          status: "suspenso",
          observacoes: "Pedido /corrida — aguardando pagamento",
        })
        .select("id")
        .single();
      if (contratoErr || !contrato) throw new Error(`falha_criar_contrato: ${contratoErr?.message}`);
      contratoId = contrato.id;
      criados.push({ tabela: "contratos", id: contratoId! });

      // ---------- 3. documentos ----------
      const planoTipoTemplate = rota === "somente_corrida" ? "corrida_sem_plano" : "corrida";
      const { data: templatePrincipal } = await admin
        .from("contrato_templates")
        .select("id, nome, conteudo, versao")
        .eq("plano_tipo", planoTipoTemplate)
        .eq("forma_pagamento", formaPagamento)
        .eq("ativo", true)
        .maybeSingle();
      if (!templatePrincipal) throw new Error("template_principal_nao_encontrado");

      const { data: regulamento } = await admin
        .from("regulamento_interno_versoes")
        .select("versao")
        .eq("ativo", true)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!regulamento) throw new Error("regulamento_ativo_nao_encontrado");

      const hojeD = new Date();
      const baseVars: Record<string, string> = {
        NOME: aluno?.nome ?? nomeCompleto,
        DATA_NASCIMENTO: formatarData(aluno?.data_nascimento ?? dp?.data_nascimento),
        CPF: formatarCPF(cpfCompleto),
        RG: aluno?.rg ?? "",
        ENDERECO: aluno?.logradouro
          ? `${aluno.logradouro}, ${aluno.numero ?? ""}${aluno.complemento ? ` - ${aluno.complemento}` : ""}`
          : "",
        BAIRRO: aluno?.bairro ?? "",
        CIDADE: aluno?.cidade ?? "Porto Alegre",
        UF: aluno?.uf ?? "RS",
        CEP: aluno?.cep ?? "",
        EMAIL: aluno?.email ?? dp?.email ?? "",
        NOME_CONTRATO: templatePrincipal.nome,
        VALOR_FINAL_CONTRATO: brl(total),
        PARCELAS: String(parcelas),
        VIGENCIA_TEXTO: vigenciaTexto(periodoMeses),
        PLANO_BASE_VINCULADO: catalogo.plano_base_requerido
          ? (PLANO_BASE_LABEL[catalogo.plano_base_requerido] ?? catalogo.plano_base_requerido)
          : "nenhum (Corrida - Sem Plano)",
        DIA: pad(hojeD.getUTCDate()),
        MES: pad(hojeD.getUTCMonth() + 1),
        ANO: String(hojeD.getUTCFullYear()),
        ASSINATURA: "",
        ACEITE: "",
        DATA_ACEITE: "",
        FORMATO_ACEITE: "",
        IP_ACEITE: "",
      };

      const conteudoPrincipal = preencher(templatePrincipal.conteudo, baseVars);
      const { data: docPrincipal, error: docErr } = await admin
        .from("contratos_documentos")
        .insert({
          aluno_id: alunoId,
          contrato_id: contratoId,
          template_id: templatePrincipal.id,
          template_versao: templatePrincipal.versao,
          regulamento_versao: regulamento.versao,
          conteudo_gerado: conteudoPrincipal,
          variaveis_utilizadas: baseVars,
          aceite: false,
        })
        .select("id")
        .single();
      if (docErr || !docPrincipal) throw new Error(`falha_documento_principal: ${docErr?.message}`);
      documentosIds.push(docPrincipal.id);
      documentos.push({ id: docPrincipal.id, nome: templatePrincipal.nome, conteudo_gerado: conteudoPrincipal });
      criados.push({ tabela: "contratos_documentos", id: docPrincipal.id });


      if (temProva) {
        const { data: templateProvas } = await admin
          .from("contrato_templates")
          .select("id, nome, conteudo, versao")
          .eq("plano_tipo", "corrida_provas_inclusas")
          .eq("ativo", true)
          .maybeSingle();
        if (!templateProvas) throw new Error("template_provas_nao_encontrado");

        const linhas: string[] = [];
        if (cortesiaNb?.ativo) {
          linhas.push(`New Balance 42K Porto Alegre 2027 — ${cortesiaNb?.distancia ?? ""} — ${brl(VALOR_PROVA)}`.replace(/ — {2}/g, " — "));
        }
        if (mipoa?.ativo) {
          linhas.push(`Maratona Internacional de Porto Alegre (MIPOA) — ${mipoa?.distancia ?? ""} — ${brl(VALOR_PROVA)}`.replace(/ — {2}/g, " — "));
        }

        const varsProvas: Record<string, string> = {
          ...baseVars,
          NOME_CONTRATO: templateProvas.nome,
          PROVAS_INCLUSAS_DESCRICAO: linhas.join("; "),
        };

        const conteudoProvas = preencher(templateProvas.conteudo, varsProvas);
        const { data: docProvas, error: docProvasErr } = await admin
          .from("contratos_documentos")
          .insert({
            aluno_id: alunoId,
            contrato_id: contratoId,
            template_id: templateProvas.id,
            template_versao: templateProvas.versao,
            regulamento_versao: regulamento.versao,
            conteudo_gerado: conteudoProvas,
            variaveis_utilizadas: varsProvas,
            aceite: false,
          })
          .select("id")
          .single();
        if (docProvasErr || !docProvas) throw new Error(`falha_documento_provas: ${docProvasErr?.message}`);
        documentosIds.push(docProvas.id);
        documentos.push({ id: docProvas.id, nome: templateProvas.nome, conteudo_gerado: conteudoProvas });
        criados.push({ tabela: "contratos_documentos", id: docProvas.id });
      }


      nomeSnapshot = `${catalogo.nome} (${periodo === "mensal" ? "mensal" : "anual"}) — pedido /corrida`;
    }

    // ---------- 5. venda ----------
    const { data: venda, error: vendaErr } = await admin
      .from("vendas")
      .insert({
        aluno_id: alunoId,
        tipo: tipoVenda,
        catalogo_id: catalogoId,
        nome_snapshot: nomeSnapshot,
        valor: total,
        valor_final: total,
        desconto: 0,
        forma_pagamento: formaPagamento,
        parcelas: Math.max(1, parcelas),
        tipo_cobranca: formaPagamento === "cartao_recorrencia" ? "recorrencia" : "tradicional",
        origem: "corrida_publico",
        status_pagamento: "pendente",
        plano_id: planoId,
        idempotency_key: idempotencyKey,
        observacoes: JSON.stringify({ rota, pedidoResumo }).slice(0, 4000),
      })
      .select("id")
      .single();
    if (vendaErr || !venda) throw new Error(`falha_criar_venda: ${vendaErr?.message}`);
    vendaId = venda.id;
    criados.push({ tabela: "vendas", id: vendaId! });

    // ---------- 6. token de sessão para cadastro do cartão ----------
    const novoToken = await gerarTokenCartao(alunoId!);
    const cartaoTokenValor = novoToken.valor;
    criados.push({ tabela: "links_cartao", id: novoToken.id });


    return json(200, {
      ok: true,
      aluno_id: alunoId,
      plano_id: planoId,
      contrato_id: contratoId,
      venda_id: vendaId,
      contratos_documentos_ids: documentosIds,
      contratos_documentos: documentos,
      cartao_token: cartaoTokenValor,
    });
  } catch (err) {
    console.error("corrida-criar-pedido error:", err);
    await rollback();
    return json(500, { ok: false, error: String((err as Error)?.message ?? err) });
  }
});
