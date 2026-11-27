import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import {
  SUGESTAO_CATEGORIAS,
  labelCategoriaSugestao,
  labelStatusSugestao,
  validarNovaSugestao,
  type SugestaoCategoria,
  type SugestaoRow,
} from "@/lib/portalSugestoes";

export default function PortalSugestoes() {
  const { user } = useAuth();
  const { student } = useStudentPortal();
  const queryClient = useQueryClient();

  const [categoria, setCategoria] = useState<SugestaoCategoria>("treinos");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: sugestoes = [], isLoading } = useQuery<SugestaoRow[]>({
    queryKey: ["portal-sugestoes", student?.id],
    enabled: Boolean(student?.id && user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_sugestoes")
        .select("*")
        .eq("aluno_id", student!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enviarMutation = useMutation({
    mutationFn: async () => {
      const erro = validarNovaSugestao({ categoria, titulo, descricao });
      if (erro) throw new Error(erro);
      if (!student?.id || !user?.id) throw new Error("Sessão não encontrada.");

      const { error } = await supabase.from("portal_sugestoes").insert({
        aluno_id: student.id,
        user_id: user.id,
        categoria,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitulo("");
      setDescricao("");
      setCategoria("treinos");
      toast.success("Sugestão enviada para a equipe.");
      queryClient.invalidateQueries({ queryKey: ["portal-sugestoes", student?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível enviar sua sugestão.");
    },
  });

  const statusBadgeClass = (status: string) => {
    if (status === "aprovada") return "border-emerald-600 text-emerald-500";
    if (status === "recusada") return "border-[#e73c3e] text-[#e73c3e]";
    return "border-amber-500 text-amber-500";
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "Archivo, sans-serif" }}>
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#e73c3e]">
          Portal do Aluno
        </p>
        <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">
          Sugestões de Melhorias
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie ideias para treinos, agenda, app, estrutura ou atendimento.
        </p>
      </header>

      <section className="border border-[#4A4B4B] bg-card p-4 space-y-4 rounded-none">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Nova sugestão
        </h2>

        <div className="space-y-1.5">
          <label htmlFor="sugestao-categoria" className="block text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Categoria
          </label>
          <select
            id="sugestao-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as SugestaoCategoria)}
            className="w-full h-11 rounded-none border border-[#4A4B4B] bg-background px-3 text-sm text-foreground focus:outline-none focus:border-[#e73c3e]"
          >
            {SUGESTAO_CATEGORIAS.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sugestao-titulo" className="block text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Título
          </label>
          <input
            id="sugestao-titulo"
            type="text"
            maxLength={120}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Resumo curto da sua ideia"
            className="w-full h-11 rounded-none border border-[#4A4B4B] bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e73c3e]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="sugestao-descricao" className="block text-xs font-bold uppercase tracking-[0.08em] text-foreground">
            Descrição
          </label>
          <textarea
            id="sugestao-descricao"
            rows={4}
            maxLength={2000}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Conte o que podemos melhorar e como isso ajuda no seu dia a dia."
            className="w-full rounded-none border border-[#4A4B4B] bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e73c3e]"
          />
        </div>

        <button
          type="button"
          disabled={enviarMutation.isPending}
          onClick={() => enviarMutation.mutate()}
          className="w-full h-11 rounded-none bg-[#e73c3e] text-white text-xs font-black uppercase tracking-[0.1em] hover:opacity-90 disabled:opacity-50"
        >
          {enviarMutation.isPending ? "Enviando..." : "Enviar sugestão"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Minhas sugestões
        </h2>

        {isLoading ? (
          <div className="border border-[#4A4B4B] bg-card p-4 text-sm text-muted-foreground rounded-none">
            Carregando...
          </div>
        ) : sugestoes.length === 0 ? (
          <div className="border border-[#4A4B4B] bg-card p-4 text-sm text-muted-foreground rounded-none">
            Você ainda não enviou nenhuma sugestão.
          </div>
        ) : (
          <div className="space-y-3">
            {sugestoes.map((item) => (
              <article key={item.id} className="border border-[#4A4B4B] bg-card p-4 space-y-2.5 rounded-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {labelCategoriaSugestao(item.categoria)} · {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <span className={`border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded-none ${statusBadgeClass(item.status)}`}>
                    {labelStatusSugestao(item.status)}
                  </span>
                </div>

                <h3 className="text-base font-black uppercase text-foreground">{item.titulo}</h3>
                <p className="text-sm text-foreground/90 whitespace-pre-line">{item.descricao}</p>

                {item.resposta && (
                  <div className="border-t border-[#4A4B4B] pt-2.5 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Resposta da equipe
                      {item.respondido_em ? ` · ${format(new Date(item.respondido_em), "dd/MM/yyyy", { locale: ptBR })}` : ""}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-line">{item.resposta}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}