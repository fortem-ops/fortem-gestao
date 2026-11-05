import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";
import {
  buscarIndicador, isOrigemIndicacao, listarIndicacoes, STATUS_INDICACAO, type IndicadorOpcao,
} from "@/lib/indicacoes";

/** Indicação já registrada para um cadastro (ou null). */
export function useIndicacaoDoIndicado(alunoId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["indicacao-do-indicado", alunoId],
    queryFn: async () => (await listarIndicacoes({ indicado: alunoId! }))[0] ?? null,
    enabled: !!alunoId && enabled,
  });
}

/** Mapa indicado → indicação, para cards e listas da equipe (uma consulta só). */
export function useMapaIndicacoes() {
  return useQuery({
    queryKey: ["indicacoes-mapa"],
    queryFn: async () => {
      const m = new Map<string, { padrinho_id: string; padrinho_nome: string; status: string }>();
      (await listarIndicacoes()).forEach((i) => m.set(i.indicado_id, i));
      return m;
    },
    staleTime: 60_000,
  });
}

/** "Indicado por [nome]" com link para o perfil do indicador. */
export function IndicadoPorTexto({ alunoId, className }: { alunoId: string; className?: string }) {
  const { data: mapa } = useMapaIndicacoes();
  const ind = mapa?.get(alunoId);
  if (!ind) return null;
  return (
    <p className={className ?? "text-[11px] text-muted-foreground"}>
      Indicado por{" "}
      <Link to={`/alunos/${ind.padrinho_id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
        {ind.padrinho_nome}
      </Link>
    </p>
  );
}

/** Busca de indicador por nome, telefone ou código. Reaproveitado na gestão. */
export function BuscaIndicador({ value, onChange, excluirId }: {
  value: IndicadorOpcao | null; onChange: (v: IndicadorOpcao | null) => void; excluirId?: string | null;
}) {
  const [termo, setTermo] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(termo), 300); return () => clearTimeout(t); }, [termo]);
  const { data: resultados = [], isFetching } = useQuery({
    queryKey: ["buscar-indicador", debounced],
    queryFn: () => buscarIndicador(debounced),
    enabled: debounced.trim().length >= 3 && !value,
  });

  if (value) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-foreground">{value.nome}</span>
            <Badge variant="outline" className="text-[10px]">{value.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(null)} aria-label="Trocar indicador">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {!value.ativo && (
          <p className="text-xs text-warning">Ex-aluno: a indicação vale, mas não gera pontos enquanto ele estiver inativo.</p>
        )}
      </div>
    );
  }

  const lista = resultados.filter((r) => r.aluno_id !== excluirId);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar por nome ou telefone (mín. 3 caracteres)" />
        {isFetching && <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {debounced.trim().length >= 3 && !isFetching && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border">
          {lista.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum aluno ou ex-aluno encontrado.</p>
          ) : lista.map((r) => (
            <button key={r.aluno_id} type="button" onClick={() => { onChange(r); setTermo(""); }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50">
              <span>{r.nome}</span>
              <Badge variant="outline" className="text-[10px]">{r.ativo ? "Ativo" : "Inativo"}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  /** Cadastro já existente (edição); null em cadastro novo. */
  alunoId?: string | null;
  origem?: string | null;
  value: IndicadorOpcao | null;
  onChange: (v: IndicadorOpcao | null) => void;
  /** Obrigatório (cadastro novo ou origem trocada agora para Indicação). */
  obrigatorio: boolean;
}

/** Campo "Indicado por", visível só quando a origem é Indicação. */
export function IndicadoPorField({ alunoId, origem, value, onChange, obrigatorio }: Props) {
  const mostrar = isOrigemIndicacao(origem);
  const { data: existente, isLoading } = useIndicacaoDoIndicado(alunoId, mostrar);
  if (!mostrar) return null;
  if (alunoId && isLoading) return null;

  if (existente) {
    return (
      <div className="space-y-1.5">
        <Label>Indicado por</Label>
        <p className="text-sm">
          <Link to={`/alunos/${existente.padrinho_id}`} className="font-medium text-primary hover:underline">{existente.padrinho_nome}</Link>
          <span className="ml-2 text-xs text-muted-foreground">({STATUS_INDICACAO[existente.status] || existente.status})</span>
        </p>
        <p className="text-xs text-muted-foreground">Para trocar o indicador, use Clube Fortem › Indicações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label>Indicado por{obrigatorio ? " *" : ""}</Label>
      <BuscaIndicador value={value} onChange={onChange} excluirId={alunoId} />
      {!obrigatorio && !value && (
        <p className="text-xs text-warning">Registro antigo sem indicador. Preencha se souber quem indicou.</p>
      )}
    </div>
  );
}
