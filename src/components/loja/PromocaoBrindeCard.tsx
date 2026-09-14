import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { ProductImageUpload } from "@/components/loja/ProductImageUpload";
import { usePromocaoBrinde, type PromocaoBrinde } from "@/hooks/usePromocaoBrinde";

type FormState = {
  ativo: boolean;
  valor_minimo: string;
  data_fim: string;
  brinde_1_nome: string;
  brinde_1_imagem_url: string;
  brinde_2_nome: string;
  brinde_2_imagem_url: string;
};

const toForm = (c: PromocaoBrinde): FormState => ({
  ativo: !!c.ativo,
  valor_minimo: String(c.valor_minimo ?? ""),
  data_fim: c.data_fim ?? "",
  brinde_1_nome: c.brinde_1_nome ?? "",
  brinde_1_imagem_url: c.brinde_1_imagem_url ?? "",
  brinde_2_nome: c.brinde_2_nome ?? "",
  brinde_2_imagem_url: c.brinde_2_imagem_url ?? "",
});

export function PromocaoBrindeCard() {
  const qc = useQueryClient();
  const { data: config, isLoading } = usePromocaoBrinde();
  const [form, setForm] = useState<FormState | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (config) setForm(toForm(config));
  }, [config]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!config || !form) return;
      const payload = {
        ativo: form.ativo,
        valor_minimo: Number(form.valor_minimo) || 0,
        data_fim: form.data_fim,
        brinde_1_nome: form.brinde_1_nome.trim(),
        brinde_1_imagem_url: form.brinde_1_imagem_url.trim() || null,
        brinde_2_nome: form.brinde_2_nome.trim(),
        brinde_2_imagem_url: form.brinde_2_imagem_url.trim() || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await (supabase as any)
        .from("loja_promocao_brinde")
        .update(payload)
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loja-promocao-brinde"] });
      toast.success("Campanha de brinde atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <Skeleton className="h-64 w-full" />;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <Gift className="h-4 w-4 text-primary" />
          Campanha de brinde
        </p>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => setForm({ ...form, ativo: v })}
          />
          <Label>{form.ativo ? "Ativa" : "Inativa"}</Label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Valor mínimo da compra (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            value={form.valor_minimo}
            onChange={(e) => setForm({ ...form, valor_minimo: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Válida até</Label>
          <Input
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome do brinde 1</Label>
            <Input
              value={form.brinde_1_nome}
              onChange={(e) => setForm({ ...form, brinde_1_nome: e.target.value })}
            />
          </div>
          <ProductImageUpload
            label="Imagem do brinde 1"
            value={form.brinde_1_imagem_url}
            pathPrefix="promocoes/brinde-1"
            fileNamePrefix="brinde-1"
            onChange={(url) => setForm((f) => (f ? { ...f, brinde_1_imagem_url: url } : f))}
            onUploadingChange={setEnviando}
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome do brinde 2</Label>
            <Input
              value={form.brinde_2_nome}
              onChange={(e) => setForm({ ...form, brinde_2_nome: e.target.value })}
            />
          </div>
          <ProductImageUpload
            label="Imagem do brinde 2"
            value={form.brinde_2_imagem_url}
            pathPrefix="promocoes/brinde-2"
            fileNamePrefix="brinde-2"
            onChange={(url) => setForm((f) => (f ? { ...f, brinde_2_imagem_url: url } : f))}
            onUploadingChange={setEnviando}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          disabled={enviando || salvar.isPending || !form.data_fim}
          onClick={() => salvar.mutate()}
        >
          Salvar campanha
        </Button>
      </div>
    </Card>
  );
}
