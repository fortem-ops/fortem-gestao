import { useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useStudentPortal } from "@/contexts/StudentPortalContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  TERMO_FACIAL_TEXTO, TERMO_FACIAL_VERSAO, dataPassagem, ehMenor, estadoFacial,
  motivoErroFacial, rotuloPassagem,
} from "@/lib/facialAluno";

const ARCHIVO = { fontFamily: "Archivo, sans-serif" };
const rotulo = "text-[13px] font-bold uppercase tracking-[0.08em] text-[#B1B3B3]";
const btnPrim = "w-full min-h-[48px] bg-[#C8282A] text-[15px] font-bold uppercase tracking-[0.06em] text-white disabled:bg-[#1A1A1A] disabled:text-[#B1B3B3] disabled:border disabled:border-[#4A4B4B]";
const btnSec = "w-full min-h-[48px] border border-[#4A4B4B] bg-transparent text-[15px] font-bold uppercase tracking-[0.06em] text-foreground disabled:opacity-50";
const card = "relative bg-card border border-border p-5 space-y-4";

async function reduzir(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Não foi possível ler a imagem.")); i.src = url;
    });
    const esc = Math.min(1, 720 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Não foi possível preparar a foto."))), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

const Selo = ({ children, tom = "neutro" }: { children: React.ReactNode; tom?: "neutro" | "ok" | "aviso" }) => (
  <span className={`inline-block border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] ${
    tom === "ok" ? "border-[#4CC38A] text-[#4CC38A]" : tom === "aviso" ? "border-[#E3B341] text-[#E3B341]" : "border-[#4A4B4B] text-[#B1B3B3]"}`}>
    {children}
  </span>
);

const Cantoneira = () => (
  <span aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-[#E73C3E]" />
);

export default function PortalFacial() {
  const { student } = useStudentPortal();
  const qc = useQueryClient();
  const alunoId = student?.id;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [fluxo, setFluxo] = useState(false);
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [aceite, setAceite] = useState(false);
  const [termoAberto, setTermoAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [confirmaRemover, setConfirmaRemover] = useState(false);

  const { data: habilitado, isLoading: carregandoTrava } = useQuery({
    queryKey: ["facial-app-aluno-habilitado"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("fn_facial_app_aluno_habilitado");
      if (error) throw error;
      return !!data;
    },
    staleTime: 60_000,
  });

  const key = ["portal-facial", alunoId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    enabled: !!alunoId && habilitado === true,
    queryFn: async () => {
      const [cred, cons, ev] = await Promise.all([
        supabase.from("credenciais_facial").select("status, foto_path, sincronizado_em, created_at, ultimo_erro").eq("aluno_id", alunoId!).maybeSingle(),
        supabase.from("facial_consentimentos").select("id, tipo").eq("aluno_id", alunoId!).eq("aceito", true).is("revogado_em", null),
        supabase.from("facial_eventos").select("id, evento_em, resultado, treino_agendamento_id").eq("aluno_id", alunoId!).order("evento_em", { ascending: false }).limit(10),
      ]);
      for (const r of [cred, cons, ev]) if (r.error) throw r.error;
      const ids = (ev.data ?? []).map((e) => e.treino_agendamento_id).filter(Boolean) as string[];
      const treinos: Record<string, { horario_inicio: string | null; checkin_origem: string | null }> = {};
      if (ids.length) {
        const { data: t } = await supabase.from("treino_agendamentos").select("id, horario_inicio, checkin_origem").in("id", ids);
        for (const x of t ?? []) treinos[x.id] = x;
      }
      let fotoUrl: string | null = null;
      if (cred.data?.foto_path && cred.data.status === "ativa") {
        const { data: s } = await supabase.storage.from("faciais").createSignedUrl(cred.data.foto_path, 120);
        fotoUrl = s?.signedUrl ?? null;
      }
      return { cred: cred.data, temConsentimento: (cons.data ?? []).length > 0, responsavelValido: (cons.data ?? []).some(c => c.tipo === "responsavel"), ev: ev.data ?? [], treinos, fotoUrl };
    },
    refetchInterval: (q) => {
      const s = (q.state.data as { cred?: { status?: string } | null } | undefined)?.cred?.status;
      return s === "pendente" || s === "remocao_pendente" ? 5000 : false;
    },
  });

  if (carregandoTrava) return null;
  if (!habilitado) return <Navigate to="/portal/perfil" replace />;
  if (!student) return null;

  const cred = data?.cred;
  const estado = estadoFacial(cred?.status, student.data_nascimento);
  const menor = ehMenor(student.data_nascimento);
  const precisaTermo = menor ? !data?.responsavelValido : !data?.temConsentimento;

  const abrirFluxo = () => { setFoto(null); setAceite(false); setFluxo(true); };

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Escolha uma imagem."); return; }
    try {
      const blob = await reduzir(f);
      if (blob.size > 2 * 1024 * 1024) { toast.error("A foto ficou maior que 2 MB. Escolha outra."); return; }
      if (foto) URL.revokeObjectURL(foto.url);
      setFoto({ blob, url: URL.createObjectURL(blob) });
    } catch (e) { toast.error((e as Error).message); }
  };

  const enviar = async () => {
    if (!foto || (precisaTermo && !aceite) || !alunoId || (menor && !data?.responsavelValido)) return;
    setEnviando(true);
    try {
      if (precisaTermo) {
        const c = await supabase.rpc("fn_facial_registrar_consentimento", {
          p_aluno_id: alunoId, p_tipo: "proprio", p_versao_termo: TERMO_FACIAL_VERSAO, p_texto_termo: TERMO_FACIAL_TEXTO,
        });
        if (c.error) throw c.error;
      }
      const path = `${alunoId}/${Date.now()}.jpg`;
      const up = await supabase.storage.from("faciais").upload(path, foto.blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const atualizar = !!cred && cred.status !== "removida" && cred.status !== "sem_facial";
      const s = await supabase.rpc("fn_facial_solicitar", {
        p_aluno_id: alunoId, p_acao: atualizar ? "atualizar_face" : "cadastrar", p_foto_path: path,
      });
      if (s.error) throw s.error;
      toast.success("Cadastro enviado para a porta.");
      setFluxo(false);
    } catch (e) {
      const m = (e as { message?: string })?.message ?? "";
      toast.error(m.includes("andamento") ? "Já existe um pedido em andamento. Aguarde alguns minutos." : "Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
      qc.invalidateQueries({ queryKey: key });
    }
  };

  const remover = async () => {
    setConfirmaRemover(false);
    const r = await supabase.rpc("fn_facial_revogar", { p_aluno_id: alunoId! });
    if (r.error) toast.error("Não foi possível remover agora. Tente de novo.");
    else toast.success("Seu rosto será apagado da porta.");
    qc.invalidateQueries({ queryKey: key });
  };

  const voltar = fluxo
    ? <button onClick={() => setFluxo(false)} className="inline-flex items-center gap-1 min-h-11 text-sm text-muted-foreground"><ChevronLeft className="w-4 h-4" /> Voltar</button>
    : <Link to="/portal/perfil" className="inline-flex items-center gap-1 min-h-11 text-sm text-muted-foreground"><ChevronLeft className="w-4 h-4" /> Perfil</Link>;

  return (
    <div data-portal="true" className="space-y-5 pb-32 animate-fade-in">
      <header className="pt-1 space-y-1">
        {voltar}
        <h1 className="font-heading text-[28px] font-black uppercase leading-none text-foreground" style={ARCHIVO}>Reconhecimento facial</h1>
      </header>

      {isLoading || !data ? (
        <div className="h-40 bg-card border border-border animate-pulse" />
      ) : fluxo ? (
        /* ── B. FOTO E TERMO ── */
        <div className="space-y-5">
          <section className={card}>
            <Cantoneira />
            <p className={rotulo}>Passo 1 de {precisaTermo ? 2 : 1} · Sua foto</p>
            <div className="mx-auto w-48 h-60 border-2 border-[#4A4B4B] bg-[#0E0E0E] flex items-center justify-center overflow-hidden">
              {foto ? <img src={foto.url} alt="Prévia da sua foto" className="w-full h-full object-cover" />
                : <UserRound className="w-16 h-16 text-[#4A4B4B]" />}
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Lugar com boa luz</li>
              <li>Olhando para a câmera</li>
              <li>Só você na imagem</li>
              <li>Sem boné ou óculos escuros</li>
            </ul>
            <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden"
              onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={galeriaRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { void escolher(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="grid grid-cols-2 gap-2">
              <button className={btnSec} onClick={() => cameraRef.current?.click()}>Tirar foto</button>
              <button className={btnSec} onClick={() => galeriaRef.current?.click()}>Da galeria</button>
            </div>
          </section>

          {precisaTermo && (
            <section className={card}>
              <p className={rotulo}>Passo 2 de 2 · Consentimento</p>
              <label className="flex items-start gap-3 min-h-11 cursor-pointer">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)}
                  className="mt-0.5 w-6 h-6 shrink-0 accent-[#C8282A]" />
                <span className="text-sm text-foreground">
                  Li e aceito o termo de consentimento para uso da imagem do meu rosto na porta do estúdio.
                </span>
              </label>
              <button className="text-sm underline text-muted-foreground min-h-11" onClick={() => setTermoAberto(true)}>
                Ler o termo completo
              </button>
            </section>
          )}

          <button className={btnPrim} disabled={!foto || (precisaTermo && !aceite) || enviando} onClick={enviar}>
            {enviando ? "Enviando…" : "Enviar cadastro"}
          </button>
        </div>
      ) : estado === "menor" && !data.responsavelValido ? (
        /* ── D. MENOR DE 18 ── */
        <section className={card}>
          <Cantoneira />
          <Selo tom="aviso">Aguardando responsável</Selo>
          <h2 className="text-lg font-black text-foreground" style={ARCHIVO}>Cadastro de menor de 18 anos</h2>
          <p className="text-sm text-muted-foreground">
            Para cadastrar o rosto de quem tem menos de 18 anos, a FORTEM precisa da autorização de um responsável. Procure a recepção para fazer o cadastro.
          </p>
        </section>
      ) : estado === "nao_cadastrado" || (estado === "menor" && data.responsavelValido) ? (
        /* ── A. NÃO CADASTRADO ── */
        <div className="space-y-5">
          <section className={card}>
            <Cantoneira />
            <Selo>{menor ? "Autorizado pelo responsável" : "Não cadastrado"}</Selo>
            <p className="text-sm text-foreground">
              Cadastre seu rosto e entre no estúdio sem cartão e sem abrir o aplicativo. A porta reconhece você e confirma sua presença no treino que já está agendado.
            </p>
            <ol className="divide-y divide-border border border-border">
              {(menor ? ["Envie uma foto sua", "A porta recebe seu cadastro"] : ["Leia e aceite o termo", "Envie uma foto sua", "A porta recebe seu cadastro"]).map((p, i) => (
                <li key={p} className="flex items-center gap-3 px-3 min-h-12">
                  <span className="w-7 h-7 border border-[#4A4B4B] flex items-center justify-center text-xs font-bold text-foreground">{i + 1}</span>
                  <span className="text-sm text-foreground">{p}</span>
                </li>
              ))}
            </ol>
          </section>
          <button className={btnPrim} onClick={abrirFluxo}>Cadastrar meu rosto</button>
          <p className="text-xs text-center text-muted-foreground">Você pode apagar seu rosto a qualquer momento.</p>
        </div>
      ) : (
        /* ── C. AGUARDANDO / ATIVA / ERRO ── */
        <div className="space-y-5">
          <section className={card}>
            <Cantoneira />
            {cred?.status === "erro" ? (
              <>
                <Selo tom="aviso">Erro no cadastro</Selo>
                <h2 className="text-lg font-black text-foreground" style={ARCHIVO}>Não foi possível concluir o cadastro</h2>
                <p className="text-sm text-muted-foreground">{motivoErroFacial(cred.ultimo_erro)}</p>
                {menor ? <p className="text-sm text-muted-foreground">Procure a recepção para cadastrar de novo.</p>
                  : <button className={btnPrim} onClick={abrirFluxo}>Tentar de novo</button>}
              </>
            ) : cred?.status === "ativa" ? (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 border border-border bg-[#0E0E0E] flex items-center justify-center overflow-hidden shrink-0">
                  {data.fotoUrl ? <img src={data.fotoUrl} alt="Sua foto cadastrada" className="w-full h-full object-cover" />
                    : <UserRound className="w-10 h-10 text-[#4A4B4B]" />}
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Selo tom="ok">Ativa</Selo>
                  <p className="text-sm text-foreground">Sua porta reconhece você.</p>
                  <p className="text-xs text-muted-foreground">
                    Cadastrada em {new Date(cred.sincronizado_em ?? cred.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </p>
                </div>
              </div>
            ) : cred?.status === "remocao_pendente" ? (
              <>
                <Selo>Removendo</Selo>
                <p className="text-sm text-muted-foreground">Seu rosto está sendo apagado da porta.</p>
              </>
            ) : (
              <>
                <Selo tom="aviso">Aguardando a porta</Selo>
                <p className="text-sm text-foreground">Em poucos minutos você já pode entrar pelo rosto.</p>
              </>
            )}
          </section>

          <section className="space-y-2">
            <p className={rotulo}>Últimas passagens</p>
            {data.ev.length === 0 ? (
              <p className="bg-card border border-border px-4 py-4 text-sm text-muted-foreground">Nenhuma passagem registrada.</p>
            ) : (
              <ul className="bg-card border border-border divide-y divide-border">
                {data.ev.map((e) => (
                  <li key={e.id} className="px-4 py-3 min-h-12">
                    <p className="text-sm font-semibold text-foreground">{dataPassagem(e.evento_em)}</p>
                    <p className="text-xs text-muted-foreground">
                      {rotuloPassagem(e.resultado, e.treino_agendamento_id ? data.treinos[e.treino_agendamento_id] : null)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-muted-foreground border-l border-[#4A4B4B] pl-3">
            O rosto só serve para abrir a porta e confirmar sua presença. Não é compartilhado.
          </p>

          {cred?.status !== "remocao_pendente" && (
            <div className="space-y-2">
              {!menor && cred?.status === "ativa" && (
                <button className={btnSec} onClick={abrirFluxo}>Trocar minha foto</button>
              )}
              <button className="w-full min-h-11 text-sm underline text-muted-foreground" onClick={() => setConfirmaRemover(true)}>
                Remover meu rosto
              </button>
            </div>
          )}
        </div>
      )}

      <Sheet open={termoAberto} onOpenChange={setTermoAberto}>
        <SheetContent side="bottom" data-portal="true" className="rounded-none max-h-[85vh] overflow-y-auto bg-[#1A1A1A] border-[#4A4B4B]">
          <SheetHeader>
            <SheetTitle className="uppercase text-left" style={ARCHIVO}>Termo de consentimento</SheetTitle>
          </SheetHeader>
          <p className="mt-4 text-sm leading-relaxed text-foreground">{TERMO_FACIAL_TEXTO}</p>
          <p className="mt-3 text-xs text-muted-foreground">Versão {TERMO_FACIAL_VERSAO}</p>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmaRemover} onOpenChange={setConfirmaRemover}>
        <AlertDialogContent data-portal="true" className="rounded-none bg-[#1A1A1A] border-[#4A4B4B]">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase" style={ARCHIVO}>Remover meu rosto</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga seu rosto da porta e a foto guardada. O registro do consentimento continua.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none min-h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="rounded-none min-h-11 bg-[#C8282A] text-white hover:bg-[#C8282A]" onClick={remover}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
