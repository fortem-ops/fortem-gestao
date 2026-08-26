import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { queryPlanoPrincipalAtivo } from "@/lib/planoPrincipal";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import {
  ChevronRight, CreditCard, Bell, Star, Trash2,
  LogOut, Shield, FileText,
} from "lucide-react";


export default function PortalProfile() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();




  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/portal/login";
  };

  const { data: planoAtivo } = useQuery({
    queryKey: ["portal-plano", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await queryPlanoPrincipalAtivo(student!.id);
      return data;
    },
  });

  const { data: alunoDesde } = useQuery({
    queryKey: ["portal-aluno-desde", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await supabase
        .from("planos").select("data_inicio")
        .eq("aluno_id", student!.id)
        .order("data_inicio", { ascending: true }).limit(1).maybeSingle();
      return data?.data_inicio ?? null;
    },
  });

  const { cartoes, definirPrincipal, removerCartao } = usePortalCartoes(student?.id);


  if (!student) return null;

  const iniciais = student.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const diasMembro = alunoDesde ? differenceInDays(new Date(), new Date(alunoDesde + "T00:00:00")) : null;
  const anosMembro = diasMembro !== null ? Math.floor(diasMembro / 365) : 0;
  const mesesMembro = diasMembro !== null ? Math.floor((diasMembro % 365) / 30) : 0;
  const tempoMembro = anosMembro > 0
    ? `${anosMembro} ano${anosMembro > 1 ? "s" : ""}${mesesMembro > 0 ? ` e ${mesesMembro} mês${mesesMembro > 1 ? "es" : ""}` : ""}`
    : mesesMembro > 0 ? `${mesesMembro} mês${mesesMembro > 1 ? "es" : ""}` : `${diasMembro ?? 0} dias`;

  return (
    <div className="space-y-5 pb-32 animate-fade-in">

      {/* ── CARTÃO DE IDENTIDADE ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-primary" style={{fontFamily:'Archivo,sans-serif'}}>{iniciais}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-lg text-foreground leading-tight" style={{fontFamily:'Archivo,sans-serif'}}>{student.nome}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{student.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Ativo
              </span>
              {planoAtivo && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Plano {planoAtivo.tipo}
                </span>
              )}
            </div>
          </div>
        </div>
        {alunoDesde && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Membro FORTEM</p>
            <p className="text-xs font-semibold text-foreground">{tempoMembro}</p>
          </div>
        )}
      </div>

      {/* ── MINHA CONTA ── */}
      <section className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Minha conta</p>
        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <Link to="/portal/plano" className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Gerenciar Plano</p>
              <p className="text-xs text-muted-foreground">Trancar, cancelar, upgrades</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>

          <Link to="/portal/contratos" className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Meus Contratos</p>
              <p className="text-xs text-muted-foreground">Contrato e Anexo I</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>

          <Link to="/portal/pagamentos" className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Pagamentos</p>
              <p className="text-xs text-muted-foreground">Histórico de cobranças</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>

          <Link to="/portal/notificacoes" className="flex items-center gap-3 px-4 py-3.5">

            <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">Gerencie seus alertas</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        </div>
      </section>





      {/* ── SAIR ── */}
      <section>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5"
        >
          <div className="w-8 h-8 rounded-lg bg-[#2C2C2C] flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-destructive">Sair da conta</p>
        </button>
      </section>

      {/* ── VERSÃO ── */}
      <p className="text-center text-[10px] text-muted-foreground pb-2">FORTEM Portal · v1.0</p>

    </div>
  );
}
