import { Check, Infinity as InfinityIcon, Sparkles, Users } from "lucide-react";
import { APP_URL } from "../config";
import { trackCta } from "../analytics";
import { RevealGroup } from "./motion";
import { INCLUSO_EM_TODOS, PLANOS } from "../lib/planos";

/**
 * Os três planos, no mesmo desenho na home e na /planos.
 *
 * Cada cartão mostra só o que muda entre planos: faixa de projetos, cota de
 * ações de IA e nível de atendimento. A lista de funcionalidades saiu porque
 * ela não existe: todo plano tem a plataforma inteira (ADR 0026), e repetir a
 * mesma lista em três colunas sugeria o contrário.
 */
export function PlanCards({ contexto }: { contexto: string }) {
  return (
    <RevealGroup className="grid md:grid-cols-3 gap-4 items-stretch" stagger={0.1}>
      {PLANOS.map((p) => (
        <RevealGroup.Item key={p.slug} variant="scale" className="h-full">
          <div
            className={`relative flex h-full flex-col rounded-[26px] p-7 md:p-8 ${
              p.destaque
                ? "border-2 border-brand bg-frame shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)]"
                : "border border-paper-border bg-frame"
            }`}
          >
            {p.destaque && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink">
                Mais escolhido
              </span>
            )}

            <p className="text-[18px] font-medium text-ink">{p.nome}</p>
            <p className="mb-6 text-[12.5px] text-ink-muted">{p.publico}</p>

            <p className="mb-1 flex items-baseline gap-1.5">
              <span className="text-[42px] font-medium leading-none tracking-[-0.04em] text-ink tabular-nums">
                R$ {p.preco.toLocaleString("pt-BR")}
              </span>
              <span className="text-[13px] text-ink-muted">/mês</span>
            </p>
            <p className="mb-7 text-[12px] text-ink-muted">A empresa inteira, sem cobrança por usuário</p>

            <a
              href={`${APP_URL}/cadastro`}
              onClick={() => trackCta("testar_gratis", `${contexto}_${p.slug}`)}
              className={`flex h-11 items-center justify-center rounded-full text-[14px] font-medium transition-colors ${
                p.destaque ? "bg-brand text-ink hover:bg-brand/85" : "bg-paper-alt text-ink hover:bg-paper-border/60"
              }`}
            >
              Testar grátis por 14 dias
            </a>

            {/* Só as três réguas que separam um plano do outro. */}
            <ul className="mt-7 flex flex-col gap-3.5 border-t border-paper-border/70 pt-6">
              {[
                { Icone: InfinityIcon, texto: p.projetos },
                { Icone: Sparkles, texto: p.acoesIA },
                { Icone: Users, texto: p.atendimento },
              ].map(({ Icone, texto }) => (
                <li key={texto} className="flex items-start gap-2.5">
                  <Icone className="mt-[2px] h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.9} />
                  <span className="text-[13px] leading-snug text-ink-soft">{texto}</span>
                </li>
              ))}
            </ul>
          </div>
        </RevealGroup.Item>
      ))}
    </RevealGroup>
  );
}

/** Faixa do que vem em qualquer plano: é o argumento, não um detalhe. */
export function IncluidoEmTodos() {
  return (
    <div className="rounded-[26px] border border-paper-border bg-card-brand-soft/50 p-7 md:p-9">
      <p className="mb-5 text-[15px] font-medium text-ink">Em qualquer plano, sem exceção</p>
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {INCLUSO_EM_TODOS.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand">
              <Check className="h-2.5 w-2.5 text-ink" strokeWidth={3.2} />
            </span>
            <span className="text-[13px] leading-snug text-ink-soft">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
