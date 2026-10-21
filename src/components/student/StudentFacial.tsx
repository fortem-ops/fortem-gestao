import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useUserRoles } from "@/hooks/useUserRoles";
import { FacialResponsavelLink } from "./FacialResponsavelLink";
import { UserRound } from "lucide-react";
import { TERMO_FACIAL_VERSAO, TERMO_FACIAL_TEXTO } from "@/lib/facialAluno";
import { VERSAO_RESPONSAVEL, TEXTO_RESPONSAVEL } from "../../../supabase/functions/_shared/facial-responsavel-termo";

const VERSAO_TERMO_EQUIPE = "v1-provisoria-equipe";
const TEXTO_TERMO_EQUIPE =
  "TERMO DE CONSENTIMENTO PARA USO DA IMAGEM DO ROSTO (EQUIPE). Eu autorizo a FORTEM a coletar e armazenar uma foto do meu rosto e a gerar dela os dados necessários para o reconhecimento facial na porta do estúdio, com a única finalidade de liberar a minha entrada. A foto e os dados do rosto não são compartilhados com terceiros nem usados para outra finalidade. Os registros de passagem (data e hora) ficam guardados no meu cadastro. Posso pedir a remoção do meu rosto a qualquer momento: o rosto é apagado da porta e a foto é apagada do sistema; o registro deste consentimento e das passagens permanece guardado para fins de comprovação. Este consentimento é válido enquanto eu fizer parte da equipe da FORTEM ou até que eu o revogue. (Texto provisório, a ser revisado por advogado.)";

export function selecionarTermoFacial(contexto: "aluno" | "equipe", precisaResp: boolean) {
  if (contexto === "equipe") return { versao: VERSAO_TERMO_EQUIPE, texto: TEXTO_TERMO_EQUIPE };
  if (precisaResp) return { versao: VERSAO_RESPONSAVEL, texto: TEXTO_RESPONSAVEL };
  return { versao: TERMO_FACIAL_VERSAO, texto: TERMO_FACIAL_TEXTO };
}

const STATUS: Record<string, string> = {
  sem_facial: "Sem facial", pendente: "Aguardando a porta", ativa: "Ativa na porta",
  remocao_pendente: "Removendo", removida: "Removida", erro: "Erro",
};
const RESULTADO: Record<string, string> = {
  presenca_confirmada: "Presença confirmada",
  ja_realizado: "Treino já realizado",
  sem_treino_agendado: "Entrada registrada · sem treino agendado",
  nao_reconhecido: "Não reconhecido",
  aluno_nao_vinculado: "Aluno não vinculado",
};
const ACAO: Record<string, string> = { cadastrar: "Cadastrar", atualizar_face: "Atualizar foto", remover: "Remover" };
const FILA: Record<string, string> = { pendente: "Pendente", processando: "Processando", concluido: "Concluído", erro: "Erro" };

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");

function idade(nasc?: string | null) {
  if (!nasc) return null;
  const n = new Date(nasc + "T00:00:00"); const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

async function reduzir(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Imagem inválida")); i.src = url;
    });
    const esc = Math.min(1, 720 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao reduzir"))), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

const msgErro = (e: unknown) => (e as { message?: string })?.message || "Erro inesperado";

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{children}</p>
);

