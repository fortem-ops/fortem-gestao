import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellOff, CheckCircle2, AlertCircle } from "lucide-react";

export default function PortalNotificacoes() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      <div className="pt-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Configurações</p>
        <h1 className="text-xl font-black text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>Notificações</h1>
      </div>

      {!isSupported ? (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            <p className="font-bold text-sm text-foreground">Não suportado</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Seu navegador não suporta notificações push. Use Chrome no Android ou adicione o portal à tela inicial no iOS 16.4+.
          </p>
        </div>
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">O que você receberá</p>
        {[
          { emoji: "🏋️", title: "Confirmação de treino", desc: "Sempre que agendar um treino" },
          { emoji: "⚠️", title: "Créditos acabando", desc: "Quando restar 2 ou menos créditos" },
          { emoji: "📊", title: "Hora de reavaliar", desc: "Quando a avaliação funcional estiver pendente" },
          { emoji: "📅", title: "Renovação do plano", desc: "30 dias antes do vencimento" },
          { emoji: "🎉", title: "Aniversário FORTEM", desc: "Comemorando sua jornada conosco" },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="text-lg shrink-0">{item.emoji}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            {isSubscribed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}
