import { useQuery } from "@tanstack/react-query";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { supabase } from "@/integrations/supabase/client";
import { MembershipCard } from "@/components/clube/MembershipCard";
import { Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PortalCarteirinha() {
  const { student } = useStudentPortal();
  const navigate = useNavigate();

  const { data: membro, isLoading } = useQuery({
    queryKey: ["portal-carteirinha-membro", student?.id],
    enabled: !!student,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clube_fortem_membros")
        .select("*")
        .eq("aluno_id", student!.id)
        .maybeSingle();
      return data;
    },
  });

  if (!student) return null;

  return (
    <div className="min-h-screen pb-20">
      <div className="flex items-center gap-3 px-5 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Clube FORTEM</p>
          <h1 className="text-lg font-black text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
            Minha Carteirinha
          </h1>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !membro ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3">
            <p className="text-2xl">🏷️</p>
            <p className="font-bold text-sm text-foreground" style={{ fontFamily: "Archivo,sans-serif" }}>
              Carteirinha ainda não disponível
            </p>
            <p className="text-xs text-muted-foreground">
              Sua carteirinha será gerada automaticamente após o primeiro treino realizado.
              Fale com a equipe FORTEM se precisar de ajuda.
            </p>
          </div>
        ) : (
          <>
            <MembershipCard
              membro={membro}
              alunoNome={student.nome}
              alunoEmail={student.email}
            />

            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Como usar
              </p>
              <div className="space-y-2.5">
                {[
                  { n: "1", txt: "Abra sua carteirinha e apresente o QR Code ao estabelecimento parceiro" },
                  { n: "2", txt: "O parceiro escaneia o QR para validar seu benefício" },
                  { n: "3", txt: "O QR se renova automaticamente a cada 30 segundos por segurança" },
                  { n: "4", txt: "Toque na carteirinha para virar e ver seus detalhes completos" },
                ].map((item) => (
                  <div key={item.n} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">{item.n}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.txt}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Ver parceiros FORTEM</p>
                <p className="text-xs text-muted-foreground">Onde usar sua carteirinha</p>
              </div>
              <button
                onClick={() => navigate("/portal/clube")}
                className="text-xs font-bold text-primary"
              >
                Ver →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
