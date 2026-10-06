import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, PartyPopper, Search, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Confirmacao = Tables<"festa_confirmacoes">;

const vinculos: Record<string, string> = {
  aluno_atual: "Aluno atual",
  ex_aluno: "Ex-aluno",
  amigo_fortem: "Amigo(a) da FORTEM",
};

const parseAcompanhantes = (valor: unknown) =>
  Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];

const formatWhatsApp = (valor: string) => {
  const digits = valor.replace(/\D/g, "").replace(/^55/, "");
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function FestaConfirmacoes() {
  const [busca, setBusca] = useState("");
  const [excluir, setExcluir] = useState<Confirmacao | null>(null);
  const queryClient = useQueryClient();

  const { data: confirmacoes = [], isLoading } = useQuery({
    queryKey: ["festa-confirmacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("festa_confirmacoes").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return confirmacoes;
    return confirmacoes.filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, confirmacoes]);

  const totalPessoas = confirmacoes.reduce((total, item) => total + item.total_pessoas, 0);

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("festa_confirmacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setExcluir(null);
      await queryClient.invalidateQueries({ queryKey: ["festa-confirmacoes"] });
      toast.success("Confirmação excluída.");
    },
    onError: () => toast.error("Não foi possível excluir a confirmação."),
  });

  const exportarCsv = () => {
    const cabecalho = ["Nome", "WhatsApp", "E-mail", "Vínculo", "Acompanhantes", "Total de pessoas", "Confirmado em"];
    const linhas = confirmacoes.map((item) => [
      item.nome,
      item.whatsapp,
      item.email ?? "",
      vinculos[item.vinculo] ?? item.vinculo,
      parseAcompanhantes(item.acompanhantes).join("; "),
      item.total_pessoas,
      format(new Date(item.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    ]);
    const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", conteudo], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "confirmacoes-festa-fortem-10-anos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary"><PartyPopper className="h-5 w-5" /><span className="text-sm font-semibold">FORTEM · 10 ANOS</span></div>
          <h1 className="mt-2 text-2xl font-bold">Confirmações da festa</h1>
          <p className="text-sm text-muted-foreground">Presenças recebidas pela página pública.</p>
        </div>
        <Button variant="outline" onClick={exportarCsv} disabled={confirmacoes.length === 0}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Confirmações</p><p className="mt-1 text-3xl font-bold">{confirmacoes.length}</p></Card>
        <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Pessoas confirmadas</p><p className="mt-1 text-3xl font-bold">{totalPessoas}</p></div><Users className="h-6 w-6 text-primary" /></div></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar por nome" placeholder="Buscar por nome..." value={busca} onChange={(event) => setBusca(event.target.value)} className="pl-9" /></div>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Carregando confirmações...</p>
        ) : filtradas.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma confirmação encontrada.</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>WhatsApp</TableHead><TableHead>Vínculo</TableHead><TableHead>Acompanhantes</TableHead><TableHead>Data</TableHead><TableHead className="w-14"><span className="sr-only">Ações</span></TableHead></TableRow></TableHeader>
            <TableBody>{filtradas.map((item) => {
              const acompanhantes = parseAcompanhantes(item.acompanhantes);
              return <TableRow key={item.id}>
                <TableCell className="font-medium">{item.nome}</TableCell>
                <TableCell className="whitespace-nowrap">{formatWhatsApp(item.whatsapp)}</TableCell>
                <TableCell>{vinculos[item.vinculo] ?? item.vinculo}</TableCell>
                <TableCell>{acompanhantes.length ? acompanhantes.join(", ") : "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{format(new Date(item.criado_em), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                <TableCell><Button variant="ghost" size="icon" aria-label={`Excluir confirmação de ${item.nome}`} onClick={() => setExcluir(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!excluir} onOpenChange={(open) => { if (!open) setExcluir(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta confirmação?</AlertDialogTitle><AlertDialogDescription>A confirmação de {excluir?.nome} será removida permanentemente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={excluirMutation.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={excluirMutation.isPending} onClick={() => { if (excluir) excluirMutation.mutate(excluir.id); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
