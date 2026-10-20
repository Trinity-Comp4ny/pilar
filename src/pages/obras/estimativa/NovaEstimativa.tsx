import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calculator, Check, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { PilarPage } from "@/components/PilarPage";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { calcularEstimativa, fichaInicial, padroesDisponiveis } from "@/lib/estimativaObra";
import { cn } from "@/lib/utils";
import { SUBTIPOS, type Ficha, type Padrao, type Premissas, type TipoObra } from "@/schemas/estimativaObra";
import {
  useCriarEstimativa,
  useAtualizarEstimativa,
  useEstimativa,
  useInsumosDaEstimativa,
  type Insumos,
} from "./hooks";
import {
  PASSOS,
  PASSO_ROTULO,
  errosDaFicha,
  errosDoPasso,
  mesPadraoDeInicio,
  type ErrosDaFicha,
  type Passo,
} from "./lib";
import { PassoLocal, PassoPrograma, PassoRevisao, PassoTipo } from "./Passos";

type InsumosProntos = Extract<Insumos, { estado: "ok" }>;

interface Inicial {
  ficha: Ficha;
  nome: string;
  clienteNome: string;
  premissas: Premissas;
}

const BREADCRUMB = [{ label: "Estimativas", to: "/obras/estimativas" }];

/** Padrão que tem tabela para o subtipo: o atual, se der; senão o normal; senão o primeiro. */
function padraoQueExiste(disponiveis: Padrao[], atual: Padrao): Padrao {
  if (disponiveis.length === 0 || disponiveis.includes(atual)) return atual;
  return disponiveis.includes("normal") ? "normal" : disponiveis[0];
}

