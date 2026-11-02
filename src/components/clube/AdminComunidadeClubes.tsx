import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Plus, Pencil, Users, Ban, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { MODALIDADES, mensagemErroComunidade } from "@/lib/comunidade";

type Clube = {
  id: string; nome: string; descricao: string | null; tipo: string; modalidade: string; status: string;
  motivo_recusa: string | null; created_at: string; criador: { nome: string } | null;
};

export function useComunidadePendentes() {
  return useQuery({
    queryKey: ["admin-comunidade-pendentes"],
    queryFn: async () => {
      const { count } = await supabase.from("comunidade_clubes" as any).select("id", { count: "exact", head: true }).eq("status", "pendente");
      return count ?? 0;
    },
  });
}

const STATUS_ROTULO: Record<string, string> = { pendente: "Pendente", ativo: "Ativo", recusado: "Recusado", encerrado: "Encerrado" };

export function AdminComunidadeClubes() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<Partial<Clube> | null>(null);
  const [recusando, setRecusando] = useState<Clube | null>(null);
  const [motivo, setMotivo] = useState("");
  const [membrosDe, setMembrosDe] = useState<Clube | null>(null);

  const { data: clubes, isLoading } = useQuery({
    queryKey: ["admin-comunidade-clubes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comunidade_clubes" as any)
        .select("*, criador:alunos!comunidade_clubes_criador_aluno_id_fkey(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Clube[];
    },
  });

  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["admin-comunidade-clubes"] });
    qc.invalidateQueries({ queryKey: ["admin-comunidade-pendentes"] });
    qc.invalidateQueries({ queryKey: ["admin-comunidade-membros"] });
  };

  const moderar = async (c: Clube, acao: "aprovar" | "recusar" | "encerrar", m?: string) => {
    const { error } = await supabase.rpc("fn_comunidade_moderar" as any, { p_clube_id: c.id, p_acao: acao, p_motivo: m ?? null });
    if (error) return toast.error(mensagemErroComunidade(error));
    toast.success(acao === "aprovar" ? "Clube aprovado. O aluno foi avisado." : acao === "recusar" ? "Clube recusado. O aluno foi avisado." : "Clube encerrado.");
    setRecusando(null); setMotivo("");
    recarregar();
  };

  const salvar = async () => {
    if (!editando?.nome?.trim()) return toast.error("Informe o nome.");
    const payload = {
      nome: editando.nome.trim(), descricao: editando.descricao?.trim() || null,
      modalidade: editando.modalidade ?? "todas",
    };
    const q = editando.id
      ? supabase.from("comunidade_clubes" as any).update(payload).eq("id", editando.id)
      : supabase.from("comunidade_clubes" as any).insert({ ...payload, tipo: "oficial", status: "ativo", aprovado_em: new Date().toISOString() });
    const { error } = await q;
    if (error) return toast.error(mensagemErroComunidade(error));
    toast.success("Clube salvo.");
    setEditando(null);
    recarregar();
  };

  const pendentes = (clubes ?? []).filter((c) => c.status === "pendente");
  const demais = (clubes ?? []).filter((c) => c.status !== "pendente");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Clubes da Comunidade</h2>
          <p className="text-sm text-muted-foreground">Ranking por dias de treino no mês. Independente dos pontos do Clube.</p>
        </div>
        <Button onClick={() => setEditando({ modalidade: "todas" })}><Plus className="w-4 h-4 mr-1" /> Clube oficial</Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Fila de análise ({pendentes.length})</h3>
        {isLoading ? <Skeleton className="h-16" /> : pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum clube aguardando análise.</p>
        ) : pendentes.map((c) => (
          <Card key={c.id}><CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold">{c.nome} <span className="text-xs text-muted-foreground">· {c.modalidade}</span></p>
              {c.descricao && <p className="text-sm text-muted-foreground">{c.descricao}</p>}
              <p className="text-xs text-muted-foreground">Criado por {c.criador?.nome ?? "—"} em {format(new Date(c.created_at), "dd/MM/yyyy")}</p>
            </div>
            <Button size="sm" onClick={() => moderar(c, "aprovar")}><Check className="w-4 h-4 mr-1" /> Aprovar</Button>
            <Button size="sm" variant="outline" onClick={() => { setRecusando(c); setMotivo(""); }}><X className="w-4 h-4 mr-1" /> Recusar</Button>
          </CardContent></Card>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Clubes</h3>
        {demais.map((c) => (
          <Card key={c.id}><CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold flex items-center gap-2">
                {c.nome}
                {c.tipo === "oficial" && <Badge variant="outline">Oficial</Badge>}
                <Badge variant={c.status === "ativo" ? "default" : "secondary"}>{STATUS_ROTULO[c.status]}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                Modalidade: {c.modalidade}{c.criador ? ` · Criado por ${c.criador.nome}` : ""}
                {c.status === "recusado" && c.motivo_recusa ? ` · Motivo: ${c.motivo_recusa}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setMembrosDe(c)}><Users className="w-4 h-4 mr-1" /> Membros</Button>
            <Button size="sm" variant="outline" onClick={() => setEditando(c)}><Pencil className="w-4 h-4" /></Button>
            {c.status === "ativo" && (
              <Button size="sm" variant="outline" onClick={() => { if (confirm(`Encerrar o clube ${c.nome}?`)) moderar(c, "encerrar"); }}>
                <Ban className="w-4 h-4 mr-1" /> Encerrar
              </Button>
            )}
          </CardContent></Card>
        ))}
      </section>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editando?.id ? "Editar clube" : "Novo clube oficial"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input maxLength={40} value={editando?.nome ?? ""} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea maxLength={200} value={editando?.descricao ?? ""} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} /></div>
            <div><Label>Modalidade</Label>
              <Select value={editando?.modalidade ?? "todas"} onValueChange={(v) => setEditando({ ...editando, modalidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MODALIDADES.map((m) => <SelectItem key={m.valor} value={m.valor}>{m.rotulo}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!recusando} onOpenChange={(o) => !o && setRecusando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recusar {recusando?.nome}</DialogTitle></DialogHeader>
          <div><Label>Motivo (o aluno verá este texto)</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecusando(null)}>Cancelar</Button>
            <Button disabled={!motivo.trim()} onClick={() => recusando && moderar(recusando, "recusar", motivo.trim())}>Recusar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {membrosDe && <MembrosDialog clube={membrosDe} fechar={() => setMembrosDe(null)} aoMudar={recarregar} />}
    </div>
  );
}

function MembrosDialog({ clube, fechar, aoMudar }: { clube: Clube; fechar: () => void; aoMudar: () => void }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-comunidade-membros", clube.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("comunidade_clube_membros" as any)
        .select("id, papel, entrou_em, alunos(nome)").eq("clube_id", clube.id).is("saiu_em", null).order("entrou_em");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  const remover = async (id: string, nome: string) => {
    if (!confirm(`Remover ${nome} do clube?`)) return;
    const { error } = await supabase.from("comunidade_clube_membros" as any).update({ saiu_em: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error("Não foi possível remover.");
    toast.success("Membro removido.");
    refetch(); aoMudar();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Membros de {clube.nome}</DialogTitle></DialogHeader>
        {isLoading ? <Skeleton className="h-20" /> : !data?.length ? <p className="text-sm text-muted-foreground">Nenhum membro.</p> : (
          <ul className="divide-y">
            {data.map((m) => (
              <li key={m.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 text-sm">{m.alunos?.nome ?? "—"} {m.papel === "anfitriao" && <Badge variant="outline" className="ml-1">Anfitrião</Badge>}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(m.entrou_em), "dd/MM/yy")}</span>
                <Button size="icon" variant="ghost" onClick={() => remover(m.id, m.alunos?.nome ?? "membro")}><Trash2 className="w-4 h-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
