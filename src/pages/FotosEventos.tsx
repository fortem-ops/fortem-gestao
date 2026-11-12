import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { colecaoDe, slugDe, slugValido } from "@/lib/fotosEventos";
import type { EventoFotos } from "@/components/fotosEventos/api";
import { fotosAdmin } from "@/components/fotosEventos/api";
import UploadLote from "@/components/fotosEventos/UploadLote";
import PainelEvento from "@/components/fotosEventos/PainelEvento";
import Moderacao from "@/components/fotosEventos/Moderacao";

type Form = { id?: string; nome: string; slug: string; data: string; texto_assinatura: string; local: string; retencao_dias: number; ativo: boolean };
const vazio = (): Form => ({ nome: "", slug: "", data: "", texto_assinatura: "", local: "", retencao_dias: 90, ativo: true });

export default function FotosEventos() {
  const { data: roles, isLoading: carregando } = useUserRoles();
  const qc = useQueryClient();
  const gerir = !!roles?.isCoordAdmin;
  const moderar = gerir || !!roles?.isModeradorFotos;
  const [form, setForm] = useState<Form | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  const { data: eventos = [] } = useQuery({
    queryKey: ["eventos-fotos"], enabled: moderar,
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos_fotos").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data as EventoFotos[];
    },
  });
  const sel = eventos.find((e) => e.id === selId) ?? eventos[0];

  async function salvar() {
    if (!form) return;
    if (form.nome.trim().length < 2 || !slugValido(form.slug) || !form.data) { toast.error("Preencha nome, endereço (letras minúsculas, números e hífen) e data."); return; }
    const campos = { nome: form.nome.trim(), data: form.data, texto_assinatura: form.texto_assinatura.trim(), local: form.local.trim(), retencao_dias: form.retencao_dias, ativo: form.ativo };
    const r = form.id
      ? await supabase.from("eventos_fotos").update(campos).eq("id", form.id).select("id").single()
      : await supabase.from("eventos_fotos").insert({ ...campos, slug: form.slug, collection_id: colecaoDe(form.slug) }).select("id").single();
    if (r.error) { toast.error(r.error.message.includes("duplicate") ? "Já existe um evento com esse endereço." : r.error.message); return; }
    if (!form.id) { try { await fotosAdmin("criar_colecao", { evento_id: r.data.id }); } catch (e) { toast.warning(`Evento salvo, mas a coleção de rostos não foi criada (${e instanceof Error ? e.message : "erro"}). Ela será criada na primeira indexação.`); } }
    toast.success("Evento salvo."); setForm(null); setSelId(r.data.id);
    qc.invalidateQueries({ queryKey: ["eventos-fotos"] });
  }

  if (carregando) return null;
  if (!moderar) return <div className="p-6 text-muted-foreground">Sem permissão para esta tela.</div>;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Camera className="h-6 w-6" />Fotos de Eventos</h1>
        {gerir && <Button onClick={() => setForm(vazio())}><Plus className="h-4 w-4 mr-2" />Novo evento</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {eventos.map((e) => (
          <Button key={e.id} variant={sel?.id === e.id ? "default" : "outline"} size="sm" onClick={() => setSelId(e.id)}>
            {e.nome}{!e.ativo ? " (inativo)" : ""}
          </Button>
        ))}
        {!eventos.length && <p className="text-muted-foreground">Nenhum evento cadastrado.</p>}
      </div>

      {sel && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <p className="font-semibold">{sel.nome}</p>
            <p className="text-muted-foreground">/{sel.slug} · {sel.data.split("-").reverse().join("/")} · {sel.texto_assinatura || "sem assinatura"} · {sel.local || "sem local"} · guarda por {sel.retencao_dias} dias</p>
          </div>
          {gerir && <Button variant="outline" size="sm" onClick={() => setForm({ id: sel.id, nome: sel.nome, slug: sel.slug, data: sel.data, texto_assinatura: sel.texto_assinatura, local: sel.local, retencao_dias: sel.retencao_dias, ativo: sel.ativo })}><Pencil className="h-4 w-4 mr-2" />Editar</Button>}
        </Card>
      )}

      {sel && (
        <Tabs defaultValue={gerir ? "painel" : "moderacao"} key={sel.id}>
          <TabsList>
            {gerir && <TabsTrigger value="painel">Painel</TabsTrigger>}
            {gerir && <TabsTrigger value="upload">Enviar fotos</TabsTrigger>}
            <TabsTrigger value="moderacao">Moderação</TabsTrigger>
          </TabsList>
          {gerir && <TabsContent value="painel"><PainelEvento evento={sel} /></TabsContent>}
          {gerir && <TabsContent value="upload"><UploadLote eventoId={sel.id} /></TabsContent>}
          <TabsContent value="moderacao"><Moderacao eventoId={sel.id} podeGerir={gerir} /></TabsContent>
        </Tabs>
      )}

      <Dialog open={!!form} onOpenChange={(o) => { if (!o) setForm(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value, slug: form.id ? form.slug : slugDe(e.target.value) })} /></div>
              <div><Label>Endereço</Label><Input value={form.slug} disabled={!!form.id} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
                <p className="text-xs text-muted-foreground mt-1">Não muda depois de criado.</p></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div><Label>Texto da assinatura</Label><Input placeholder="10 ANOS · 14.11.2026" value={form.texto_assinatura} onChange={(e) => setForm({ ...form, texto_assinatura: e.target.value })} /></div>
              <div><Label>Local</Label><Input placeholder="PORTO ALEGRE" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
              <div><Label>Guardar fotos por (dias)</Label><Input type="number" min={1} max={3650} value={form.retencao_dias} onChange={(e) => setForm({ ...form, retencao_dias: Math.max(1, Math.min(3650, Number(e.target.value) || 90)) })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />Evento ativo (aparece ao público)</label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={() => void salvar()}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