function Passos({ passo, indice }: { passo: Passo; indice: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Passos da estimativa">
      {PASSOS.map((p, i) => {
        const feito = i < indice;
        const atual = p === passo;
        return (
          <li key={p} className="flex items-center gap-2" aria-current={atual ? "step" : undefined}>
            {i > 0 && <span aria-hidden="true" className="h-px w-5 bg-border-strong max-sm:w-3" />}
            <span
              className={cn(
                "grid h-6 w-6 place-items-center rounded-full border text-xs font-semibold",
                atual && "border-ink bg-ink text-white",
                feito && "border-brand bg-brand text-ink",
                !atual && !feito && "bg-card text-ink-soft"
              )}
            >
              {feito ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-sm max-sm:sr-only", atual ? "font-semibold text-ink" : "text-ink-soft")}>
              {PASSO_ROTULO[p]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const TITULO_DO_PASSO: Record<Passo, { titulo: string; apoio: string }> = {
  tipo: {
    titulo: "Que obra é essa?",
    apoio: "O tipo e o padrão escolhem a tabela de preço de referência (CUB). Você ajusta tudo no fim.",
  },
  local: {
    titulo: "Onde e de que tamanho?",
    apoio: "O estado escolhe a tabela regional. A área construída é a base do cálculo.",
  },
  programa: {
    titulo: "O que a obra tem?",
    apoio: "Marque os itens. O que não está no CUB entra como adicional, com valor próprio.",
  },
  revisao: {
    titulo: "Confira o que entendemos",
    apoio: "É com esta ficha que o cálculo é feito. Edite qualquer linha antes de gerar.",
  },
};

function Assistente({
  inicial,
  insumos,
  idExistente,
}: {
  inicial: Inicial;
  insumos: InsumosProntos;
  idExistente?: string;
}) {
  const navigate = useNavigate();
  const [passo, setPasso] = useState<Passo>("tipo");
  const [ficha, setFicha] = useState<Ficha>(inicial.ficha);
  const [nome, setNome] = useState(inicial.nome);
  const [clienteNome, setClienteNome] = useState(inicial.clienteNome);
  const [tentou, setTentou] = useState<Partial<Record<Passo, boolean>>>({});
  const criar = useCriarEstimativa();
  const atualizar = useAtualizarEstimativa();

  const subtipo = SUBTIPOS[ficha.tipo][ficha.subtipo];
  const disponiveis = useMemo(() => padroesDisponiveis(insumos.cub, subtipo?.cub ?? ""), [insumos.cub, subtipo]);

  const atualizarCampo = <K extends keyof Ficha>(campo: K, valor: Ficha[K]) =>
    setFicha((f) => ({ ...f, [campo]: valor }));

  const trocarTipo = (tipo: TipoObra) =>
    setFicha((f) => {
      const [chave, novo] = Object.entries(SUBTIPOS[tipo])[0];
      const base: Ficha = { ...f, tipo, subtipo: chave, pavimentos: novo.pavimentos };
      // O programa de casa não existe fora do residencial: zera para não carregar suíte e piscina escondidas.
      const limpo: Ficha =
        tipo === "residencial" ? base : { ...base, quartos: 0, suites: 0, lavabo: 0, piscina: 0, gourmet: false };
      return { ...limpo, padrao: padraoQueExiste(padroesDisponiveis(insumos.cub, novo.cub), limpo.padrao) };
    });

  const trocarSubtipo = (chave: string) =>
    setFicha((f) => {
      const novo = SUBTIPOS[f.tipo][chave];
      return {
        ...f,
        subtipo: chave,
        pavimentos: novo.pavimentos,
        padrao: padraoQueExiste(padroesDisponiveis(insumos.cub, novo.cub), f.padrao),
      };
    });

  const erros: ErrosDaFicha = errosDaFicha(ficha);
  const erroNome = nome.trim() ? undefined : "Dê um nome à estimativa";
  const erroPadrao =
    disponiveis.length > 0 && !disponiveis.includes(ficha.padrao) ? "Escolha um padrão com tabela de preço" : undefined;

  const calculo = useMemo(
    () =>
      Object.keys(erros).length === 0
        ? calcularEstimativa({
            ficha,
            premissas: inicial.premissas,
            cub: insumos.cub,
            parametros: insumos.parametros,
            ajustes: insumos.ajustes,
            parametrosValidados: insumos.validado,
          })
        : null,
    // `erros` deriva de `ficha`; listar só a ficha evita recalcular por identidade do objeto de erros.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ficha, inicial.premissas, insumos]
  );

  const indice = PASSOS.indexOf(passo);
  const errosVisiveis = (p: Passo): ErrosDaFicha => (tentou[p] ? errosDoPasso(p, ficha) : {});

  const passoComErro = (p: Passo): boolean =>
    Object.keys(errosDoPasso(p, ficha)).length > 0 || (p === "local" && !!erroNome) || (p === "tipo" && !!erroPadrao);

  const avancar = () => {
    if (passoComErro(passo)) {
      setTentou((t) => ({ ...t, [passo]: true }));
      return;
    }
    setPasso(PASSOS[indice + 1]);
  };

  const gerar = async () => {
    const primeiroComErro = PASSOS.find(passoComErro);
    if (primeiroComErro) {
      setTentou({ tipo: true, local: true, programa: true });
      setPasso(primeiroComErro);
      return;
    }
    if (!calculo?.ok) {
      toast.error("Não foi possível calcular", {
        description: calculo?.ok === false ? calculo.mensagem : "Confira a ficha.",
      });
      return;
    }
    try {
      if (idExistente) {
        await atualizar.mutateAsync({
          id: idExistente,
          nome: nome.trim(),
          clienteNome: clienteNome.trim() || null,
          ficha,
          resultado: calculo.resultado,
        });
        toast.success("Estimativa atualizada");
        navigate(`/obras/estimativas/${idExistente}`);
        return;
      }
      const id = await criar.mutateAsync({
        nome: nome.trim(),
        clienteNome: clienteNome.trim() || null,
        ficha,
        premissas: inicial.premissas,
        resultado: calculo.resultado,
      });
      navigate(`/obras/estimativas/${id}`);
    } catch (e) {
      toast.error("Não foi possível salvar a estimativa", {
        description: e instanceof Error ? e.message : "Tente de novo em instantes.",
      });
    }
  };

  const salvando = criar.isPending || atualizar.isPending;
  const texto = TITULO_DO_PASSO[passo];

  return (
    <PilarPage title={idExistente ? "Editar estimativa" : "Nova estimativa"} breadcrumbs={BREADCRUMB}>
      <div className="mx-auto w-full max-w-3xl">
        <Passos passo={passo} indice={indice} />
        <h2 className="text-xl font-semibold tracking-tight text-ink">{texto.titulo}</h2>
        <p className="mb-6 mt-1 text-sm text-ink-soft">{texto.apoio}</p>

        {passo === "tipo" && (
          <>
            <PassoTipo
              ficha={ficha}
              erros={errosVisiveis("tipo")}
              disponiveis={disponiveis}
              onTipo={trocarTipo}
              onSubtipo={trocarSubtipo}
              onPadrao={(p) => atualizarCampo("padrao", p)}
            />
            {tentou.tipo && erroPadrao && (
              <p role="alert" className="mt-3 text-xs text-danger-mid">
                {erroPadrao}
              </p>
            )}
          </>
        )}
        {passo === "local" && (
          <PassoLocal
            ficha={ficha}
            atualizar={atualizarCampo}
            erros={errosVisiveis("local")}
            nome={nome}
            onNome={setNome}
            clienteNome={clienteNome}
            onClienteNome={setClienteNome}
            erroNome={tentou.local ? erroNome : undefined}
          />
        )}
        {passo === "programa" && (
          <PassoPrograma ficha={ficha} atualizar={atualizarCampo} erros={errosVisiveis("programa")} />
        )}
        {passo === "revisao" && (
          <PassoRevisao
            ficha={ficha}
            nome={nome.trim()}
            clienteNome={clienteNome.trim()}
            calculo={calculo}
            onEditar={setPasso}
          />
        )}

        <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
          {indice === 0 ? (
            <Button variant="ghost" asChild>
              <Link to={idExistente ? `/obras/estimativas/${idExistente}` : "/obras/estimativas"}>Cancelar</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setPasso(PASSOS[indice - 1])}>
              Voltar
            </Button>
          )}
          {passo === "revisao" ? (
            <Button
              variant="brand"
              loading={salvando}
              disabled={calculo?.ok === false || !calculo}
              onClick={() => void gerar()}
            >
              {idExistente ? "Salvar alterações" : "Gerar estimativa"}
            </Button>
          ) : (
            <Button variant="brand" onClick={avancar}>
              Continuar
            </Button>
          )}
        </div>
      </div>
    </PilarPage>
  );
}

/**
 * Assistente em quatro passos (SPEC 136): tipo e padrão, local e tamanho, o que a obra tem, revisão.
 * No modo edição (`/:id/editar`) parte da ficha salva e, ao fim, atualiza a estimativa.
 */
export default function NovaEstimativa() {
  const { id } = useParams<{ id: string }>();
  usePageTitle(id ? "Editar estimativa" : "Nova estimativa");
  const insumos = useInsumosDaEstimativa();
  const existente = useEstimativa(id);

  if (insumos.estado === "carregando" || (id && existente.isLoading)) return <PageLoader size="page" />;

  if (insumos.estado === "erro") {
    return (
      <PilarPage title="Nova estimativa" breadcrumbs={BREADCRUMB}>
        <EmptyState
          icon={Calculator}
          title="Não foi possível carregar a tabela de preços"
          description={insumos.mensagem}
        />
      </PilarPage>
    );
  }

  if (insumos.cub.length === 0) {
    return (
      <PilarPage title="Nova estimativa" breadcrumbs={BREADCRUMB}>
        <EmptyState
          icon={FileSpreadsheet}
          title="O Pilar ainda não tem a tabela do CUB"
          description="Sem o CUB não dá para calcular. Fale com o time para importar a tabela do mês."
        />
      </PilarPage>
    );
  }

  if (id) {
    if (!existente.data || !existente.data.ficha) {
      return (
        <PilarPage title="Editar estimativa" breadcrumbs={BREADCRUMB}>
          <EmptyState
            icon={Calculator}
            title="Estimativa não encontrada"
            description="Ela não existe mais ou os dados dela estão fora do formato."
            action={{ label: "Voltar às estimativas", onClick: () => window.history.back() }}
          />
        </PilarPage>
      );
    }
    const e = existente.data;
    return (
      <Assistente
        key={e.id}
        idExistente={e.id}
        insumos={insumos}
        inicial={{ ficha: e.ficha as Ficha, nome: e.nome, clienteNome: e.clienteNome ?? "", premissas: e.premissas }}
      />
    );
  }

  return (
    <Assistente
      insumos={insumos}
      inicial={{ ficha: fichaInicial(mesPadraoDeInicio(new Date())), nome: "", clienteNome: "", premissas: {} }}
    />
  );
}
