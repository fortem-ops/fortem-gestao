import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { montarParametros, telefoneValidoWhatsapp, type VariavelModelo } from "@/lib/disparos";

type Modelo = {
  id: string; nome: string; meta_nome: string | null; texto: string | null; variaveis: VariavelModelo[];
  botao_tipo: string; botao_texto: string | null; botao_url: string | null;
};
const CAMPO_LABEL: Record<string, string> = {
  primeiro_nome: "Primeiro nome", nome_aluno: "Nome completo", email: "E-mail", telefone: "Telefone",
  link_festa: "Link da festa", prazo_confirmacao: "Prazo de confirmação",
};

export function PreviaWhatsapp({ texto, params, botaoTexto }: { texto: string; params: string[]; botaoTexto?: string | null }) {
  const corpo = texto.replace(/\{\{(\d+)\}\}/g, (m, n) => params[Number(n) - 1] ?? m);
  return (
    <div className="rounded-lg bg-muted p-4">
      <div className="max-w-sm rounded-lg bg-card shadow-sm">
        <p className="whitespace-pre-wrap p-3 text-sm">{corpo || "—"}</p>
        {botaoTexto && (
          <div className="flex items-center justify-center gap-1 border-t p-2 text-sm font-medium text-primary">
            <ExternalLink className="h-4 w-4" />{botaoTexto}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DisparosMensagem({ campanhaId }: { campanhaId: string }) {
  const [modeloId, setModeloId] = useState<string>("");
  const [tel, setTel] = useState("");
  const [nomeTeste, setNomeTeste] = useState("Teste");
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ["msg_modelos_aprovados_whats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("msg_modelos")
        .select("id, nome, meta_nome, texto, variaveis, botao_tipo, botao_texto, botao_url")
        .eq("canal", "whatsapp").eq("status", "aprovado").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Modelo[];
    },
  });
  const { data: camp } = useQuery({
    queryKey: ["msg_campanha", campanhaId],
    queryFn: async () => {
      const { data } = await supabase.from("msg_campanhas").select("modelo_id").eq("id", campanhaId).maybeSingle();
      if (data?.modelo_id) setModeloId(data.modelo_id);
      return data;
    },
  });
  const modelo = modelos.find((m) => m.id === modeloId);

  const escolher = async (id: string) => {
    setModeloId(id);
    const { error } = await supabase.from("msg_campanhas").update({ modelo_id: id } as never).eq("id", campanhaId);
    if (error) toast.error("Não foi possível salvar o modelo no rascunho.");
  };

  const teste = useMutation({
    mutationFn: async () => {
      if (!modelo) throw new Error("Escolha um modelo.");
      if (!telefoneValidoWhatsapp(tel)) throw new Error("Telefone inválido para WhatsApp (inclua o DDD).");
      const { data, error } = await supabase.functions.invoke("disparo-campanha", {
        body: { action: "teste", modelo_id: modelo.id, telefone: tel, nome: nomeTeste },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json()).error ?? msg; } catch { /* mantém */ } }
        throw new Error(msg);
      }
      return data as { ok: boolean; error?: string };
    },
    onSuccess: (d) => setResultado(d.ok ? { ok: true, msg: "Teste enviado. Confira no WhatsApp informado." } : { ok: false, msg: d.error ?? "Falhou" }),
    onError: (e: Error) => setResultado({ ok: false, msg: e.message }),
  });

  if (isLoading || camp === undefined) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (modelos.length === 0) return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      Nenhum modelo de WhatsApp aprovado e ativo. Cadastre e marque como aprovado na aba <strong>Modelos</strong>.
    </p>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Modelo de WhatsApp (aprovado)</Label>
          <Select value={modeloId} onValueChange={escolher}>
            <SelectTrigger><SelectValue placeholder="Escolha o modelo" /></SelectTrigger>
            <SelectContent>{modelos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome} ({m.meta_nome})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {modelo && (
          <>
            <div className="space-y-1 text-sm">
              <Label>Variáveis</Label>
              {(modelo.variaveis ?? []).length === 0 ? <p className="text-muted-foreground">Sem variáveis.</p>
                : [...modelo.variaveis].sort((a, b) => a.pos - b.pos).map((v) => (
                  <p key={v.pos}><span className="font-mono">{`{{${v.pos}}}`}</span> → {v.fonte === "fixo" ? `"${v.valor}"` : CAMPO_LABEL[v.valor] ?? v.valor}</p>
                ))}
              {modelo.botao_tipo === "url_fixa" && <p>Botão: {modelo.botao_texto} → {modelo.botao_url} (fixo na Meta)</p>}
            </div>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Enviar teste</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5"><Label>Telefone</Label><Input value={tel} placeholder="(51) 99999-0000" onChange={(e) => setTel(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Nome para a variável</Label><Input value={nomeTeste} onChange={(e) => setNomeTeste(e.target.value)} /></div>
                </div>
                <Button onClick={() => { setResultado(null); teste.mutate(); }} disabled={teste.isPending}>
                  {teste.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Enviar teste
                </Button>
                {resultado && <p className={`text-sm ${resultado.ok ? "text-primary" : "text-destructive"}`}>{resultado.msg}</p>}
                <p className="text-xs text-muted-foreground">Vai só para o telefone digitado. Máximo de 20 testes por hora.</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      {modelo && (
        <div className="space-y-2">
          <Label>Prévia (exemplo: Maria)</Label>
          <PreviaWhatsapp texto={modelo.texto ?? ""} params={montarParametros(modelo.variaveis ?? [], { nome: "Maria" })}
            botaoTexto={modelo.botao_tipo === "url_fixa" ? modelo.botao_texto : null} />
          <p className="text-xs text-muted-foreground">O texto enviado é o aprovado na Meta; esta prévia é só para conferência.</p>
        </div>
      )}
    </div>
  );
}
