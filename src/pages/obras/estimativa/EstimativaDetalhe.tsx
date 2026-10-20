import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Calculator, CalendarClock, Pencil, Scale, Trash2, Wallet } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FormDialog } from "@/components/FormDialog";
import { PageLoader } from "@/components/motion/PageLoader";
import { PilarPage } from "@/components/PilarPage";
import { SectionTabs, type SectionTab } from "@/components/SectionTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { calcularEstimativa, padroesDisponiveis } from "@/lib/estimativaObra";
import { SUBTIPOS, type Padrao, type Premissas } from "@/schemas/estimativaObra";
import { AvisosEstimativa } from "./componentes";
import { CenariosTab } from "./CenariosTab";
import { CronogramaTab } from "./CronogramaTab";
import { CustoTab } from "./CustoTab";
import {
  useAtualizarEstimativa,
  useEstimativa,
  useExcluirEstimativa,
  useInsumosDaEstimativa,
  useSalvarVersao,
  useVersoes,
} from "./hooks";
import { PremissasPainel, type CampoPremissa } from "./PremissasPainel";

type Aba = "custo" | "cronograma" | "cenarios";

const ABAS: SectionTab[] = [
  { id: "custo", label: "Custo", icon: Wallet },
  { id: "cronograma", label: "Cronograma", icon: CalendarClock },
  { id: "cenarios", label: "Comparar cenários", icon: Scale },
];

const BREADCRUMB = [{ label: "Estimativas", to: "/obras/estimativas" }];
const ATRASO_DO_AUTOSAVE_MS = 800;

/**
 * Resultado da estimativa (SPEC 136): Custo, Cronograma e Cenários, com as premissas ao lado. Mexer em
 * padrão, administração, faixa ou equipe recalcula na hora e grava sozinho; a versão enviada ao cliente é
 * um snapshot à parte, que não muda.
 */
