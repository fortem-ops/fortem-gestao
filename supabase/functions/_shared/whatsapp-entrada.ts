// Interpreta uma mensagem recebida do WhatsApp (webhook da Meta).
export type MensagemEntrada = {
  tipo: string;
  conteudo: string;
  reacao_a_wamid: string | null;
  media_id: string | null;
  media_mime: string | null;
};

export function interpretarMensagem(msg: any): MensagemEntrada {
  const tipo = msg?.type ?? 'text';
  const base: MensagemEntrada = { tipo, conteudo: '', reacao_a_wamid: null, media_id: null, media_mime: null };
  if (tipo === 'text') base.conteudo = msg.text?.body ?? '';
  else if (tipo === 'button') base.conteudo = msg.button?.text ?? '';
  else if (tipo === 'interactive') {
    base.conteudo = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '[interativo]';
  } else if (tipo === 'reaction') {
    base.conteudo = msg.reaction?.emoji ?? '';
    base.reacao_a_wamid = msg.reaction?.message_id ?? null;
  } else if (tipo === 'sticker' || tipo === 'image') {
    const m = msg[tipo] ?? {};
    base.conteudo = tipo === 'image' ? (m.caption ?? '') : '';
    base.media_id = m.id ?? null;
    base.media_mime = m.mime_type ?? null;
  } else base.conteudo = `[${tipo}]`;
  return base;
}

export function previaConversa(m: MensagemEntrada): string {
  if (m.tipo === 'reaction') return m.conteudo ? `Reagiu ${m.conteudo} à mensagem` : 'Removeu a reação';
  if (m.tipo === 'sticker') return 'Figurinha';
  if (m.tipo === 'image') return m.conteudo ? `📷 ${m.conteudo}` : '📷 Foto';
  return m.conteudo;
}

/** Baixa a mídia da Meta e salva no bucket privado. Retorna o caminho salvo ou null. */
export async function baixarMidia(admin: any, mediaId: string, mime: string | null): Promise<string | null> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  if (!token) return null;
  try {
    const info = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!info.ok) { console.error('[midia] info', info.status, await info.text()); return null; }
    const j = await info.json();
    const bin = await fetch(j.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) { console.error('[midia] download', bin.status); return null; }
    const tipo = mime ?? j.mime_type ?? 'application/octet-stream';
    const ext = tipo.includes('webp') ? 'webp' : tipo.includes('png') ? 'png' : tipo.includes('jpeg') ? 'jpg' : 'bin';
    const path = `${mediaId}.${ext}`;
    const { error } = await admin.storage.from('whatsapp-midia').upload(path, await bin.arrayBuffer(), { contentType: tipo, upsert: true });
    if (error) { console.error('[midia] upload', error); return null; }
    return path;
  } catch (e) {
    console.error('[midia] erro', e);
    return null;
  }
}
