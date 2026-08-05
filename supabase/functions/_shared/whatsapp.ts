// Helpers compartilhados de envio WhatsApp entre edge functions.

export function normalizarTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  const digits = tel.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length >= 10) return '55' + digits;
  return digits;
}

export function sanitizeTextParam(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}

export function resolveTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/%[A-Z_]+%/g, (m) => (m in vars ? vars[m] : m));
}

export type SendResult = { ok: boolean; error?: string; details?: unknown };

export async function callSendWhatsApp(payload: Record<string, unknown>): Promise<SendResult> {
  try {
    const resp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'x-supabase-service-role': 'true',
      },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || (json && (json as any).error)) {
      return {
        ok: false,
        error: (json as any)?.error ?? `HTTP ${resp.status}`,
        details: (json as any)?.details ?? json,
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function sendWhatsAppText(to: string, text: string): Promise<SendResult> {
  return callSendWhatsApp({ to, type: 'text', text });
}

/**
 * Registra a mensagem enviada no chat interno (whatsapp_conversas + whatsapp_mensagens).
 * `admin` é um SupabaseClient com service role.
 */
export async function registrarNoChat(
  admin: any,
  telefone: string,
  nome: string | null,
  mensagem: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  let conversaId: string | null = null;

  const { data: upserted } = await admin
    .from('whatsapp_conversas')
    .upsert(
      {
        telefone,
        nome_contato: nome ?? undefined,
        ultima_mensagem: mensagem.substring(0, 100),
        ultima_mensagem_at: nowIso,
      },
      { onConflict: 'telefone', ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (upserted?.id) {
    conversaId = upserted.id;
  } else {
    const { data: existing } = await admin
      .from('whatsapp_conversas')
      .select('id')
      .eq('telefone', telefone)
      .maybeSingle();
    conversaId = existing?.id ?? null;
  }

  if (!conversaId) return;

  await admin.from('whatsapp_mensagens').insert({
    conversa_id: conversaId,
    direcao: 'enviada',
    tipo: 'text',
    conteudo: mensagem,
    status: 'sent',
    enviado_por: null,
  });
}
