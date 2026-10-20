import { useQuery } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { queryPlanoPrincipalAtivo } from "@/lib/planoPrincipal";
import { Link } from "react-router-dom";
import { differenceInDays } from "date-fns";
import {
  ChevronRight, CreditCard, Bell, LogOut, FileText,
  UserRound, Shield, QrCode, Sparkles, ShoppingBag, Bot,
} from "lucide-react";

const GRUPOS = [
  {
    titulo: "Plano e pagamentos",
    itens: [
      { to: "/portal/plano", titulo: "Meu plano", descricao: "Créditos, trancar e upgrade", icone: Shield },
      { to: "/portal/pagamentos", titulo: "Pagamentos", descricao: "Próxima cobrança, cartão e histórico", icone: CreditCard },
      { to: "/portal/contratos", titulo: "Contratos", descricao: "Contrato e Anexo I", icone: FileText },
    ],
  },
  {
    titulo: "Conta",
    itens: [
      { to: "/portal/meus-dados", titulo: "Meus dados", descricao: "Nome, telefone, e-mail e CPF", icone: UserRound },
      { to: "/portal/notificacoes", titulo: "Notificações", descricao: "Lembretes de treino e cobranças", icone: Bell },
    ],
  },
  {
    titulo: "Fortem",
    itens: [
      { to: "/portal/carteirinha", titulo: "Carteirinha", descricao: "QR code para check-in", icone: QrCode },
      { to: "/portal/clube", titulo: "Clube Fortem", descricao: "Pontos, níveis e parceiros", icone: Sparkles },
      { to: "/portal/loja", titulo: "Loja", descricao: "Suplementos e produtos", icone: ShoppingBag },
      { to: "/portal/assistente", titulo: "Assistente Fortem", descricao: "Dúvidas sobre treino e plano", icone: Bot },
    ],
  },
];

export default function PortalProfile() {
  const { student } = useStudentPortal();

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

  if (!student) return null;

  const iniciais = student.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  const diasMembro = alunoDesde ? differenceInDays(new Date(), new Date(alunoDesde + "T00:00:00")) : null;
  const anosMembro = diasMembro !== null ? Math.floor(diasMembro / 365) : 0;
  const mesesMembro = diasMembro !== null ? Math.floor((diasMembro % 365) / 30) : 0;
  const tempoMembro = anosMembro > 0
    ? `${anosMembro} ano${anosMembro > 1 ? "s" : ""}${mesesMembro > 0 ? ` e ${mesesMembro} ${mesesMembro > 1 ? "meses" : "mês"}` : ""}`
    : mesesMembro > 0 ? `${mesesMembro} ${mesesMembro > 1 ? "meses" : "mês"}` : `${diasMembro ?? 0} dias`;

  const parcelasPlano = Number(planoAtivo?.parcelas_padrao ?? 0);
  const linhaPlano = planoAtivo
    ? `Plano ${planoAtivo.tipo}${parcelasPlano > 1 ? ` · ${parcelasPlano}x` : ""}`
    : "Sem plano ativo";

  return (
    <div data-portal="true" className="space-y-5 pb-32 animate-fade-in">
      {/* ── CABEÇALHO ── */}
      <header className="pt-1">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]">Sua conta</p>
        <h1 className="font-heading text-[32px] font-black uppercase leading-none text-foreground">Perfil</h1>
      </header>
      {/* ── CARTÃO DE IDENTIDADE ── */}

      <div className="relative bg-card border border-border p-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#E73C3E]"
        />
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 border border-border bg-[#2C2C2C] flex items-center justify-center shrink-0">
            <span className="text-2xl font-black text-foreground" style={{ fontFamily: "Archivo, sans-serif" }}>
              {iniciais}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-lg text-foreground leading-tight" style={{ fontFamily: "Archivo, sans-serif" }}>
              {student.nome}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{linhaPlano}</p>
            {alunoDesde && (
              <p className="text-xs text-muted-foreground mt-0.5">Aluno há {tempoMembro}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── GRUPOS ── */}
      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} className="space-y-2">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[hsl(180,1%,70%)]">
            {grupo.titulo}
          </p>
          <div className="bg-card border border-border divide-y divide-border">
            {grupo.itens.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-4 min-h-16"
              >
                <div className="w-8 h-8 bg-[#2C2C2C] border border-border flex items-center justify-center shrink-0">
                  <item.icone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* ── SAIR ── */}
      <section>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 bg-card border border-border px-4 min-h-16"
        >
          <div className="w-8 h-8 bg-[#2C2C2C] border border-border flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">Sair da conta</p>
        </button>
      </section>
    </div>
  );
}
