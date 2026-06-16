import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeEmailSubject(subject: string) {
  return subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function sendGmailEmail(to: string, subject: string, htmlBody: string) {
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) throw new Error("GMAIL_APP_PASSWORD not configured");
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: "contatofortem@gmail.com", password },
    },
  });
  await client.send({ from: "contatofortem@gmail.com", to, subject: normalizeEmailSubject(subject), content: "auto", html: htmlBody });
  await client.close();
}

function isValidCPF(cpf: string): boolean {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let c = 11 - (s % 11);
  if (c >= 10) c = 0;
  if (parseInt(d[9]) !== c) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  c = 11 - (s % 11);
  if (c >= 10) c = 0;
  return parseInt(d[10]) === c;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SIGNATURE_BYTES = 1_000_000; // ~1 MB raw signature payload

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // ---- Server-side input validation ----
    const cpfRaw = typeof body.cpf === "string" ? body.cpf : "";
    if (!isValidCPF(cpfRaw)) {
      return new Response(JSON.stringify({ error: "CPF inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cpfDigits = cpfRaw.replace(/\D/g, "");
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!nome || nome.length > 200) {
      return new Response(JSON.stringify({ error: "Nome inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!EMAIL_RE.test(email) || email.length > 200) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const telefone = typeof body.telefone === "string" ? body.telefone.slice(0, 32) : null;
    const emergName = typeof body.emergency_contact_name === "string" ? body.emergency_contact_name.slice(0, 200) : null;
    const emergPhone = typeof body.emergency_contact_phone === "string" ? body.emergency_contact_phone.slice(0, 32) : null;
    const medical_status = body.medical_status === "ok" || body.medical_status === "restricao" ? body.medical_status : "ok";
    const image_usage = !!body.image_usage;

    if (typeof body.signature_data === "string" && body.signature_data.length > MAX_SIGNATURE_BYTES) {
      return new Response(JSON.stringify({ error: "Assinatura excede o tamanho permitido" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );


    // Validate attachment_url: must be HTTPS inside our own storage bucket.
    // Prevents stored javascript:/data: URIs that would XSS the admin UI.
    let safeAttachmentUrl: string | null = null;
    if (body.attachment_url) {
      try {
        const u = new URL(String(body.attachment_url));
        const expectedHost = new URL(supabaseUrl).host;
        if (
          u.protocol === "https:" &&
          u.host === expectedHost &&
          u.pathname.includes("/storage/v1/object/") &&
          u.pathname.includes("/legal_annex_attachments/")
        ) {
          safeAttachmentUrl = u.toString();
        }
      } catch {
        /* invalid URL discarded */
      }
    }

    // Upload signature image
    let signaturePublicUrl: string | null = null;
    if (body.signature_data && body.signature_data.startsWith("data:image/")) {
      try {
        const base64Data = body.signature_data.split(",")[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const fileName = `signatures/sig_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.png`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from("legal_annex_attachments")
          .upload(fileName, bytes.buffer, { contentType: "image/png", upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage.from("legal_annex_attachments").getPublicUrl(fileName);
          signaturePublicUrl = urlData.publicUrl;
        } else {
          console.error("Signature upload error:", uploadError);
        }
      } catch (sigErr) {
        console.error("Signature processing error:", sigErr);
      }
    }

    const documentType = body.document_type === "experimental" ? "experimental" : "anexo";

    // Upsert by CPF + document_type
    const { data: existing } = await supabaseAdmin
      .from("legal_annexes")
      .select("id")
      .eq("cpf", body.cpf)
      .eq("document_type", documentType)
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      document_type: documentType,
      nome: body.nome,
      data_nascimento: body.data_nascimento || null,
      cpf: body.cpf,
      telefone: body.telefone || null,
      email: body.email,
      emergency_contact_name: body.emergency_contact_name || null,
      emergency_contact_phone: body.emergency_contact_phone || null,
      medical_status: body.medical_status,
      image_usage: body.image_usage,
      signature_data: body.signature_data || null,
      attachment_url: safeAttachmentUrl,
      ip_address: ip,
      signed_at: new Date().toISOString(),
    };

    let data: any;
    let error: any;
    if (existing?.id) {
      const upd = await supabaseAdmin.from("legal_annexes").update(payload).eq("id", existing.id).select().single();
      data = upd.data; error = upd.error;
    } else {
      const ins = await supabaseAdmin.from("legal_annexes").insert(payload).select().single();
      data = ins.data; error = ins.error;
    }
    if (error) throw error;

    // Send confirmation email (non-blocking)
    try {
      const sectionStyle = `margin-bottom: 20px;`;
      const sectionTitle = `font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px;`;
      const sectionText = `font-size: 13px; color: #444; line-height: 1.7;`;
      const listStyle = `padding-left: 20px; margin: 8px 0;`;

      const emailHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #f8f9fa;">
  <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="text-align: center; margin-bottom: 24px;">
      <span style="font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #1a1a2e;">FORTEM</span>
    </div>
    <h1 style="font-size: 20px; color: #1a1a2e; margin-bottom: 8px; text-align: center;">${documentType === "experimental" ? "Anexo I – Declaração de Aptidão Física" : "Anexo I – Declaração de Aptidão Física e Uso de Imagem"}</h1>
    <p style="font-size: 13px; color: #888; text-align: center; margin-bottom: 28px;">Documento assinado digitalmente</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
    <div style="${sectionStyle}"><h3 style="${sectionTitle}">1. DECLARAÇÃO DE CONDIÇÕES DE SAÚDE</h3><p style="${sectionText}">Declaro estar em condições adequadas para a prática de atividades físicas, comprometendo-me a apresentar atestado médico em caso de restrições.</p></div>
    <div style="${sectionStyle}"><h3 style="${sectionTitle}">2. CIÊNCIA DOS RISCOS</h3><p style="${sectionText}">Estou ciente de que a prática de atividades físicas envolve riscos inerentes (lesões, mal-estar, fadiga) mesmo com acompanhamento profissional.</p></div>
    <div style="${sectionStyle}"><h3 style="${sectionTitle}">3. RESPONSABILIDADE</h3><p style="${sectionText}">Comprometo-me a informar alterações no estado de saúde e seguir orientações dos profissionais da FORTEM.</p></div>
    ${documentType === "experimental" ? "" : `<div style="${sectionStyle}"><h3 style="${sectionTitle}">4. USO DE IMAGEM</h3><p style="${sectionText}">${data.image_usage ? "Autorizo" : "Não autorizo"} a utilização da minha imagem pela FORTEM TREINAMENTO FÍSICO LTDA para fins institucionais e promocionais.</p></div>`}
    <hr style="border: none; border-top: 2px solid #1a1a2e; margin: 28px 0;" />
    <h2 style="font-size: 16px; color: #1a1a2e; margin-bottom: 16px;">Dados da Assinatura</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">Nome</td><td style="padding: 10px 0; text-align: right; font-size: 13px; font-weight: 500;">${data.nome}</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">CPF</td><td style="padding: 10px 0; text-align: right; font-size: 13px; font-family: monospace;">${data.cpf}</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">E-mail</td><td style="padding: 10px 0; text-align: right; font-size: 13px;">${data.email}</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">Telefone</td><td style="padding: 10px 0; text-align: right; font-size: 13px;">${data.telefone || "—"}</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">Contato emergência</td><td style="padding: 10px 0; text-align: right; font-size: 13px;">${data.emergency_contact_name || "—"} ${data.emergency_contact_phone ? "(" + data.emergency_contact_phone + ")" : ""}</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">Data</td><td style="padding: 10px 0; text-align: right; font-size: 13px;">${new Date(data.signed_at).toLocaleString("pt-BR")}</td></tr>
      <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; color: #888; font-size: 13px;">Avaliação médica</td><td style="padding: 10px 0; text-align: right; font-size: 13px;">${data.medical_status === "ok" ? "Sem restrições" : "Com restrições"}</td></tr>
      ${documentType === "experimental" ? "" : `<tr><td style="padding: 10px 0; color: #888; font-size: 13px;">Uso de imagem</td><td style="padding: 10px 0; text-align: right; font-size: 13px;">${data.image_usage ? "Autorizado" : "Não autorizado"}</td></tr>`}
    </table>
    ${signaturePublicUrl ? `<div style="margin-top: 20px; text-align: center;"><p style="font-size: 12px; color: #888; margin-bottom: 8px;">Assinatura digital:</p><img src="${signaturePublicUrl}" alt="Assinatura" style="max-width: 300px; height: auto; border: 1px solid #eee; border-radius: 8px; padding: 8px;" /></div>` : ""}
    <p style="color: #888; font-size: 12px; margin-top: 24px; text-align: center;">Este documento tem validade jurídica. Guarde este e-mail como comprovante.</p>
    <p style="color: #aaa; font-size: 11px; text-align: center; margin-top: 16px;">IP: ${ip}</p>
  </div>
</body></html>`;

      await sendGmailEmail(data.email, "FORTEM – Assinatura Concluída ✓", emailHtml);
      console.log(`Email enviado: ${data.email}`);
    } catch (emailErr) {
      console.error("Falha no envio de email (não bloqueante):", emailErr);
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
