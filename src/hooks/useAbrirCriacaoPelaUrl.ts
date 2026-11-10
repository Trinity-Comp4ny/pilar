import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/** Param de URL que pede para a página abrir o formulário de criação (ex.: `?new=1`). */
export const PARAM_CRIACAO = "new";

/**
 * Abre o formulário de criação da página quando a URL traz `?new=<valor>`
 * (atalhos "Criar" da busca rápida, ⌘K) e tira o param da URL com `replace`,
 * para voltar ou recarregar não reabrir o formulário.
 *
 * Vale tanto chegando na página quanto já estando nela: a paleta navega para
 * a mesma rota com o param novo, o que muda os search params e dispara o efeito.
 *
 * Sem permissão de criar, não abre (mesma regra do botão "Novo …"), mas limpa o param.
 * O `valor` vai para `abrir` (ex.: Financeiro usa `new=receita` / `new=despesa`).
 */
export function useAbrirCriacaoPelaUrl(permitido: boolean, abrir: (valor: string) => void) {
  const [searchParams, setSearchParams] = useSearchParams();
  const valor = searchParams.get(PARAM_CRIACAO);

  // `abrir` costuma ser uma função nova a cada render: guardada em ref para não
  // reexecutar o efeito (atualizada antes dele, efeitos rodam em ordem).
  const abrirRef = useRef(abrir);
  useEffect(() => {
    abrirRef.current = abrir;
  });

  useEffect(() => {
    if (!valor) return;
    if (permitido) abrirRef.current(valor);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(PARAM_CRIACAO);
        return next;
      },
      { replace: true }
    );
  }, [valor, permitido, setSearchParams]);
}
