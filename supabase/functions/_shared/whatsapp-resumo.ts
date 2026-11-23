// Texto guardado na conversa (tela WhatsApp) quando o envio é por modelo da Meta.
type Param = { type?: unknown; text?: unknown };
type Component = { type?: unknown; parameters?: unknown };

export function resumoTemplate(templateName: string, components: unknown, resumo?: unknown): string {
  if (typeof resumo === 'string' && resumo.trim()) return resumo.trim();
  const textos: string[] = [];
  if (Array.isArray(components)) {
    for (const c of components as Component[]) {
      if (!Array.isArray(c?.parameters)) continue;
      for (const p of c.parameters as Param[]) {
        if (typeof p?.text === 'string' && p.text.trim() && p.text.trim() !== '—') textos.push(p.text.trim());
      }
    }
  }
  return `[Modelo: ${templateName}]${textos.length ? ' ' + textos.join(' · ') : ''}`;
}

const ORDEM: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/** Status novo só substitui se avançar (sent → delivered → read); failed sempre vale. */
export function statusAvanca(atual: string | null | undefined, novo: string): boolean {
  if (novo === 'failed') return true;
  return (ORDEM[novo] ?? 0) > (ORDEM[atual ?? ''] ?? 0);
}
