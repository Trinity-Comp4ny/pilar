import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { EscolhaChips } from "@/components/forms/EscolhaChips";
import { EtapasProgress } from "@/components/onboarding/EtapasProgress";
import { cn } from "@/lib/utils";
import {
  APROFUNDAMENTO,
  DORES,
  FERRAMENTAS,
  MAX_DORES,
  PROJETOS_ATIVOS,
  dorPrincipalDe,
  rotuloDaDor,
  type Dor,
  type Ferramenta,
  type ProjetosAtivos,
  type RespostasOnboarding,
} from "@/lib/onboarding/dores";
import { ROTULOS_CADASTRO_DONO } from "@/lib/onboarding/etapasCadastro";
import { PREVIA_DA_DOR } from "@/lib/onboarding/previa";
import { montarPlano, type PlanoOnboarding } from "@/lib/onboarding/plano";
import { PORTES } from "@/lib/perfilEscritorio";

/** Telas do onboarding inteligente (SPEC 165). O número é o que fica gravado em `etapa_atual`. */
const TELA = { boasVindas: 1, dores: 2, aprofundamento: 3, operacao: 4, ferramentas: 5, previa: 6, plano: 7 } as const;
const TOTAL_TELAS = 7;

interface OnboardingWizardProps {
  nome: string;
  empresaNome: string;
  /** `empresas.porte`: já sabido, vira espelho nas perguntas em vez de ser perguntado de novo. */
  porte: string | null;
  respostasIniciais: RespostasOnboarding;
  /** Grava o rascunho a cada tela. Falha aqui não trava a pessoa. */
  onSalvar: (respostas: RespostasOnboarding) => Promise<void> | void;
  /** Última tela: conclui e leva ao app. */
  onConcluir: (respostas: RespostasOnboarding, plano: PlanoOnboarding) => Promise<void> | void;
  /** Rótulo de cada pergunta para telemetria. */
  onResponder?: (pergunta: string, respostas: RespostasOnboarding) => void;
  concluindo?: boolean;
  /** Volta para a etapa anterior do cadastro (o escritório). */
  onVoltarAoCadastro?: () => void;
}

