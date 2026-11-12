import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { DesbloqueioNivel } from "@/components/trial/DesbloqueioNivel";
import { Input } from "@/components/ui/input";
import { useNivelConfianca } from "@/hooks/useNivelConfianca";
import { analytics } from "@/lib/analytics";
import { parseCapacidadeError, type CapacidadeErro } from "@/lib/capacidade";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { geocodarCidade } from "@/pages/obras/lib/clima";
import type { Ficha, ResultadoEstimativa } from "@/schemas/estimativaObra";
import { Campo } from "./componentes";
import { useCriarObraDaEstimativa } from "./hooks";
import { obraDaEstimativa } from "./obraDaEstimativa";

interface CriarObraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimativa: { id: string; nome: string };
  ficha: Ficha;
  resultado: ResultadoEstimativa;
  /** Antes de criar: grava o que ainda está pendente na estimativa (premissas mexidas e não salvas). */
  antesDeCriar?: () => Promise<void>;
  onCriada: (obraId: string) => void;
}

/**
 * SPEC 136, requisito 11 (BEZ-19): a estimativa vira obra num clique. Mostra o que vai ser criado (cronograma,
 * previsto por etapa, taxa e local) e cria tudo numa transação só.
 */
export function CriarObraDialog({
  open,
  onOpenChange,
  estimativa,
  ficha,
  resultado,
  antesDeCriar,
  onCriada,
}: CriarObraDialogProps) {
  const [nome, setNome] = useState(estimativa.nome);
  const [erroNome, setErroNome] = useState<string | undefined>();
  const [capacidade, setCapacidade] = useState<CapacidadeErro | null>(null);
  const { isAdmin } = useNivelConfianca();
  const criar = useCriarObraDaEstimativa();
  const obra = useMemo(() => obraDaEstimativa(resultado), [resultado]);
  const aDefinir = resultado.adicionais.filter((a) => a.valor === null).length;
  const local = [ficha.endereco, ficha.cidade && `${ficha.cidade}/${ficha.uf}`, ficha.cep].filter(Boolean).join(" · ");

  const aoCriar = async () => {
    const limpo = nome.trim();
    if (!limpo) {
      setErroNome("Dê um nome à obra");
      return;
    }
    setErroNome(undefined);
    try {
      await antesDeCriar?.();
      // Coordenadas da cidade para o clima da obra. Falhou, a obra nasce sem coordenadas (como no cadastro manual).
      let latitude: number | null = null;
      let longitude: number | null = null;
      if (ficha.cidade) {
        try {
          const geo = await geocodarCidade(`${ficha.cidade}, ${ficha.uf}`);
          latitude = geo[0]?.latitude ?? null;
          longitude = geo[0]?.longitude ?? null;
        } catch {
          // segue sem coordenadas
        }
      }
      const obraId = await criar.mutateAsync({
        estimativaId: estimativa.id,
        obra: {
          nome: limpo,
          cep: ficha.cep || undefined,
          cidade: ficha.cidade || undefined,
          localizacao: [ficha.endereco, ficha.cidade, ficha.uf].filter(Boolean).join(", ") || undefined,
          latitude,
          longitude,
          taxa_administracao_pct: resultado.admPct,
          data_inicio_prevista: obra.inicio,
          data_fim_prevista: obra.fim,
        },
        fases: obra.fases,
      });
      analytics.track("obra_criada", { com_projeto: false, da_estimativa: true });
      toast.success("Obra criada", { description: "Cronograma e previsto por etapa já estão na obra." });
      onOpenChange(false);
      onCriada(obraId);
    } catch (e) {
      const cap = parseCapacidadeError(e);
      if (cap) {
        analytics.track("trial_limite_atingido", { recurso: cap.recurso, limite: cap.limite });
        setCapacidade(cap);
        return;
      }
      toast.error("Não foi possível criar a obra", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    }
  };

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Criar obra a partir da estimativa"
        description="A obra nasce com o cronograma e o previsto da estimativa. Depois tudo pode ser ajustado na obra."
        submitLabel="Criar obra"
        isPending={criar.isPending}
        onSubmit={() => void aoCriar()}
      >
        <Campo id="obra-nome" rotulo="Nome da obra" erro={erroNome}>
          <Input
            id="obra-nome"
            value={nome}
            maxLength={200}
            aria-invalid={erroNome ? true : undefined}
            aria-describedby={erroNome ? "obra-nome-erro" : undefined}
            onChange={(ev) => setNome(ev.target.value)}
          />
        </Campo>
        <dl className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
          <div>
            <dt className="text-ink-soft">Cronograma</dt>
            <dd className="text-ink">
              {obra.fases.length} fases, {obra.etapas} etapas e {obra.servicos} serviços, de {formatDate(obra.inicio)} a{" "}
              {formatDate(obra.fim)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Previsto por etapa, na conta da obra</dt>
            <dd className="text-ink">
              <strong className="tabular-nums">{formatCurrency(obra.previstoTotal, { decimals: 0 })}</strong>, o
              subtotal da estimativa
              {aDefinir > 0 &&
                `. ${aDefinir === 1 ? "1 item a definir entra" : `${aDefinir} itens a definir entram`} sem previsto`}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Taxa de administração</dt>
            <dd className="text-ink">
              {formatPercent(resultado.admPct, 0)} sobre cada despesa lançada, como receita do escritório
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Local</dt>
            <dd className="text-ink">{local || "Sem endereço na estimativa: dá para preencher depois, na obra"}</dd>
          </div>
        </dl>
      </FormDialog>
      {capacidade && (
        <DesbloqueioNivel
          open
          onOpenChange={(o) => !o && setCapacidade(null)}
          recurso={capacidade.recurso}
          limite={capacidade.limite}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
