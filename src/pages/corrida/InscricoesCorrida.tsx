import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Database } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Flag, Check } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { InscricaoCpfRevealField } from "@/components/corrida/InscricaoCpfRevealField";

type InscricaoBase = Tables<"corrida_inscricoes_prova">;
type VendaStatus = Database["public"]["Enums"]["venda_status"];

type Inscricao = InscricaoBase & {
  vendas?: {
    status_pagamento: VendaStatus;
    valor_final: number;
    created_at: string;
  } | null;
};

const ROTA_LABEL: Record<string, string> = {
  aluno: "Aluno",
  somente_corrida: "Somente Corrida",
  prospect: "Prospect",
  somente_provas: "Somente Provas",
};

const PROVA_LABEL: Record<string, string> = {
  NB: "NB 42k",
  MIPOA: "MIPOA",
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type ProvaPedido = { prova: string; distancia?: string | null };

function parseProvas(raw: unknown): ProvaPedido[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is ProvaPedido => !!p && typeof p === "object");
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value ?? "—"}</p>
    </div>
  );
}

function StatusBadge({
  label,
  state,
  icon,
}: {
  label: string;
  state: "success" | "warning" | "urgent" | "neutral";
  icon?: React.ReactNode;
}) {
  const statusClass =
    state === "success"
      ? "status-active"
      : state === "warning"
      ? "status-warning"
      : state === "urgent"
      ? "status-urgent"
      : "border border-border text-muted-foreground bg-transparent";

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}
    >
      {icon}
      {label}
    </span>
  );
}

function DadosBadge() {
  return <StatusBadge label="Dados" state="success" icon={<Check className="w-3 h-3" />} />;
}

function PagamentoBadge({ inscricao }: { inscricao: Inscricao }) {
  const status = inscricao.vendas?.status_pagamento;

  if (!inscricao.venda_id || !status) {
    return <StatusBadge label="Pagamento pendente" state="warning" />;
  }

  if (status === "pago") {
    return (
      <StatusBadge
        label="Pagamento pago"
        state="success"
        icon={<Check className="w-3 h-3" />}
      />
    );
  }

  if (status === "pendente") {
    return <StatusBadge label="Pagamento pendente" state="warning" />;
  }

  const labelMap: Record<string, string> = {
    falha: "Pagamento recusado",
    cancelado: "Pagamento cancelado",
    estornado: "Pagamento estornado",
  };
  return <StatusBadge label={labelMap[status] ?? `Pagamento ${status}`} state="urgent" />;
}

function InscricaoBadge({ inscricao }: { inscricao: Inscricao }) {
  const provas = parseProvas(inscricao.provas);
  if (provas.length === 0) {
    return <StatusBadge label="Inscrição —" state="neutral" />;
  }

  if (inscricao.inscricao_prova_completa) {
    return (
      <StatusBadge
        label="Inscrição confirmada"
        state="success"
        icon={<Check className="w-3 h-3" />}
      />
    );
  }

  return <StatusBadge label="Inscrição pendente" state="warning" />;
}

