import { createElement, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chaveTelefone, iniciais, rotuloPrevia, textoAgrupado } from "@/lib/whatsappChat";
import { getConversaAberta, somLigado, tocarBeep } from "@/lib/whatsappEstado";
import { useWhatsAppUnread } from "@/hooks/useWhatsAppUnread";

const DURACAO = 8000;

export function useWhatsAppNotifications(enabled: boolean = true) {
  const navigate = useNavigate();
  const navRef = useRef(navigate);
  navRef.current = navigate;
  const vistos = useRef(new Set<string>());
  const grupos = useRef(new Map<string, { qtd: number; at: number }>());
  const alunos = useRef<Record<string, { nome: string; foto: string | null }> | null>(null);
  const naoLidas = useWhatsAppUnread(enabled);

  // Título da aba
  useEffect(() => {
    if (!enabled) return;
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = naoLidas > 0 ? `(${naoLidas}) ${base}` : base;
  }, [naoLidas, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();

    const carregarAlunos = async () => {
      if (alunos.current) return alunos.current;
      const { data } = await supabase.from("alunos").select("nome, telefone, foto_url").not("telefone", "is", null).limit(5000);
      const map: Record<string, { nome: string; foto: string | null }> = {};
      (data ?? []).forEach((a: any) => { const k = chaveTelefone(a.telefone); if (k && !map[k]) map[k] = { nome: a.nome, foto: a.foto_url ?? null }; });
      alunos.current = map;
      return map;
    };

    const channel = supabase
      .channel("whatsapp-notifications-v4")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_mensagens" }, async (payload) => {
        const msg = payload.new as any;
        if (msg.direcao !== "recebida" || vistos.current.has(msg.id)) return;
        vistos.current.add(msg.id);
        const aberta = getConversaAberta() === msg.conversa_id && location.pathname.startsWith("/whatsapp");
        if (aberta && !document.hidden) return;

        const { data: conversa } = await supabase.from("whatsapp_conversas" as never)
          .select("nome_contato, telefone").eq("id", msg.conversa_id).maybeSingle();
        const c = conversa as any;
        const mapa = await carregarAlunos();
        const a = mapa[chaveTelefone(c?.telefone) ?? ""];
        const nome = a?.nome ?? c?.nome_contato ?? c?.telefone ?? "WhatsApp";
        const rotulo = rotuloPrevia(msg.tipo, msg.conteudo);

        const g = grupos.current.get(msg.conversa_id);
        const qtd = g && Date.now() - g.at < DURACAO ? g.qtd + 1 : 1;
        grupos.current.set(msg.conversa_id, { qtd, at: Date.now() });
        const texto = textoAgrupado(qtd, rotulo);
        const abrir = () => navRef.current(`/whatsapp?c=${msg.conversa_id}`);

        if (somLigado()) tocarBeep();

        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          try {
            const n = new Notification(`💬 ${nome}`, { body: texto, tag: msg.conversa_id });
            n.onclick = () => { window.focus(); abrir(); n.close(); };
            setTimeout(() => n.close(), DURACAO);
          } catch { /* ignora */ }
        }

        const avatar = a?.foto
          ? createElement("img", { src: a.foto, alt: "", className: "w-9 h-9 rounded-full object-cover" })
          : createElement("div", { className: "w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold" }, iniciais(nome));
        toast(nome, {
          id: `wa-${msg.conversa_id}`,
          description: texto,
          icon: avatar,
          duration: DURACAO,
          action: { label: "Abrir", onClick: abrir },
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [enabled]);
}
