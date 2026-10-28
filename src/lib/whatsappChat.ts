// Funções puras do chat do WhatsApp (reações, telefone, prévia).

export type MsgBase = { id: string; wamid?: string | null; tipo: string; conteudo: string | null; reacao_a_wamid?: string | null; created_at: string };

/** Separa reações da linha do tempo: retorna mensagens sem reações e mapa wamid → emojis (última reação por remetente). */
export function separarReacoes<T extends MsgBase>(msgs: T[]): { linha: T[]; reacoes: Record<string, string[]> } {
  const linha: T[] = [];
  const ultima: Record<string, string> = {};
  for (const m of msgs) {
    if (m.tipo === "reaction") {
      if (m.reacao_a_wamid) ultima[m.reacao_a_wamid] = m.conteudo ?? "";
    } else linha.push(m);
  }
  const reacoes: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(ultima)) if (v) reacoes[k] = [v];
  return { linha, reacoes };
}

/** Chave de comparação de telefone: DDD + últimos 8 dígitos (ignora 55 e o 9º dígito). */
export function chaveTelefone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter((x) => /\p{L}/u.test(x));
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

/** Índice da primeira mensagem recebida não lida (as últimas `naoLidas` recebidas). -1 se nenhuma. */
export function indicePrimeiraNaoLida(msgs: { direcao: string }[], naoLidas: number): number {
  if (naoLidas <= 0) return -1;
  let n = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].direcao === "recebida") {
      n++;
      if (n === naoLidas) return i;
    }
  }
  return msgs.findIndex((m) => m.direcao === "recebida");
}

/** Rótulo curto de uma mensagem para prévia/pop-up (espelha o webhook). */
export function rotuloPrevia(tipo: string, conteudo: string | null): string {
  const c = (conteudo ?? "").trim();
  if (tipo === "reaction") return c ? `Reagiu ${c} à mensagem` : "Removeu a reação";
  if (tipo === "sticker") return "Figurinha";
  if (tipo === "image") return c ? `📷 ${c}` : "📷 Foto";
  if (tipo === "audio") return "🎤 Áudio";
  if (tipo === "video") return "🎬 Vídeo";
  if (tipo === "document") return "📄 Documento";
  if (!c || /^\[[a-z_]+\]$/.test(c)) return "Nova mensagem";
  return c.length > 100 ? c.slice(0, 100) + "…" : c;
}

/** Texto do pop-up agrupado por conversa. */
export function textoAgrupado(qtd: number, ultimo: string): string {
  return qtd > 1 ? `${qtd} mensagens novas · ${ultimo}` : ultimo;
}
