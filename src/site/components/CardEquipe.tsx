import { PlaceholderFoto } from "./PlaceholderFoto";

export interface PessoaEquipe {
  nome: string;
  funcao: string;
  formacao: string;
  registro: string;
  foto?: string;
}

interface Props {
  pessoa: PessoaEquipe;
  /** Cards menores no celular (usado em páginas de campanha). */
  compacto?: boolean;
}

/** Card de profissional da equipe (foto, nome, função, formação e registro). */
export function CardEquipe({ pessoa, compacto = false }: Props) {
  return (
    <>
      <PlaceholderFoto descricao={pessoa.nome} src={pessoa.foto} className="aspect-[3/4]" />
      <p className={`font-bold ${compacto ? "mt-2 text-sm md:mt-3 md:text-base" : "mt-3"}`}>{pessoa.nome}</p>
      <p className={`sp-rotulo mt-1 text-[hsl(var(--sp-vermelho))] ${compacto ? "!text-[10px] md:!text-[11px]" : "!text-[11px]"}`}>
        {pessoa.funcao}
      </p>
      <p className={`text-[hsl(var(--sp-cinza))] ${compacto ? "mt-1 text-[11px] md:mt-2 md:text-xs" : "mt-2 text-xs"}`}>
        {pessoa.formacao}
      </p>
      {pessoa.registro && (
        <p className={`text-[hsl(var(--sp-cinza))] ${compacto ? "mt-1 text-[11px] md:text-xs" : "mt-1 text-xs"}`}>
          {pessoa.registro}
        </p>
      )}
    </>
  );
}
