import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { interagir, validarComentario, visitanteId, type FestaInteracao } from "@/lib/festaInteracoes";

export default function FestaFotoInteracao({ fotoId, info, onChange }: { fotoId: string; info?: FestaInteracao; onChange: (i: FestaInteracao) => void }) {
  const atual = info ?? { curtidas: 0, curti: false, comentarios: [] };
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(() => localStorage.getItem("festa_nome") ?? "");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function curtir() {
    const curtir = !atual.curti;
    onChange({ ...atual, curti: curtir, curtidas: Math.max(0, atual.curtidas + (curtir ? 1 : -1)) });
    try { await interagir({ acao: "curtir", foto_id: fotoId, visitante_id: visitanteId(), curtir }); }
    catch { onChange(atual); }
  }

  async function comentar(e: React.FormEvent) {
    e.preventDefault();
    const v = validarComentario(nome, texto);
    if (v) { setErro(v); return; }
    setEnviando(true); setErro(null);
    try {
      const r = await interagir({ acao: "comentar", foto_id: fotoId, nome: nome.trim(), texto: texto.trim() });
      localStorage.setItem("festa_nome", nome.trim());
      onChange({ ...atual, comentarios: [...atual.comentarios, r.comentario] });
      setTexto("");
    } catch (er) { setErro((er as Error).message); }
    finally { setEnviando(false); }
  }

  const campo = "w-full border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="mt-2">
      <div className="flex items-center gap-4">
        <button type="button" onClick={curtir} aria-pressed={atual.curti} aria-label={atual.curti ? "Descurtir foto" : "Curtir foto"}
          className="inline-flex min-h-11 items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Heart className={`h-5 w-5 ${atual.curti ? "fill-primary text-primary" : ""}`} />{atual.curtidas}
        </button>
        <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto} aria-label="Comentários"
          className="inline-flex min-h-11 items-center gap-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MessageCircle className="h-5 w-5" />{atual.comentarios.length}
        </button>
      </div>
      {aberto && (
        <div className="space-y-3 border-t border-border pt-3">
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {atual.comentarios.length === 0 && <li className="text-sm text-muted-foreground">Seja o primeiro a comentar.</li>}
            {atual.comentarios.map((c) => (
              <li key={c.id} className="break-words text-sm"><strong className="font-bold">{c.nome}</strong> {c.texto}</li>
            ))}
          </ul>
          <form onSubmit={comentar} className="space-y-2">
            <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" aria-label="Seu nome" maxLength={60} />
            <textarea className={campo} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva um comentário" aria-label="Comentário" maxLength={300} rows={2} />
            {erro && <p role="alert" className="text-sm festa-marca">{erro}</p>}
            <button type="submit" disabled={enviando} className="inline-flex min-h-11 items-center bg-primary px-5 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground disabled:opacity-60">
              {enviando ? "Enviando…" : "Comentar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