export default function EstimativaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const podeEditar = can("estimativa_obra", "edit");
  const query = useEstimativa(id);
  const insumos = useInsumosDaEstimativa();
  const versoes = useVersoes(id);
  const atualizar = useAtualizarEstimativa();
  const salvarVersao = useSalvarVersao();
  const excluir = useExcluirEstimativa();

  const [aba, setAba] = useState<Aba>("custo");
  const [edicao, setEdicao] = useState<{ premissas: Premissas; padrao: Padrao } | null>(null);
  const [versaoAberta, setVersaoAberta] = useState(false);
  const [nota, setNota] = useState("");
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);

  const e = query.data;
  usePageTitle(e?.nome ?? "Estimativa");

  const fichaSalva = e?.ficha ?? null;
  const premissas: Premissas = edicao?.premissas ?? e?.premissas ?? {};
  const ficha = fichaSalva ? { ...fichaSalva, padrao: edicao?.padrao ?? fichaSalva.padrao } : null;

  const calculo = useMemo(
    () =>
      ficha && insumos.estado === "ok"
        ? calcularEstimativa({
            ficha,
            premissas,
            cub: insumos.cub,
            parametros: insumos.parametros,
            ajustes: insumos.ajustes,
            parametrosValidados: insumos.validado,
          })
        : null,
    // `ficha` deriva de fichaSalva e edicao; listar as origens evita recalcular por identidade nova a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fichaSalva, edicao, e?.premissas, insumos]
  );

  // Há o que gravar quando padrão ou premissas diferem do que está no banco.
  const alterado =
    !!e &&
    !!fichaSalva &&
    !!edicao &&
    JSON.stringify({ p: edicao.padrao, m: edicao.premissas }) !==
      JSON.stringify({ p: fichaSalva.padrao, m: e.premissas });

  const { mutate: gravar, isPending: gravando } = atualizar;
  useEffect(() => {
    if (!alterado || !id || !ficha || !calculo?.ok) return;
    const t = window.setTimeout(
      () => gravar({ id, ficha, premissas, resultado: calculo.resultado }),
      ATRASO_DO_AUTOSAVE_MS
    );
    return () => window.clearTimeout(t);
    // O objeto `ficha` muda de identidade a cada render; alterado, calculo e premissas já cobrem o que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alterado, id, calculo, premissas, gravar]);

  if (query.isLoading || insumos.estado === "carregando") return <PageLoader size="page" />;

  if (!e || !id) {
    return (
      <PilarPage title="Estimativa não encontrada" breadcrumbs={BREADCRUMB}>
        <EmptyState
          icon={Calculator}
          title="Esta estimativa não existe ou foi removida"
          action={{ label: "Voltar às estimativas", onClick: () => navigate("/obras/estimativas") }}
        />
      </PilarPage>
    );
  }

  if (!ficha || insumos.estado === "erro") {
    return (
      <PilarPage title={e.nome} breadcrumbs={BREADCRUMB}>
        <EmptyState
          icon={Calculator}
          title={
            insumos.estado === "erro"
              ? "Não foi possível carregar a tabela de preços"
              : "Os dados desta estimativa estão fora do formato"
          }
          description={insumos.estado === "erro" ? insumos.mensagem : "Crie uma nova estimativa com a mesma obra."}
        />
      </PilarPage>
    );
  }

  const subtipo = SUBTIPOS[ficha.tipo][ficha.subtipo];
  const disponiveis = padroesDisponiveis(insumos.cub, subtipo.cub);
  const valores: Record<CampoPremissa, number> = {
    adm: premissas.adm ?? insumos.parametros.adm_padrao,
    faixa: premissas.faixa ?? insumos.parametros.faixa_padrao,
    equipe: premissas.equipe ?? insumos.parametros.equipe_padrao,
  };

  const comEdicao = (
    muda: (atual: { premissas: Premissas; padrao: Padrao }) => { premissas: Premissas; padrao: Padrao }
  ) => setEdicao(muda({ premissas: edicao?.premissas ?? e.premissas, padrao: edicao?.padrao ?? fichaSalva!.padrao }));

  const aoSalvarVersao = async () => {
    if (!calculo?.ok) return;
    try {
      // A versão tem que refletir o que está na tela: grava antes o que ainda não foi salvo.
      if (alterado) await atualizar.mutateAsync({ id, ficha, premissas, resultado: calculo.resultado });
      await salvarVersao.mutateAsync({
        estimativaId: id,
        nota: nota.trim() || null,
        ficha,
        premissas,
        resultado: calculo.resultado,
      });
      toast.success("Versão salva", { description: "Ela fica guardada e não muda." });
      setVersaoAberta(false);
      setNota("");
    } catch (erro) {
      toast.error("Não foi possível salvar a versão", {
        description: erro instanceof Error ? erro.message : "Tente de novo em instantes.",
      });
    }
  };

  const aoExcluir = async () => {
    try {
      await excluir.mutateAsync(id);
      toast.success("Estimativa excluída");
      navigate("/obras/estimativas");
    } catch (erro) {
      toast.error("Não foi possível excluir", { description: erro instanceof Error ? erro.message : "Tente de novo." });
    }
  };

  const estadoDoSalvamento = alterado
    ? gravando
      ? "Salvando…"
      : "Alterações pendentes"
    : edicao
      ? "Alterações salvas"
      : null;

  return (
    <PilarPage
      title={e.nome}
      breadcrumbs={BREADCRUMB}
      tabs={
        <SectionTabs tabs={ABAS} value={aba} onValueChange={(v) => setAba(v as Aba)} ariaLabel="Seções da estimativa" />
      }
      actions={
        podeEditar ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/obras/estimativas/${id}/editar`} aria-label="Editar a ficha">
                <Pencil className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
                <span className="max-sm:sr-only">Editar a ficha</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmaExcluir(true)} aria-label="Excluir">
              <Trash2 className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
              <span className="max-sm:sr-only">Excluir</span>
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        <StatusBadge domain="estimativa_obra" status={e.status} />
        {e.clienteNome && <span>{e.clienteNome}</span>}
        <span>{e.versaoAtual > 0 ? `Versão atual v${e.versaoAtual}` : "Nenhuma versão salva"}</span>
        {estadoDoSalvamento && (
          <span role="status" aria-live="polite">
            {estadoDoSalvamento}
          </span>
        )}
      </div>

      {calculo && !calculo.ok ? (
        <EmptyState
          icon={Calculator}
          title="Não foi possível calcular esta estimativa"
          description={calculo.mensagem}
          action={
            podeEditar
              ? { label: "Editar a ficha", onClick: () => navigate(`/obras/estimativas/${id}/editar`) }
              : undefined
          }
        />
      ) : (
        calculo?.ok && (
          <>
            <AvisosEstimativa avisos={calculo.resultado.avisos} />
            {aba === "custo" && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <CustoTab resultado={calculo.resultado} />
                <PremissasPainel
                  ficha={ficha}
                  valores={valores}
                  disponiveis={disponiveis}
                  onPadrao={(padrao) => comEdicao((a) => ({ ...a, padrao }))}
                  onPremissa={(campo, valor) =>
                    comEdicao((a) => ({ ...a, premissas: { ...a.premissas, [campo]: valor } }))
                  }
                  versoes={versoes.data ?? []}
                  carregandoVersoes={versoes.isLoading}
                  onSalvarVersao={() => setVersaoAberta(true)}
                />
              </div>
            )}
            {aba === "cronograma" && <CronogramaTab resultado={calculo.resultado} />}
            {aba === "cenarios" && (
              <CenariosTab ficha={ficha} premissas={premissas} insumos={insumos} atual={calculo.resultado} />
            )}
          </>
        )
      )}

      <FormDialog
        open={versaoAberta}
        onOpenChange={setVersaoAberta}
        title="Salvar como nova versão"
        description="A versão guarda a ficha, as premissas e o resultado de agora. Ela fica guardada e não muda."
        submitLabel="Salvar versão"
        isPending={salvarVersao.isPending || atualizar.isPending}
        onSubmit={() => void aoSalvarVersao()}
      >
        <div>
          <label htmlFor="versao-nota" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Nota <span className="font-normal">(opcional)</span>
          </label>
          <Textarea
            id="versao-nota"
            value={nota}
            maxLength={500}
            rows={3}
            placeholder="Ex.: padrão alto com piscina maior"
            onChange={(ev) => setNota(ev.target.value)}
          />
        </div>
      </FormDialog>

      <ConfirmDialog
        open={confirmaExcluir}
        onOpenChange={setConfirmaExcluir}
        onConfirm={() => void aoExcluir()}
        title="Excluir estimativa?"
        itemName={e.nome}
        description="A estimativa e as versões salvas saem de vez. Uma obra criada a partir dela continua existindo."
        variant="destructive"
        confirmText="Excluir"
        loading={excluir.isPending}
      />
    </PilarPage>
  );
}
