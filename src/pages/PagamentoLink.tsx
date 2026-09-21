import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import PagamentoStep, {
  type DadosPessoaisPagamento,
  type PedidoCriado,
} from "@/components/corrida/PagamentoStep";

type Estado = "carregando" | "pendente" | "invalido" | "expirado" | "ja_pago";

type Validacao = {
  venda: { id: string; valor_final: number; parcelas: number; nome_snapshot: string | null };
  resumo_linhas: { label: string; valor: number }[];
  pix_disponivel: boolean;
  aluno: { nome: string; email: string; telefone: string };
  pedido: PedidoCriado;
};

const Moldura = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground px-4 py-10">
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">FORTEM</h1>
        <p className="text-sm text-muted-foreground">Pagamento da sua inscrição</p>
      </div>
      {children}
    </div>
  </div>
);

const Aviso = ({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) => (
  <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-3">
    <div className="flex justify-center">{icone}</div>
    <p className="font-display text-lg font-bold">{titulo}</p>
    <p className="text-sm text-muted-foreground">{texto}</p>
  </div>
);

export default function PagamentoLinkCorrida() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [dados, setDados] = useState<Validacao | null>(null);
  const [pedido, setPedido] = useState<PedidoCriado | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!token) {
        setEstado("invalido");
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("corrida-validar-link-pagamento", {
          body: { token },
        });
        if (!ativo) return;
        if (error || !data) {
          setEstado("invalido");
          return;
        }
        if (!data.ok) {
          setEstado(
            data.estado === "expirado" ? "expirado" : data.estado === "ja_pago" ? "ja_pago" : "invalido",
          );
          return;
        }
        setDados(data as Validacao);
        setPedido((data as Validacao).pedido);
        setEstado("pendente");
      } catch {
        if (ativo) setEstado("invalido");
      }
    })();
    return () => {
      ativo = false;
    };
  }, [token]);

  const dadosPessoais = useMemo<DadosPessoaisPagamento>(() => {
    const partes = String(dados?.aluno?.nome ?? "").trim().split(/\s+/);
    return {
      nome: partes[0] ?? "",
      sobrenome: partes.slice(1).join(" "),
      email: dados?.aluno?.email ?? "",
      cpf: "",
      telefone: dados?.aluno?.telefone ?? "",
      data_nascimento: "",
    };
  }, [dados]);

  if (estado === "carregando") {
    return (
      <Moldura>
        <div className="bg-card border border-border rounded-2xl p-10 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Carregando seu pagamento…</span>
        </div>
      </Moldura>
    );
  }

  if (estado === "invalido" || estado === "expirado") {
    return (
      <Moldura>
        <Aviso
          icone={<AlertTriangle className="w-10 h-10 text-amber-400" />}
          titulo={estado === "expirado" ? "Este link expirou" : "Link inválido ou expirado"}
          texto="Entre em contato com a Fortem para receber um novo link de pagamento."
        />
      </Moldura>
    );
  }

  if (estado === "ja_pago") {
    return (
      <Moldura>
        <Aviso
          icone={<CheckCircle2 className="w-12 h-12 text-primary" />}
          titulo="Pagamento já concluído"
          texto="Esta inscrição já está paga. Você não precisa pagar novamente."
        />
      </Moldura>
    );
  }

  if (!dados || !pedido) return null;

  return (
    <Moldura>
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="font-display text-lg font-bold mb-3">{dados.venda.nome_snapshot ?? "Sua inscrição"}</p>
        <ul className="text-sm divide-y divide-border">
          {dados.resumo_linhas.map((l, i) => (
            <li key={i} className="py-2 flex justify-between gap-4">
              <span>{l.label}</span>
              <span className="font-semibold whitespace-nowrap">
                {l.valor === 0
                  ? "Grátis"
                  : l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between pt-3 font-semibold">
          <span>Total</span>
          <span>
            {dados.venda.valor_final.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            {dados.venda.parcelas > 1 ? ` em ${dados.venda.parcelas}x` : ""}
          </span>
        </div>
      </div>

      <PagamentoStep
        payloadPedido={{}}
        dadosIniciais={dadosPessoais}
        totalHoje={dados.venda.valor_final}
        resumoLinhas={dados.resumo_linhas}
        onVoltar={() => {}}
        pedido={pedido}
        setPedido={setPedido}
        modoLink={{ pixDisponivel: dados.pix_disponivel }}
      />
    </Moldura>
  );
}
