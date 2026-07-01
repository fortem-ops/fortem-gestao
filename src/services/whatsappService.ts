import { supabase } from "@/integrations/supabase/client";

export type WhatsAppComponent = {
  type: "body" | "header" | "button";
  parameters?: Array<{ type: "text"; text: string }>;
  [key: string]: unknown;
};

export interface SendTemplateResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  details?: unknown;
  status?: number;
}

/**
 * Chama a edge function `send-whatsapp` para disparar uma mensagem baseada em template.
 */
export async function sendTemplate(
  phone: string,
  templateName: string,
  language: string = "pt_BR",
  components: WhatsAppComponent[] = [],
): Promise<SendTemplateResult> {
  const to = String(phone).replace(/\D/g, "");

  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: {
      to,
      template_name: templateName,
      language,
      components,
    },
  });

  if (error) {
    return { ok: false, error: error.message ?? "Falha ao invocar send-whatsapp" };
  }
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    return { ok: false, ...(data as Record<string, unknown>) };
  }
  return { ok: true, result: data };
}

/** Confirmação de agendamento — template `agendamento_confirmacao` (variáveis: nome, data, horário). */
export function sendAgendamentoConfirmation(
  phone: string,
  nomeAluno: string,
  data: string,
  horario: string,
) {
  return sendTemplate(phone, "agendamento_confirmacao", "pt_BR", [
    {
      type: "body",
      parameters: [
        { type: "text", text: nomeAluno },
        { type: "text", text: data },
        { type: "text", text: horario },
      ],
    },
  ]);
}

/** Lembrete de renovação — template `renovacao_lembrete` (variáveis: nome, plano, dias restantes). */
export function sendRenovacaoLembrete(
  phone: string,
  nomeAluno: string,
  nomePlano: string,
  diasRestantes: number,
) {
  return sendTemplate(phone, "renovacao_lembrete", "pt_BR", [
    {
      type: "body",
      parameters: [
        { type: "text", text: nomeAluno },
        { type: "text", text: nomePlano },
        { type: "text", text: String(diasRestantes) },
      ],
    },
  ]);
}