export function OnboardingWizard({
  nome,
  empresaNome,
  porte,
  respostasIniciais,
  onSalvar,
  onConcluir,
  onResponder,
  concluindo = false,
  onVoltarAoCadastro,
}: OnboardingWizardProps) {
  const [respostas, setRespostas] = useState<RespostasOnboarding>(respostasIniciais);
  const [tela, setTela] = useState<number>(() =>
    // Retoma de onde parou, mas nunca reabre a última tela já concluída sem a pessoa querer.
    Math.min(Math.max(respostasIniciais.etapaAtual, 1), TELA.plano)
  );

  const dorPrincipal = dorPrincipalDe(respostas.dores, respostas.dorPrincipal);
  const porteRotulo = PORTES.find((p) => p.value === porte)?.label ?? null;
  const projetosRotulo = PROJETOS_ATIVOS.find((p) => p.value === respostas.contexto.projetosAtivos)?.label ?? null;

  const plano = useMemo(
    () =>
      montarPlano({
        dores: respostas.dores,
        dorPrincipal,
        projetosAtivos: respostas.contexto.projetosAtivos,
        porte,
      }),
    [respostas.dores, dorPrincipal, respostas.contexto.projetosAtivos, porte]
  );

  const atualizar = (parcial: Partial<RespostasOnboarding>) => setRespostas((r) => ({ ...r, ...parcial }));

  const proximaTela = (de: number): number => {
    // Sem dor escolhida não há o que aprofundar.
    if (de === TELA.dores && !dorPrincipal) return TELA.operacao;
    return Math.min(de + 1, TELA.plano);
  };
  const telaAnterior = (de: number): number => {
    if (de === TELA.operacao && !dorPrincipal) return TELA.dores;
    return Math.max(de - 1, TELA.boasVindas);
  };

  const avancar = async (pergunta?: string) => {
    const destino = proximaTela(tela);
    const proximas = { ...respostas, dorPrincipal, etapaAtual: destino };
    setRespostas(proximas);
    if (pergunta) onResponder?.(pergunta, proximas);
    setTela(destino);
    await onSalvar(proximas);
  };

  const voltar = () => {
    if (tela === TELA.boasVindas) {
      onVoltarAoCadastro?.();
      return;
    }
    setTela(telaAnterior(tela));
  };

  const alternarDor = (dor: Dor) => {
    const marcada = respostas.dores.includes(dor);
    if (!marcada && respostas.dores.length >= MAX_DORES) return;
    const dores = marcada ? respostas.dores.filter((d) => d !== dor) : [...respostas.dores, dor];
    const principal = dorPrincipalDe(dores, marcada && respostas.dorPrincipal === dor ? null : respostas.dorPrincipal);
    // Trocar a dor principal invalida o aprofundamento anterior.
    const { aprofundamento: _antigo, ...resto } = respostas.contexto;
    atualizar({
      dores,
      dorPrincipal: principal,
      contexto: principal === respostas.dorPrincipal ? respostas.contexto : resto,
    });
  };

  return (
    <div className="landing-grain flex min-h-dvh w-full flex-col bg-paper">
      <header className="mx-auto w-full max-w-xl space-y-4 px-6 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="mark" size="md" />
            <span className="text-sm font-semibold text-ink">Pilar</span>
          </div>
          <span className="text-xs text-ink-soft">
            Pergunta {tela} de {TOTAL_TELAS}
          </span>
        </div>
        <EtapasProgress etapa={4} rotulos={ROTULOS_CADASTRO_DONO} />
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        {/* `key` remonta a tela e dispara a animação de entrada a cada pergunta. */}
        <section
          key={tela}
          aria-live="polite"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none"
        >
          {tela === TELA.boasVindas && (
            <>
              <Titulo>
                Oi, {nome}. Vamos deixar o {empresaNome} pronto.
              </Titulo>
              <Apoio>
                Algumas perguntas rápidas para montar o seu plano de configuração. Leva uns 2 minutos e você pode pular
                qualquer uma.
              </Apoio>
              <Acoes>
                <Button variant="brand" className="h-11 w-full" onClick={() => void avancar()}>
                  Começar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}

          {tela === TELA.dores && (
            <>
              <Titulo>O que mais pesa no escritório hoje?</Titulo>
              <Apoio>Escolha até {MAX_DORES}. A primeira que você marcar vira a principal.</Apoio>
              <div role="group" aria-label="Dores do escritório" className="grid gap-2">
                {DORES.map((d) => {
                  const posicao = respostas.dores.indexOf(d.value);
                  const marcada = posicao >= 0;
                  const cheia = !marcada && respostas.dores.length >= MAX_DORES;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      aria-pressed={marcada}
                      disabled={cheia}
                      onClick={() => alternarDor(d.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-50",
                        marcada
                          ? "border-ink bg-paper-alt text-ink"
                          : "border-paper-border bg-paper text-ink-soft hover:border-black/20"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          marcada ? "border-transparent bg-brand text-ink" : "border-paper-border"
                        )}
                        aria-hidden
                      >
                        {marcada ? posicao + 1 : ""}
                      </span>
                      <span>{d.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <label htmlFor="onb-texto-livre" className="text-sm font-medium text-ink">
                  Conta com suas palavras <span className="font-normal text-ink-muted">(opcional)</span>
                </label>
                <Textarea
                  id="onb-texto-livre"
                  value={respostas.textoLivre}
                  maxLength={1000}
                  rows={3}
                  placeholder="O que mais te tira o sono na gestão do escritório?"
                  onChange={(e) => atualizar({ textoLivre: e.target.value })}
                  className="bg-paper-alt border-paper-border"
                />
              </div>
              <Acoes>
                <Voltar onClick={voltar} />
                <Button variant="brand" className="h-11 flex-1" onClick={() => void avancar("dores")}>
                  {respostas.dores.length === 0 && !respostas.textoLivre.trim() ? "Pular" : "Continuar"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}

          {tela === TELA.aprofundamento && dorPrincipal && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{rotuloDaDor(dorPrincipal)}</p>
              <Titulo>{APROFUNDAMENTO[dorPrincipal].pergunta}</Titulo>
              <EscolhaChips
                ariaLabel={APROFUNDAMENTO[dorPrincipal].pergunta}
                opcoes={APROFUNDAMENTO[dorPrincipal].opcoes}
                value={
                  respostas.contexto.aprofundamento?.dor === dorPrincipal
                    ? respostas.contexto.aprofundamento.resposta
                    : null
                }
                onChange={(resposta) =>
                  atualizar({ contexto: { ...respostas.contexto, aprofundamento: { dor: dorPrincipal, resposta } } })
                }
              />
              <Acoes>
                <Voltar onClick={voltar} />
                <Button variant="brand" className="h-11 flex-1" onClick={() => void avancar("aprofundamento")}>
                  {respostas.contexto.aprofundamento ? "Continuar" : "Pular"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}

          {tela === TELA.operacao && (
            <>
              <Titulo>
                {porteRotulo
                  ? `Com ${porteRotulo.replace(" pessoas", "")} pessoas, quantos projetos vocês tocam ao mesmo tempo?`
                  : "Quantos projetos vocês tocam ao mesmo tempo?"}
              </Titulo>
              <EscolhaChips
                ariaLabel="Projetos ativos"
                opcoes={PROJETOS_ATIVOS}
                value={respostas.contexto.projetosAtivos ?? null}
                onChange={(v) =>
                  atualizar({ contexto: { ...respostas.contexto, projetosAtivos: v as ProjetosAtivos } })
                }
              />
              <Acoes>
                <Voltar onClick={voltar} />
                <Button variant="brand" className="h-11 flex-1" onClick={() => void avancar("projetos_ativos")}>
                  {respostas.contexto.projetosAtivos ? "Continuar" : "Pular"} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}

          {tela === TELA.ferramentas && (
            <>
              <Titulo>
                {projetosRotulo
                  ? `Com ${projetosRotulo} projetos ativos, o que sustenta isso hoje?`
                  : "O que sustenta a gestão do escritório hoje?"}
              </Titulo>
              <Apoio>Marque tudo o que vocês usam.</Apoio>
              <EscolhaChips
                multiplo
                ariaLabel="Ferramentas em uso"
                opcoes={FERRAMENTAS}
                value={respostas.contexto.ferramentas ?? []}
                onChange={(v) => atualizar({ contexto: { ...respostas.contexto, ferramentas: v as Ferramenta[] } })}
              />
              <Acoes>
                <Voltar onClick={voltar} />
                <Button variant="brand" className="h-11 flex-1" onClick={() => void avancar("ferramentas")}>
                  {(respostas.contexto.ferramentas ?? []).length > 0 ? "Continuar" : "Pular"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}

          {tela === TELA.previa && (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                {dorPrincipal ? rotuloDaDor(dorPrincipal) : "Pilar"}
              </p>
              <Titulo>{PREVIA_DA_DOR[dorPrincipal ?? "outra"].titulo}</Titulo>
              <ul className="space-y-3">
                {PREVIA_DA_DOR[dorPrincipal ?? "outra"].itens.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-ink">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
                      <Check className="h-3 w-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-soft">Onde fica: {PREVIA_DA_DOR[dorPrincipal ?? "outra"].onde}.</p>
              <Acoes>
                <Voltar onClick={voltar} />
                <Button variant="brand" className="h-11 flex-1" onClick={() => void avancar()}>
                  Ver meu plano <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}

          {tela === TELA.plano && (
            <>
              <Titulo>Seu plano, {nome}</Titulo>
              <Apoio>
                {plano.passos.length} passos, cerca de {plano.minutosTotal} minutos no total. Cada um vem depois do que
                ele precisa para funcionar.
              </Apoio>
              <ol className="space-y-2">
                {plano.passos.map((p, i) => (
                  <li
                    key={p.key}
                    className="flex items-start gap-3 rounded-xl border border-paper-border bg-paper p-3.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-ink">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{p.titulo}</span>
                      <span className="block text-xs text-ink-soft">{p.descricao}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">~{p.minutos} min</span>
                  </li>
                ))}
              </ol>
              <Acoes>
                <Voltar onClick={voltar} />
                <Button
                  variant="brand"
                  className="h-11 flex-1"
                  loading={concluindo}
                  onClick={() => void onConcluir({ ...respostas, dorPrincipal, etapaAtual: TELA.plano }, plano)}
                >
                  Entrar na Pilar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Acoes>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">{children}</h1>;
}

function Apoio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-soft">{children}</p>;
}

function Acoes({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 pt-2">{children}</div>;
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" className="h-11" onClick={onClick}>
      <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
    </Button>
  );
}