function ProgressoSection({ inscricao }: { inscricao: Inscricao }) {
  const venda = inscricao.vendas;
  const provas = parseProvas(inscricao.provas);

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Progresso</h3>
      <div className="rounded-lg border border-border divide-y divide-border">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success text-success-foreground">
              <Check className="w-3 h-3" />
            </span>
            <span className="text-sm font-medium">Dados cadastrais</span>
          </div>
          <span className="text-xs text-muted-foreground">Concluído</span>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {venda?.status_pagamento === "pago" ? (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success text-success-foreground">
                  <Check className="w-3 h-3" />
                </span>
              ) : (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-warning text-warning-foreground text-xs font-bold">!</span>
              )}
              <span className="text-sm font-medium">Pagamento</span>
            </div>
            {venda ? (
              <Badge
                variant={venda.status_pagamento === "pago" ? "default" : venda.status_pagamento === "pendente" ? "secondary" : "destructive"}
              >
                {venda.status_pagamento}
              </Badge>
            ) : (
              <Badge variant="secondary">Pendente</Badge>
            )}
          </div>
          {venda && (
            <div className="grid grid-cols-2 gap-3 pl-7 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="font-medium">{brl(Number(venda.valor_final) || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="font-medium">
                  {format(new Date(venda.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            {provas.length === 0 ? (
              <span className="flex items-center justify-center w-5 h-5 rounded-full border border-border text-muted-foreground text-xs">—</span>
            ) : inscricao.inscricao_prova_completa ? (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success text-success-foreground">
                <Check className="w-3 h-3" />
              </span>
            ) : (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-warning text-warning-foreground text-xs font-bold">!</span>
            )}
            <span className="text-sm font-medium">Inscrição na prova</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {provas.length === 0
              ? "Não aplicável"
              : inscricao.inscricao_prova_completa
              ? "Concluído"
              : "Pendente"}
          </span>
        </div>
      </div>
    </section>
  );
}

export default function InscricoesCorrida() {
  const [busca, setBusca] = useState("");
  const [rota, setRota] = useState<string>("todas");
  const [detalhe, setDetalhe] = useState<Inscricao | null>(null);
  const { data: roles } = useUserRoles();
  const isCoordAdmin = !!roles?.isCoordAdmin;

  const { data: inscricoes = [], isLoading } = useQuery({
    queryKey: ["corrida-inscricoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("corrida_inscricoes_prova")
        .select("*, vendas(status_pagamento, valor_final, created_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Inscricao[];
    },
  });

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return inscricoes.filter((i) => {
      if (rota !== "todas" && i.rota !== rota) return false;
      if (!q) return true;
      return (
        i.nome.toLowerCase().includes(q) ||
        i.sobrenome.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q)
      );
    });
  }, [inscricoes, busca, rota]);

  const linhasPedido = useMemo(() => {
    const pr = detalhe?.pedido_resumo as any;
    return Array.isArray(pr?.linhas) ? pr.linhas : [];
  }, [detalhe]);
  const pedido = detalhe?.pedido_resumo as any;

  const provasDetalhe = parseProvas(detalhe?.provas);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Inscrições Corrida</h1>
          <p className="text-sm text-muted-foreground">
            Inscrições recebidas pela página pública de corrida.
          </p>
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nome, sobrenome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={rota} onValueChange={setRota}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Rota" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as rotas</SelectItem>
            {Object.entries(ROTA_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex items-center text-sm text-muted-foreground">
          {filtradas.length} inscriç{filtradas.length === 1 ? "ão" : "ões"}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome completo</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead>Provas</TableHead>
              <TableHead className="min-w-[200px]">Progresso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtradas.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma inscrição encontrada.</TableCell></TableRow>
            )}
            {filtradas.map((i) => (
              <TableRow key={i.id} className="cursor-pointer" onClick={() => setDetalhe(i)}>
                <TableCell className="whitespace-nowrap">
                  {format(new Date(i.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="font-medium whitespace-nowrap">{i.nome} {i.sobrenome}</TableCell>
                <TableCell className="text-muted-foreground">{i.email}</TableCell>
                <TableCell className="whitespace-nowrap">{i.telefone}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">•••.•••.{i.cpf_ultimos3}</TableCell>
                <TableCell><Badge variant="secondary">{ROTA_LABEL[i.rota] ?? i.rota}</Badge></TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {parseProvas(i.provas).map((p, idx) => (
                      <Badge key={idx} variant="outline" className="whitespace-nowrap">
                        {PROVA_LABEL[p.prova] ?? p.prova}{p.distancia ? ` · ${p.distancia}` : ""}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <DadosBadge />
                    <PagamentoBadge inscricao={i} />
                    <InscricaoBadge inscricao={i} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detalhe && (
            <>
              <SheetHeader>
                <SheetTitle>{detalhe.nome} {detalhe.sobrenome}</SheetTitle>
                <SheetDescription>
                  Inscrição em {format(new Date(detalhe.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados pessoais</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="E-mail" value={detalhe.email} />
                    <Field label="Telefone" value={detalhe.telefone} />
                    <InscricaoCpfRevealField
                      inscricaoId={detalhe.id}
                      cpfUltimos3={detalhe.cpf_ultimos3}
                      isCoordAdmin={isCoordAdmin}
                    />
                    <Field
                      label="Data de nascimento"
                      value={format(new Date(`${detalhe.data_nascimento}T12:00:00`), "dd/MM/yyyy")}
                    />
                    <Field label="Local de nascimento" value={detalhe.local_nascimento} />
                    <Field label="Rota" value={ROTA_LABEL[detalhe.rota] ?? detalhe.rota} />
                    <div className="col-span-2">
                      <Field
                        label="Endereço"
                        value={
                          [
                            detalhe.logradouro,
                            detalhe.numero,
                            detalhe.complemento,
                            detalhe.bairro,
                            detalhe.cidade,
                            detalhe.uf,
                            detalhe.cep,
                          ]
                            .filter(Boolean)
                            .join(" ") || "—"
                        }
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Perfil de corrida</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ritmo de corrida" value={detalhe.ritmo_corrida} />
                    <Field label="Marca de tênis" value={detalhe.marca_tenis} />
                    <div className="col-span-2">
                      <Field label="Como soube" value={detalhe.como_soube} />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Provas</h3>
                  <div className="flex flex-wrap gap-1">
                    {provasDetalhe.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma prova.</p>}
                    {provasDetalhe.map((p, idx) => (
                      <Badge key={idx} variant="outline">
                        {PROVA_LABEL[p.prova] ?? p.prova}{p.distancia ? ` · ${p.distancia}` : ""}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Participou NB 2026"
                      value={detalhe.participou_nb_2026 === null ? "Não aplicável" : detalhe.participou_nb_2026 ? "Sim" : "Não"}
                    />
                    <Field
                      label="Participou MIPOA 2026"
                      value={detalhe.participou_mipoa_2026 === null ? "Não aplicável" : detalhe.participou_mipoa_2026 ? "Sim" : "Não"}
                    />
                    <Field label="Camiseta NB" value={detalhe.camiseta_nb ?? "Não aplicável"} />
                    <Field label="Camiseta MIPOA" value={detalhe.camiseta_mipoa ?? "Não aplicável"} />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Aceites</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Aceite da inscrição"
                      value={detalhe.aceite_inscricao ? "Confirmado" : "Não confirmado"}
                    />
                    <Field
                      label="Termo de aptidão física"
                      value={detalhe.aceite_termo_aptidao === null ? "Não aplicável" : detalhe.aceite_termo_aptidao ? "Confirmado" : "Não confirmado"}
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pedido</h3>
                  {linhasPedido.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem itens registrados.</p>
                  ) : (
                    <div className="rounded-lg border border-border divide-y divide-border">
                      {linhasPedido.map((l: any, idx: number) => (
                        <div key={idx} className="flex items-start justify-between gap-3 p-3">
                          <div>
                            <p className="text-sm font-medium">{l.label}</p>
                            {l.nota && <p className="text-xs text-muted-foreground">{l.nota}</p>}
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">{brl(Number(l.valor) || 0)}</p>
                        </div>
                      ))}
                      <div className="p-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total hoje</span>
                          <span className="font-bold">{brl(Number(pedido?.total_hoje) || 0)}</span>
                        </div>
                        {Number(pedido?.recorrente_mensal) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Recorrente mensal</span>
                            <span className="font-bold">{brl(Number(pedido.recorrente_mensal))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <ProgressoSection inscricao={detalhe} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
