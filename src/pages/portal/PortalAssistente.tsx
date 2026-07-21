import { useState, useRef, useEffect } from "react";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Msg { role: "user" | "assistant"; content: string; timestamp: string; }

export default function PortalAssistente() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Olá! Sou o Assistente FORTEM 👋 Estou aqui para responder suas dúvidas sobre treinos, agendamentos, planos, avaliações e muito mais. Como posso ajudar?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [escalado, setEscalado] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading || !student) return;

    const userMsg: Msg = { role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("assistant-chat", {
        body: {
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          aluno_id: student.id,
          conversation_id: conversationId,
        },
      });

      if (error) throw error;

      const assistantMsg: Msg = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (data.conversation_id) setConversationId(data.conversation_id);
      if (data.should_escalate) setEscalado(true);
    } catch (e: any) {
      toast.error("Erro ao enviar mensagem. Tente novamente.");
      setMessages((prev) => prev.filter((m) => m !== userMsg));
      setInput(userMsg.content);
    } finally {
      setLoading(false);
    }
  }

  function toTitleCase(str: string): string {
    return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function abrirWhatsAppComHistorico() {
    const nomeFormatado = toTitleCase(student?.nome ?? "Aluno");
    const primeiroNome = nomeFormatado.split(" ")[0];

    const historicoMsgs = messages
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map((m) => `${m.role === "user" ? `👤 ${primeiroNome}` : "🤖 Assistente"}: ${m.content}`)
      .join("\n\n");

    const texto = encodeURIComponent(
      `Olá! Sou ${nomeFormatado} e estava conversando com o Assistente FORTEM.\n\n` +
        `📋 *Resumo da conversa:*\n\n${historicoMsgs}\n\n` +
        `Preciso de ajuda com mais detalhes. Pode me auxiliar? 😊`
    );

    window.open(`https://wa.me/555135199451?text=${texto}`, "_blank");
  }

  if (!student) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
            Assistente FORTEM
          </p>
          <p className="text-[10px] text-emerald-400 font-semibold">● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <span className="text-[10px]">F</span>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-card border border-border text-foreground rounded-tl-sm"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
            {msg.role === "assistant" &&
              i === messages.length - 1 &&
              !loading &&
              (msg.content.toLowerCase().includes("whatsapp") || msg.content.toLowerCase().includes("equipe")) && (
                <div className="flex justify-start ml-9 mt-1.5">
                  <button
                    onClick={abrirWhatsAppComHistorico}
                    className="text-[11px] text-[#25D366] border border-[#25D366]/30 bg-[#25D366]/5 rounded-full px-3 py-1.5 flex items-center gap-1.5"
                  >
                    💬 Abrir WhatsApp com histórico
                  </button>
                </div>
              )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mr-2 mt-0.5">
              <span className="text-[10px]">F</span>
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {escalado && !loading && (
          <div className="mx-auto max-w-xs">
            <div className="bg-card border border-border rounded-2xl p-4 text-center space-y-3">
              <p className="text-sm font-semibold text-foreground">Conectar com a equipe</p>
              <p className="text-xs text-muted-foreground">Prefere falar diretamente com alguém da FORTEM?</p>
              <button
                onClick={abrirWhatsAppComHistorico}
                className="w-full py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                💬 Abrir WhatsApp
              </button>
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground text-center">Perguntas frequentes</p>
            {[
              "Quantos créditos tenho disponíveis?",
              "Como cancelar um treino agendado?",
              "Quando é minha próxima avaliação?",
              "Como funciona o trancamento do plano?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="w-full text-left bg-card border border-border rounded-xl px-3 py-2.5 text-xs text-foreground hover:border-primary/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Digite sua dúvida..."
            rows={1}
            className="flex-1 bg-card border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
          >
            {loading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Assistente com IA · Para urgências, use o WhatsApp
        </p>
      </div>
    </div>
  );
}