export function StudentFacial({ student, contexto = "aluno" }: { student: Tables<"alunos">; contexto?: "aluno" | "equipe" }) {
  const equipe = contexto === "equipe";
  const qc = useQueryClient();
  const alunoId = student.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dlg, setDlg] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [autorizou, setAutorizou] = useState(false);
  const [responsavel, setResponsavel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [confirma, setConfirma] = useState<null | "remover" | "revogar">(null);

  const { data: roles } = useUserRoles();
  const [salvandoApp, setSalvandoApp] = useState(false);
  const key = ["facial", alunoId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [cfg, cred, cons, ev, fila] = await Promise.all([
        supabase.from("facial_config").select("modo_checkin, app_aluno_habilitado").eq("id", 1).maybeSingle(),
        supabase.from("credenciais_facial").select("*").eq("aluno_id", alunoId).maybeSingle(),
        supabase.from("facial_consentimentos").select("*").eq("aluno_id", alunoId).order("aceito_em", { ascending: false }),
        supabase.from("facial_eventos").select("id, evento_em, resultado, treino_agendamento_id").eq("aluno_id", alunoId).order("evento_em", { ascending: false }).limit(20),
        supabase.from("facial_fila").select("id, acao, status, created_at, processado_em, ultimo_erro").eq("aluno_id", alunoId).order("created_at", { ascending: false }).limit(10),
      ]);
      for (const r of [cfg, cred, cons, ev, fila]) if (r.error) throw r.error;
      let fotoUrl: string | null = null;
      if (cred.data?.foto_path) {
        const { data: s } = await supabase.storage.from("faciais").createSignedUrl(cred.data.foto_path, 120);
        fotoUrl = s?.signedUrl ?? null;
      }
      return { modo: cfg.data?.modo_checkin, appAluno: !!cfg.data?.app_aluno_habilitado, cred: cred.data, cons: cons.data ?? [], ev: ev.data ?? [], fila: fila.data ?? [], fotoUrl };
    },
    refetchInterval: (q) =>
      (q.state.data as any)?.fila?.some((f: any) => f.status === "pendente" || f.status === "processando") ? 5000 : false,
  });

  const cred = data?.cred;
  const anos = idade(student.data_nascimento);
  const precisaResp = anos === null || anos < 18;
  const { versao: versaoTermo, texto: textoTermo } = selecionarTermoFacial(contexto, precisaResp);
  const consValido = data?.cons.find((c) => c.aceito && !c.revogado_em && (!precisaResp || c.tipo === "responsavel"));
  const consExibir = consValido ?? data?.cons[0];
  const temFacial = !!cred && cred.status !== "sem_facial" && cred.status !== "removida";
  const emAndamento = data?.fila.some((f) => f.status === "pendente" || f.status === "processando");
  const abrir = () => { setArquivo(null); setAutorizou(false); setResponsavel(""); setDlg(true); };

  const enviar = async () => {
    if (!arquivo) return toast.error("Escolha uma foto");
    if (!arquivo.type.startsWith("image/")) return toast.error("O arquivo precisa ser uma imagem");
    if (!consValido && !autorizou) return toast.error("Confirme que a pessoa autorizou o uso do rosto");
    if (!consValido && precisaResp && !responsavel.trim()) return toast.error("Informe o nome do responsável");
    setEnviando(true);
    try {
      const blob = await reduzir(arquivo);
      if (blob.size > 2 * 1024 * 1024) throw new Error("Foto acima de 2 MB mesmo depois de reduzida");
      const path = `${alunoId}/${Date.now()}.jpg`;
      const up = await supabase.storage.from("faciais").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      if (!consValido) {
        const c = await supabase.rpc("fn_facial_registrar_consentimento", {
          p_aluno_id: alunoId, p_tipo: precisaResp ? "responsavel" : "proprio",
          p_versao_termo: versaoTermo, p_texto_termo: textoTermo,
          p_responsavel_nome: precisaResp ? responsavel.trim() : null,
        });
        if (c.error) throw c.error;
      }
      const s = await supabase.rpc("fn_facial_solicitar", {
        p_aluno_id: alunoId, p_acao: temFacial ? "atualizar_face" : "cadastrar", p_foto_path: path,
      });
      if (s.error) throw s.error;
      toast.success("Pedido enviado para a porta");
      setDlg(false);
    } catch (e) { toast.error(msgErro(e)); }
    finally { setEnviando(false); qc.invalidateQueries({ queryKey: key }); }
  };

  const executar = async () => {
    const tipo = confirma; setConfirma(null);
    const r = tipo === "revogar"
      ? await supabase.rpc("fn_facial_revogar", { p_aluno_id: alunoId })
      : await supabase.rpc("fn_facial_solicitar", { p_aluno_id: alunoId, p_acao: "remover" });
    if (r.error) toast.error(msgErro(r.error));
    else toast.success(tipo === "revogar" ? "Consentimento revogado" : "Pedido de remoção enviado");
    qc.invalidateQueries({ queryKey: key });
  };

  const alternarApp = async (v: boolean) => {
    setSalvandoApp(true);
    const r = await supabase.rpc("fn_facial_config_app_aluno", { p_habilitado: v });
    setSalvandoApp(false);
    if (r.error) toast.error(msgErro(r.error));
    else toast.success(v ? "App do aluno liberado" : "App do aluno bloqueado");
    qc.invalidateQueries({ queryKey: ["facial"] });
    qc.invalidateQueries({ queryKey: ["facial-app-aluno-habilitado"] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Carregando…</p>;

  const card = "border border-border bg-card p-5 rounded-none space-y-3";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-stretch">
        {data?.modo === "log" && (
          <div className="flex-1 min-w-[240px] border border-border bg-muted/40 p-3 text-sm rounded-none">
            Modo de observação. As passagens são registradas, mas ainda não confirmam a presença no treino.
          </div>
        )}
        {roles?.isAdmin && (
          <label className="flex items-center gap-3 border border-border p-3 text-sm rounded-none min-h-11">
            <Switch checked={!!data?.appAluno} disabled={salvandoApp} onCheckedChange={alternarApp} />
            App do aluno liberado
          </label>
        )}
      </div>

      {precisaResp && <FacialResponsavelLink alunoId={alunoId} nome={student.nome} autorizacao={consValido?.tipo === "responsavel" ? consValido : null} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <Label>Rosto</Label>
          <div className="flex gap-4 items-start">
            <div className="w-28 h-28 border border-border bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {data?.fotoUrl ? <img src={data.fotoUrl} alt="Foto facial" className="w-full h-full object-cover" />
                : <UserRound className="w-12 h-12 text-muted-foreground" />}
            </div>
            <div className="space-y-2 text-sm">
              <span className="inline-block border border-border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                {STATUS[cred?.status ?? "sem_facial"]}
              </span>
              {cred?.status === "erro" && cred.ultimo_erro && <p className="text-destructive">{cred.ultimo_erro}</p>}
              <p><span className="text-muted-foreground">ID na porta:</span> {cred?.device_user_id ?? "—"}</p>
              <p><span className="text-muted-foreground">Sincronizada em:</span> {fmt(cred?.sincronizado_em)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button className="rounded-none uppercase" onClick={abrir} disabled={emAndamento || (equipe && !student.data_nascimento)}>
              {temFacial ? "Atualizar foto" : "Cadastrar rosto"}
            </Button>
            {temFacial && (
              <Button variant="outline" className="rounded-none uppercase" onClick={() => setConfirma("remover")} disabled={emAndamento}>
                Remover da porta
              </Button>
            )}
          </div>
          {emAndamento && <p className="text-xs text-muted-foreground">Já existe um pedido em andamento.</p>}
          <p className="text-xs text-muted-foreground">Remover da porta apaga o rosto do equipamento; o consentimento e o histórico continuam guardados.</p>
        </div>

        <div className={card}>
          <Label>Consentimento</Label>
          {!consExibir ? <p className="text-sm text-muted-foreground">Nenhum consentimento registrado.</p> : (
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Aceito por:</span> {consExibir.tipo === "responsavel" ? `Responsável · ${consExibir.responsavel_nome ?? ""}` : equipe ? "A própria pessoa" : "Próprio aluno"}</p>
              <p><span className="text-muted-foreground">Origem:</span> {consExibir.origem === "app_aluno" ? "App" : consExibir.origem === "link_responsavel" ? "Link do responsável" : "Equipe"}</p>
              <p><span className="text-muted-foreground">Data:</span> {fmt(consExibir.aceito_em)}</p>
              <p><span className="text-muted-foreground">Versão do termo:</span> {consExibir.versao_termo ?? "—"}</p>
              {consExibir.revogado_em && <p className="text-destructive">Revogado em {fmt(consExibir.revogado_em)}</p>}
            </div>
          )}
          {consValido && (
            <button className="text-sm underline text-muted-foreground hover:text-foreground min-h-11" onClick={() => setConfirma("revogar")}>
              Revogar consentimento
            </button>
          )}
          <p className="text-xs text-muted-foreground">Revogar também remove o rosto da porta e apaga a foto guardada; o registro do consentimento revogado continua.</p>
        </div>

        <div className={card}>
          <Label>Histórico de passagens</Label>
          {!data?.ev.length ? <p className="text-sm text-muted-foreground">Nenhuma passagem registrada.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-muted-foreground"><th className="py-1">Data/hora</th><th>Resultado</th><th>Treino</th></tr></thead>
              <tbody>{data.ev.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-1.5">{fmt(e.evento_em)}</td>
                  <td>{RESULTADO[e.resultado] ?? e.resultado}</td>
                  <td>{e.treino_agendamento_id ? "Vinculado" : "—"}</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>

        <div className={card}>
          <Label>Pedidos para a porta</Label>
          {!data?.fila.length ? <p className="text-sm text-muted-foreground">Nenhum pedido.</p> : (
            <ul className="text-sm divide-y divide-border">
              {data.fila.map((f) => (
                <li key={f.id} className="py-2">
                  <div className="flex justify-between gap-2">
                    <span>{ACAO[f.acao] ?? f.acao} · {FILA[f.status] ?? f.status}</span>
                    <span className="text-muted-foreground">{fmt(f.created_at)}</span>
                  </div>
                  {f.ultimo_erro && <p className="text-destructive text-xs">{f.ultimo_erro}</p>}
                </li>))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="rounded-none">
          <DialogHeader><DialogTitle className="uppercase">{temFacial ? "Atualizar foto" : "Cadastrar rosto"}</DialogTitle></DialogHeader>
          <ul className="text-sm text-muted-foreground list-disc pl-5">
            <li>De frente, com boa luz</li><li>Só uma pessoa na foto</li><li>Sem boné ou óculos escuros</li>
          </ul>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f && !f.type.startsWith("image/")) { toast.error("O arquivo precisa ser uma imagem"); return; }
              setArquivo(f);
            }} />
          <Button variant="outline" className="rounded-none" onClick={() => fileRef.current?.click()}>
            {arquivo ? arquivo.name : "Escolher foto"}
          </Button>
          {!consValido && (
            <div className="space-y-3 border border-border p-3">
              <p tabIndex={0} aria-label="Termo completo" className="text-xs text-muted-foreground max-h-40 overflow-y-auto">{textoTermo}</p>
              <label className="flex items-center gap-2 text-sm min-h-11">
                <Checkbox checked={autorizou} onCheckedChange={(v) => setAutorizou(!!v)} />
                {precisaResp ? "O responsável presente no balcão autorizou o uso do rosto" : "A pessoa autorizou o uso do rosto"}
              </label>
              {precisaResp && (
                <div className="space-y-1">
                  <Label>Nome do responsável {anos === null ? "(sem data de nascimento)" : "(menor de 18 anos)"}</Label>
                  <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="rounded-none" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setDlg(false)}>Cancelar</Button>
            <Button className="rounded-none uppercase" onClick={enviar} disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirma} onOpenChange={(o) => !o && setConfirma(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirma === "revogar" ? "Revogar consentimento?" : "Remover da porta?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirma === "revogar"
                ? "Revogar também remove o rosto da porta e apaga a foto guardada; o registro do consentimento revogado continua."
                : "Remover da porta apaga o rosto do equipamento; o consentimento e o histórico continuam guardados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-none" onClick={executar}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
