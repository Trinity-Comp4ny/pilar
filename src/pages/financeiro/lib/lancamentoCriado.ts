import { analytics } from "@/lib/analytics";
import { perguntarEsforco } from "@/components/pesquisas/perguntarEsforco";
import type { TipoLancamento } from "../hooks/useLancamentosUnified";

/** Lançamento criado: evento de produto e, por amostra, a pergunta "Foi fácil?" (SPEC 156). */
export function registrarLancamentoCriado(tipo: TipoLancamento, parcelas: number, rateio: boolean): void {
  analytics.track("lancamento_criado", { tipo, parcelas, rateio });
  void perguntarEsforco("lancamento");
}
