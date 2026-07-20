import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PartnerScanner } from "@/components/clube/PartnerScanner";
import { PartnerManualValidation } from "@/components/clube/PartnerManualValidation";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { LogOut, QrCode, Search, History, Store } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ParceiroSession {
  parceiro_id: string;
  nome: string;
  categoria: string;
  modo_validacao: string;
}

export default function PartnerPortal() {
  const navigate = useNavigate();
  const [session, setSession] = useState<ParceiroSession | null>(null);
  const [aba, setAba] = useState<"scanner" | "manual" | "historico">("scanner");

  useEffect(() => {
    const raw = sessionStorage.getItem("parceiro_session");
    if (!raw) {
      navigate("/parceiro/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ParceiroSession;
      setSession(parsed);
      if (parsed.modo_validacao === "cpf_manual") setAba("manual");
    } catch {
      navigate("/parceiro/login");
    }
  }, [navigate]);

  const { data: historico = [] } = useQuery({
    queryKey: ["parceiro-historico", session?.parceiro_id],
    enabled: !!session && aba === "historico",
    queryFn: async () => {
      const { data } = await supabase
        .from("uso_beneficios")
        .select("*, alunos(nome), beneficios(titulo)")
        .eq("parceiro_id", session!.parceiro_id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data || [];
    },
  });

  function handleSair() {
    sessionStorage.removeItem("parceiro_session");
    navigate("/parceiro/login");
  }

  if (!session) return null;

  const modoValidacao = session.modo_validacao;

  const tabs = [
    { key: "scanner", label: "Scanner QR", icon: QrCode, show: modoValidacao !== "cpf_manual" },
    { key: "manual", label: "Validar CPF", icon: Search, show: modoValidacao !== "qr_scan" },
    { key: "historico", label: "Histórico", icon: History, show: true },
  ].filter((t) => t.show);

  return (
    <div
      className="min-h-screen bg-[#141414]"
      style={{ fontFamily: "Manrope,sans-serif" }}
    >
      <div className="bg-[#1C1C1C] border-b border-[#2E2E2E] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p
              className="text-sm font-bold text-white"
              style={{ fontFamily: "Archivo,sans-serif" }}
            >
              {session.nome}
            </p>
            <p className="text-[10px] text-[#8A8A8A]">Clube FORTEM · Parceiro</p>
          </div>
        </div>
        <button
          onClick={handleSair}
          className="w-9 h-9 bg-[#2C2C2C] rounded-xl flex items-center justify-center"
          aria-label="Sair"
        >
          <LogOut className="w-4 h-4 text-[#8A8A8A]" />
        </button>
      </div>

      <div className="flex border-b border-[#2E2E2E] bg-[#1C1C1C]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAba(tab.key as any)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors ${
              aba === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-[#555]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 pb-20">
        {aba === "scanner" && (
          <div className="[&_.card]:bg-[#1C1C1C] [&_.card]:border-[#2E2E2E] [&_label]:text-[#8A8A8A] [&_h3]:text-white [&_p]:text-[#8A8A8A]">
            <PartnerScanner parceiroId={session.parceiro_id} />
          </div>
        )}
        {aba === "manual" && (
          <div className="[&_.card]:bg-[#1C1C1C] [&_.card]:border-[#2E2E2E] [&_label]:text-[#8A8A8A] [&_h3]:text-white">
            <PartnerManualValidation parceiroId={session.parceiro_id} />
          </div>
        )}
        {aba === "historico" && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8A8A]">
              Últimas validações
            </p>
            {historico.length === 0 ? (
              <div className="text-center py-12 text-[#555] text-sm">
                Nenhuma validação registrada.
              </div>
            ) : (
              historico.map((u: any) => (
                <div
                  key={u.id}
                  className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-4 flex items-center gap-3"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      u.status_validacao === "valido"
                        ? "bg-emerald-500/10"
                        : "bg-destructive/10"
                    }`}
                  >
                    <span className="text-base">
                      {u.status_validacao === "valido" ? "✓" : "✗"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {u.alunos?.nome ?? "—"}
                    </p>
                    <p className="text-[11px] text-[#8A8A8A]">
                      {u.beneficios?.titulo ?? "—"} ·{" "}
                      {format(new Date(u.created_at), "dd/MM HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.status_validacao === "valido"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {u.status_validacao === "valido" ? "Válido" : "Recusado"}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
