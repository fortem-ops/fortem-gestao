import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, CheckCircle2, AlertTriangle, Clock, Users } from "lucide-react";
import { KpiCard } from "@/components/relatorios/KpiCard";

/** Protocolos do tipo "relatorioforca" (Relatórios Técnicos). */
const PROTOCOLO_FORCA = "4b6b7a67-6b4b-424d-baf0-905d6548ffd7";
const PROTOCOLO_CORRIDA = "15007760-bc0c-4ff2-a48c-7d731f23b634";

type Categoria = "forca" | "corrida";
type Situacao = "entregue" | "pendente" | "atraso";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  forca: "Treinos de Força",
  corrida: "Treinos de Corrida",
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Data prevista do ciclo atual (offset 0) ou de ciclos anteriores (1, 2...). */
function cicloPrevisto(categoria: Categoria, offset: number): string {
  const hoje = new Date();
  const ciclos: Date[] = [];
  for (let i = 0; i <= offset + 2; i++) {
    const base = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    if (categoria === "corrida") ciclos.push(new Date(base.getFullYear(), base.getMonth(), 15));
    ciclos.push(base);
  }
  const passados = ciclos.filter((d) => d <= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  passados.sort((a, b) => b.getTime() - a.getTime());
  return iso(passados[Math.min(offset, passados.length - 1)]);
}

function fmtData(s: string | null | undefined) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function diasDesde(s: string | null | undefined) {
  if (!s) return null;
  const ms = Date.now() - new Date(s + "T00:00:00").getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

interface Linha {
  alunoId: string;
  aluno: string;
  categoria: Categoria;
  responsavelId: string | null;
  responsavel: string;
  previsto: string;
  situacao: Situacao;
  ultimo: string | null;
  ultimoPor: string;
  dias: number | null;
}

export default function RelatoriosTecnicos() {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [profFiltro, setProfFiltro] = useState("todos");
  const [catFiltro, setCatFiltro] = useState<"todas" | Categoria>("todas");
  const [sitFiltro, setSitFiltro] = useState<"todas" | Situacao>("todas");
  const [cicloOffset, setCicloOffset] = useState(0);
  const [ordem, setOrdem] = useState<"atraso" | "nome">("atraso");

  const { data: isCoordAdmin, isLoading: checking } = useQuery({
    queryKey: ["relatorios-tecnicos-access", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("is_coordinator_or_admin", { _user_id: user!.id });
      return !!data;
    },
    enabled: !!user,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios-tecnicos-dados"],
    enabled: !!isCoordAdmin,
    queryFn: async () => {
      const [alunosRes, planosRes, avalRes, profsRes] = await Promise.all([
        supabase.from("alunos").select("id, nome, responsavel_id").eq("status", "ativo").order("nome"),
        supabase.from("planos").select("aluno_id").eq("ativo", true).eq("atividade", "corrida"),
        supabase
          .from("avaliacoes")
          .select("aluno_id, data, protocolo_id, avaliador_id, dados")
          .eq("tipo", "relatorioforca")
          .order("data", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name"),
      ]);
      if (alunosRes.error) throw alunosRes.error;
      return {
        alunos: alunosRes.data ?? [],
        corrida: new Set((planosRes.data ?? []).map((p: any) => p.aluno_id as string)),
        avaliacoes: (avalRes.data ?? []).filter(
          (a: any) => (a.dados as any)?.status === "finalizado",
        ),
        profiles: profsRes.data ?? [],
      };
    },
  });

  const yasmimId = useMemo(() => {
    const p = (data?.profiles ?? []).find((x: any) => (x.full_name ?? "").toLowerCase().startsWith("yasmim"));
    return (p as any)?.user_id ?? null;
  }, [data]);

  const nomeProf = useMemo(() => {
    const map = new Map<string, string>();
    (data?.profiles ?? []).forEach((p: any) => map.set(p.user_id, p.full_name ?? "—"));
    return map;
  }, [data]);

  const linhas: Linha[] = useMemo(() => {
    if (!data) return [];
    const out: Linha[] = [];

    const porAlunoProtocolo = new Map<string, any[]>();
    data.avaliacoes.forEach((a: any) => {
      const k = `${a.aluno_id}|${a.protocolo_id}`;
      const arr = porAlunoProtocolo.get(k) ?? [];
      arr.push(a);
      porAlunoProtocolo.set(k, arr);
    });

    const hojeIso = iso(new Date());

    const montar = (aluno: any, categoria: Categoria) => {
      const protocolo = categoria === "forca" ? PROTOCOLO_FORCA : PROTOCOLO_CORRIDA;
      const previsto = cicloPrevisto(categoria, cicloOffset);
      const lista = porAlunoProtocolo.get(`${aluno.id}|${protocolo}`) ?? [];
      const doCiclo = lista.find((a) => a.data >= previsto);
      const ultimoReg = lista[0] ?? null;
      const responsavelId =
        categoria === "corrida" ? yasmimId ?? aluno.responsavel_id : aluno.responsavel_id;

      let situacao: Situacao = "entregue";
      if (!doCiclo) situacao = previsto < hojeIso ? "atraso" : "pendente";

      out.push({
        alunoId: aluno.id,
        aluno: aluno.nome,
        categoria,
        responsavelId,
        responsavel: responsavelId ? nomeProf.get(responsavelId) ?? "—" : "Sem responsável",
        previsto,
        situacao,
        ultimo: ultimoReg?.data ?? null,
        ultimoPor: ultimoReg?.avaliador_id ? nomeProf.get(ultimoReg.avaliador_id) ?? "—" : "—",
        dias: diasDesde(ultimoReg?.data),
      });
    };

    data.alunos.forEach((aluno: any) => {
      montar(aluno, "forca");
      if (data.corrida.has(aluno.id)) montar(aluno, "corrida");
    });

    return out;
  }, [data, cicloOffset, nomeProf, yasmimId]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = linhas.filter((l) => {
      if (termo && !l.aluno.toLowerCase().includes(termo)) return false;
      if (profFiltro !== "todos" && l.responsavelId !== profFiltro) return false;
      if (catFiltro !== "todas" && l.categoria !== catFiltro) return false;
      if (sitFiltro !== "todas" && l.situacao !== sitFiltro) return false;
      return true;
    });
    lista.sort((a, b) => {
      if (ordem === "nome") return a.aluno.localeCompare(b.aluno);
      const peso = (s: Situacao) => (s === "atraso" ? 0 : s === "pendente" ? 1 : 2);
      if (peso(a.situacao) !== peso(b.situacao)) return peso(a.situacao) - peso(b.situacao);
      return (b.dias ?? 99999) - (a.dias ?? 99999);
    });
    return lista;
  }, [linhas, busca, profFiltro, catFiltro, sitFiltro, ordem]);

  const kpis = useMemo(() => {
    const total = filtradas.length;
    const entregues = filtradas.filter((l) => l.situacao === "entregue").length;
    const pendentes = filtradas.filter((l) => l.situacao === "pendente").length;
    const atrasos = filtradas.filter((l) => l.situacao === "atraso").length;
    return {
      total,
      entregues,
      pendentes,
      atrasos,
      pct: total ? Math.round((entregues / total) * 100) : 0,
    };
  }, [filtradas]);

  const porProfessor = useMemo(() => {
    const map = new Map<string, { nome: string; entregues: number; atrasos: number; total: number }>();
    filtradas.forEach((l) => {
      const k = l.responsavelId ?? "sem";
      const cur = map.get(k) ?? { nome: l.responsavel, entregues: 0, atrasos: 0, total: 0 };
      cur.total++;
      if (l.situacao === "entregue") cur.entregues++;
      if (l.situacao === "atraso") cur.atrasos++;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.atrasos - a.atrasos || a.nome.localeCompare(b.nome));
  }, [filtradas]);

  const professores = useMemo(() => {
    const map = new Map<string, string>();
    linhas.forEach((l) => {
      if (l.responsavelId) map.set(l.responsavelId, l.responsavel);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [linhas]);

  if (checking) return <Skeleton className="h-64 w-full" />;
  if (!isCoordAdmin) {
    return (
      <Card className="glass-card">
        <CardContent className="p-10 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Acesso restrito à coordenação e administração.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-semibold">Relatórios dos Professores</h2>
        <p className="text-sm text-muted-foreground">
          Força: 1 relatório por mês (dia 1). Corrida: a cada 15 dias (dias 1 e 15).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Relatórios do ciclo" value={kpis.total} icon={ClipboardList} />
        <KpiCard label="Entregues" value={kpis.entregues} icon={CheckCircle2} tone="success" />
        <KpiCard label="Pendentes" value={kpis.pendentes} icon={Clock} tone="warning" />
        <KpiCard label="Em atraso" value={kpis.atrasos} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Conclusão" value={`${kpis.pct}%`} icon={Users} />
      </div>

      <Card className="glass-card">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label className="text-xs">Buscar aluno</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do aluno" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Professor</Label>
            <Select value={profFiltro} onValueChange={setProfFiltro}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {professores.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={catFiltro} onValueChange={(v) => setCatFiltro(v as any)}>
              <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="forca">Treinos de Força</SelectItem>
                <SelectItem value="corrida">Treinos de Corrida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Situação</Label>
            <Select value={sitFiltro} onValueChange={(v) => setSitFiltro(v as any)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="atraso">Em atraso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ciclo</Label>
            <Select value={String(cicloOffset)} onValueChange={(v) => setCicloOffset(Number(v))}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Ciclo atual</SelectItem>
                <SelectItem value="1">Ciclo anterior</SelectItem>
                <SelectItem value="2">2 ciclos atrás</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ordenar</Label>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as any)}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atraso">Atraso primeiro</SelectItem>
                <SelectItem value="nome">Nome do aluno</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Por professor</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
          {porProfessor.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          {porProfessor.map((p) => (
            <div key={p.nome} className="rounded-md border border-border/60 px-3 py-2 text-xs">
              <p className="font-medium">{p.nome}</p>
              <p className="text-muted-foreground">
                {p.entregues}/{p.total} entregues
                {p.atrasos > 0 && <span className="text-destructive"> · {p.atrasos} em atraso</span>}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Previsto</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Último relatório</TableHead>
                    <TableHead>Preenchido por</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                        Nenhum relatório encontrado com estes filtros.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtradas.map((l) => (
                    <TableRow key={`${l.alunoId}-${l.categoria}`}>
                      <TableCell className="font-medium">
                        <Link to={`/alunos/${l.alunoId}?tab=registros`} className="hover:underline">
                          {l.aluno}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{CATEGORIA_LABEL[l.categoria]}</TableCell>
                      <TableCell className="text-sm">{l.responsavel}</TableCell>
                      <TableCell className="text-sm">{fmtData(l.previsto)}</TableCell>
                      <TableCell>
                        {l.situacao === "entregue" && <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">Entregue</Badge>}
                        {l.situacao === "pendente" && <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/15">Pendente</Badge>}
                        {l.situacao === "atraso" && <Badge variant="destructive">Em atraso</Badge>}
                      </TableCell>
                      <TableCell className="text-sm">{fmtData(l.ultimo)}</TableCell>
                      <TableCell className="text-sm">{l.ultimoPor}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{l.dias ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
