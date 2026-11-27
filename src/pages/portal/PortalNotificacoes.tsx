import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { Bell, BellOff, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export default function PortalNotificacoes() {
  const { student } = useStudentPortal();
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  const { data: avisosRecentes = [] } = useQuery({
    queryKey: ["portal-avisos-recentes", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_push_log")
        .select("id, gatilho, title, body, url, enviado_em")
        .eq("aluno_id", student!.id)
        .order("enviado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <div className="pt-2">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">Configurações</p>
        <h1 className="text-xl font-black text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>Notificações</h1>
      </div>

      {!isSupported ? (
        (() => {
          const isIOS = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
          const isStandalone =
            typeof window !== "undefined" &&
            (window.matchMedia("(display-mode: standalone)").matches ||
              (window.navigator as any).standalone === true);
          if (isIOS && !isStandalone) {
            return (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <p className="font-bold text-sm text-foreground">Instale o app para ativar</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  No iPhone, as notificações funcionam quando o portal está instalado na tela inicial. Siga os passos:
                </p>
                <ol className="space-y-3">
                  {[
                    "Abra este portal no Safari",
                    "Toque no ícone de compartilhar ↑ na barra inferior",
                    'Toque em "Adicionar à Tela de Início"',
                    "Abra o app pelo ícone criado",
                    "Volte nesta tela e ative as notificações",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            );
          }
          return (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                <p className="font-bold text-sm text-foreground">Não suportado</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Seu navegador não suporta notificações push. Use Chrome no Android ou adicione o portal à tela inicial no iOS 16.4+.
              </p>
            </div>
          );
        })()
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubscribed ? "bg-emerald-500/10" : "bg-muted"}`}>
                {isSubscribed ? <Bell className="w-5 h-5 text-emerald-400" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">Notificações push</p>
                <p className="text-xs text-muted-foreground">
                  {isSubscribed ? "Ativas neste dispositivo" : permission === "denied" ? "Bloqueadas nas configurações do browser" : "Desativadas"}
                </p>
              </div>
            </div>
            {permission !== "denied" && (
              <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={isLoading}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  isSubscribed ? "bg-muted text-foreground" : "bg-primary text-white"
                }`}
              >
                {isLoading ? "..." : isSubscribed ? "Desativar" : "Ativar"}
              </button>
            )}
          </div>

          {permission === "denied" && (
            <div className="bg-warning/10 border border-warning/20 rounded-xl p-3">
              <p className="text-xs text-warning">
                Você bloqueou as notificações. Para ativar, acesse as configurações do seu browser e permita notificações para este site.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">O que você receberá</p>
        {[
          { title: "Confirmação de treino", desc: "Sempre que agendar um treino" },
          { title: "Vaga liberada", desc: "Quando abrir vaga em um horário da sua fila de espera" },
          { title: "Créditos acabando", desc: "Quando restar 2 ou menos créditos" },
          { title: "Hora de reavaliar", desc: "Quando a avaliação funcional estiver pendente" },
          { title: "Renovação do plano", desc: "30 dias antes do vencimento" },
          { title: "Aniversário FORTEM", desc: "Comemorando sua jornada conosco" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3">
                        <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            {isSubscribed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          </div>
        ))}
      </div>

      <section className="bg-[#1A1A1A] border border-[#4A4B4B] p-5 space-y-3" style={{ fontFamily: "Archivo, sans-serif" }}>
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Avisos recentes</p>
        {avisosRecentes.length === 0 ? (
          <p className="text-sm text-[#B1B3B3]">Nenhum aviso registrado ainda.</p>
        ) : (
          <div className="divide-y divide-[#4A4B4B]">
            {avisosRecentes.map((aviso) => {
              const conteudo = (
                <div className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-bold text-foreground">{aviso.title}</p>
                    {aviso.body && <p className="text-xs text-[#B1B3B3]">{aviso.body}</p>}
                    <p className="text-[11px] text-[#B1B3B3]">
                      {format(parseISO(aviso.enviado_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {aviso.url && <ArrowRight className="w-4 h-4 text-[#B1B3B3] shrink-0 mt-1" />}
                </div>
              );
              return aviso.url ? (
                <Link key={aviso.id} to={aviso.url} className="block min-h-[44px]">
                  {conteudo}
                </Link>
              ) : (
                <div key={aviso.id}>{conteudo}</div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
