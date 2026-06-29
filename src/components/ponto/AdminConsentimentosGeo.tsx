import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Search } from "lucide-react";
import { useTermoVigente } from "@/hooks/useTermoVigente";

interface Profissional {
  user_id: string;
  full_name: string;
}

interface Props {
  profissionais: Profissional[];
}

type StatusFiltro = "todos" | "aceito" | "recusado" | "pendente" | "desatualizado";

export function AdminConsentimentosGeo({ profissionais }: Props) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [verTexto, setVerTexto] = useState<{ nome: string; texto: string; versao: string } | null>(
    null,
  );
  const { termo: termoVigente } = useTermoVigente();

  const { data: consentimentos = [], isLoading } = useQuery({
    queryKey: ["admin-consentimentos-geo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_consentimento_geo")
        .select("usuario_id, aceito, aceito_em, versao_termo, user_agent, texto_termo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const mapa = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of consentimentos) m.set((c as any).usuario_id, c);
    return m;
  }, [consentimentos]);

  const rows = useMemo(() => {
    return profissionais.map((p) => {
      const c = mapa.get(p.user_id);
      const status: StatusFiltro = !c
        ? "pendente"
        : c.aceito
          ? "aceito"
          : "recusado";
      const desatualizado =
        !!c && !!termoVigente && c.versao_termo !== termoVigente.versao;
      return { ...p, c, status, desatualizado };
    });
  }, [profissionais, mapa, termoVigente]);

  const filtradas = rows.filter((r) => {
    if (busca && !r.full_name.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtro === "todos") return true;
    if (filtro === "desatualizado") return r.desatualizado;
    return r.status === filtro;
  });

  const totals = useMemo(() => {
    let aceitos = 0, recusados = 0, pendentes = 0, desatualizados = 0;
    for (const r of rows) {
      if (r.status === "aceito") aceitos++;
      else if (r.status === "recusado") recusados++;
      else pendentes++;
      if (r.desatualizado) desatualizados++;
    }
    return { aceitos, recusados, pendentes, desatualizados, total: rows.length };
  }, [rows]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as StatusFiltro)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aceito">Aceito</SelectItem>
            <SelectItem value="recusado">Recusado</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="desatualizado">Versão desatualizada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profissional</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  Nenhum colaborador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((r) => (
                <TableRow key={r.user_id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell>
                    {r.status === "aceito" && (
                      <Badge className="bg-success/15 text-success border-success/30" variant="outline">
                        Aceito
                      </Badge>
                    )}
                    {r.status === "recusado" && (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">
                        Recusado
                      </Badge>
                    )}
                    {r.status === "pendente" && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pendente
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.c?.versao_termo ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{r.c.versao_termo}</span>
                        {r.desatualizado && (
                          <Badge variant="outline" className="text-warning border-warning/30 bg-warning/10 text-[10px]">
                            Desatualizada
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.c?.aceito_em
                      ? new Date(r.c.aceito_em).toLocaleString("pt-BR")
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                    <span className="truncate block" title={r.c?.user_agent ?? ""}>
                      {r.c?.user_agent ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.c?.texto_termo && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setVerTexto({
                            nome: r.full_name,
                            texto: r.c.texto_termo,
                            versao: r.c.versao_termo,
                          })
                        }
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Ver termo
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground flex flex-wrap gap-3 pt-2 border-t">
        <span><strong className="text-success">{totals.aceitos}</strong> aceitos</span>
        <span><strong className="text-destructive">{totals.recusados}</strong> recusados</span>
        <span><strong>{totals.pendentes}</strong> pendentes</span>
        <span><strong className="text-warning">{totals.desatualizados}</strong> desatualizados</span>
        <span className="ml-auto">de {totals.total} colaboradores</span>
      </div>

      <Dialog open={!!verTexto} onOpenChange={(o) => !o && setVerTexto(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Termo aceito por {verTexto?.nome}</DialogTitle>
            <DialogDescription>Versão {verTexto?.versao}</DialogDescription>
          </DialogHeader>
          <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">
            {verTexto?.texto}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
