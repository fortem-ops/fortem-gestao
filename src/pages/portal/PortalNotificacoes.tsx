import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PortalPushIncentivo } from "@/components/portal/PortalPushIncentivo";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function PortalNotificacoes() {
  const { student } = useStudentPortal();
  const { isSubscribed } = usePushNotifications();

  const { data: avisosRecentes = [] } = useQuery({
    queryKey: ["portal-avisos-recentes", student?.id],
    enabled: !!student,
    queryFn: async () => {
      if (!student) return [];
      const { data, error } = await supabase
        .from("portal_push_log")
        .select("id, gatilho, title, body, url, enviado_em")
        .eq("aluno_id", student.id)
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

      <PortalPushIncentivo modo="configuracoes" />

      <div className="bg-card border border-border rounded-none p-5 space-y-3">
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
