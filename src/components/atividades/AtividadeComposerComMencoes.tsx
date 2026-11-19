import type { ComponentProps } from "react";
import { AtividadeComposer as ComposerCompartilhado } from "@/components/atividades/AtividadeComposer";
import { usePessoasSemConta } from "@/hooks/usePessoasSemConta";

/** O módulo de projetos fornece a elegibilidade de menções ao compositor compartilhado. */
export function AtividadeComposer(props: ComponentProps<typeof ComposerCompartilhado>) {
  const pessoasSemConta = usePessoasSemConta();
  return <ComposerCompartilhado {...props} pessoasSemConta={pessoasSemConta} />;
}
