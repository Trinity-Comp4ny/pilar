import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/FormDialog";
import { MoneyInput } from "@/components/forms/MoneyInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { parseCurrencyString } from "@/lib/currencyUtils";
import { getSafeErrorMessage } from "@/lib/safeError";
import {
  useConfirmarAditivo,
  useCriarAditivoProjeto,
  usePreviaAditivo,
  type OrigemAditivo,
} from "../hooks/useAditivosProjeto";

export type DisciplinaAditivo = { id: string; nome: string };

export function NovoAditivoProjeto({
  projetoId,
  disciplinas = [],
  origem,
  fechar,
  criado,
}: {
  projetoId: string;
  disciplinas?: DisciplinaAditivo[];
  origem: OrigemAditivo;
  fechar: () => void;
  criado?: (id: string) => void;
}) {
  const criar = useCriarAditivoProjeto(projetoId);
  const [descricao, setDescricao] = useState(origem.descricao ?? "");
  const [motivo, setMotivo] = useState(origem.motivo ?? "");
  const [disciplinaId, setDisciplina] = useState(origem.disciplinaId ?? "");
  const [valor, setValor] = useState("");
  const valorNumerico = parseCurrencyString(valor);
  const podeSalvar = !!descricao.trim() && !!motivo.trim() && valorNumerico > 0;

  async function salvar() {
    try {
      const id = await criar.mutateAsync({
        descricao,
        motivo,
        valor: valorNumerico,
        origem: { ...origem, disciplinaId: disciplinaId || undefined },
      });
      toast.success("Rascunho de aditivo criado");
      fechar();
      criado?.(id);
    } catch (error) {
      toast.error(getSafeErrorMessage(error, "Não foi possível criar o aditivo."));
    }
  }

  return (
    <FormDialog
      open
      title="Novo aditivo"
      description="Registre a mudança e o valor adicional para aprovar depois."
      onOpenChange={(open) => !open && fechar()}
      onSubmit={salvar}
      submitLabel="Salvar rascunho"
      isPending={criar.isPending}
      submitDisabled={!podeSalvar}
    >
      <div className="space-y-1">
        <Label htmlFor="aditivo-descricao">Descrição</Label>
        <Input
          id="aditivo-descricao"
          value={descricao}
          maxLength={250}
          onChange={(e) => setDescricao(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="aditivo-motivo">Motivo</Label>
        <Textarea
          id="aditivo-motivo"
          value={motivo}
          maxLength={4000}
          onChange={(e) => setMotivo(e.target.value)}
          required
        />
      </div>
      {disciplinas.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="aditivo-disciplina">Disciplina</Label>
          <select
            id="aditivo-disciplina"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={disciplinaId}
            onChange={(e) => setDisciplina(e.target.value)}
            disabled={!!origem.disciplinaId}
          >
            <option value="">Sem disciplina vinculada</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="aditivo-valor">Valor adicional</Label>
        <MoneyInput id="aditivo-valor" value={valor} onChange={setValor} />
      </div>
    </FormDialog>
  );
}

export function AprovarAditivoProjeto({
  projetoId,
  aditivoId,
  descricao,
  fechar,
}: {
  projetoId: string;
  aditivoId: string;
  descricao: string;
  fechar: () => void;
}) {
  const [modo, setModo] = useState<"separado" | "grupo">("separado");
  const [grupo, setGrupo] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [parcelas, setParcelas] = useState("1");
  const [aceite, setAceite] = useState("");
  const numeroParcelas = Number(parcelas);
  const valido =
    modo === "grupo"
      ? !!grupo
      : !!vencimento && Number.isInteger(numeroParcelas) && numeroParcelas >= 1 && numeroParcelas <= 60;
  const base = usePreviaAditivo({ p_aditivo: aditivoId });
  const opcoes =
    modo === "grupo"
      ? { p_aditivo: aditivoId, p_grupo: grupo }
      : { p_aditivo: aditivoId, p_vencimento: vencimento, p_parcelas: numeroParcelas };
  const previa = usePreviaAditivo(opcoes, valido);
  const confirmar = useConfirmarAditivo(projetoId);
  const grupos = base.data?.grupos ?? [];
  const dados = previa.data ?? base.data;

  async function aprovar() {
    if (!previa.data || previa.isFetching || previa.isError) return;
    try {
      await confirmar.mutateAsync({ opcoes, previa: previa.data, aceite });
      toast.success("Aditivo aprovado e cobrança atualizada");
      fechar();
    } catch (error) {
      toast.error(getSafeErrorMessage(error, "Não foi possível aprovar. Confira uma nova prévia."));
      void previa.refetch();
    }
  }

  return (
    <FormDialog
      open
      title="Aprovar aditivo"
      description={descricao}
      size="lg"
      onOpenChange={(open) => !open && fechar()}
      onSubmit={aprovar}
      submitLabel="Aprovar e registrar cobrança"
      isPending={confirmar.isPending}
      submitDisabled={
        !valido || previa.isFetching || previa.isError || !previa.data?.cliente || !previa.data?.linhas.length
      }
    >
      {base.isError && (
        <p role="alert" className="text-sm text-danger-strong">
          Não foi possível carregar as opções de cobrança.
        </p>
      )}
      {dados && (
        <dl className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-3">
          <div>
            <dt>Contrato atual</dt>
            <dd className="font-medium">{formatCurrency(dados.contrato)}</dd>
          </div>
          <div>
            <dt>Aditivo</dt>
            <dd className="font-medium">{formatCurrency(dados.aditivo)}</dd>
          </div>
          <div>
            <dt>Contrato atualizado</dt>
            <dd className="font-medium">{formatCurrency(dados.contrato + dados.aditivo)}</dd>
          </div>
        </dl>
      )}
      {previa.data && (
        <p className="text-sm text-muted-foreground">
          Saldo a receber após a aprovação · {formatCurrency(previa.data.saldo + previa.data.aditivo)}
        </p>
      )}
      {dados?.cliente === false && (
        <p role="alert" className="text-sm">
          Vincule um cliente ao projeto para registrar a cobrança.
        </p>
      )}
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium">Forma de cobrança</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="modo-aditivo" checked={modo === "separado"} onChange={() => setModo("separado")} />
          Cobrar o aditivo à parte
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="modo-aditivo"
            checked={modo === "grupo"}
            disabled={!grupos.length}
            onChange={() => {
              setModo("grupo");
              if (grupos.length === 1) setGrupo(grupos[0].id);
            }}
          />
          Distribuir nas próximas parcelas
        </label>
        {base.data && !grupos.length && (
          <p className="text-muted-foreground">Nenhum grupo de parcelas futuras elegível.</p>
        )}
      </fieldset>
      {modo === "grupo" ? (
        <div className="space-y-1">
          <Label htmlFor="grupo-aditivo">Grupo de parcelas do contrato</Label>
          <select
            id="grupo-aditivo"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
          >
            <option value="">Selecione o grupo</option>
            {grupos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome} · {item.quantidade} elegíveis
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="vencimento-aditivo">Primeiro vencimento</Label>
            <Input
              id="vencimento-aditivo"
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="parcelas-aditivo">Parcelas mensais</Label>
            <Input
              id="parcelas-aditivo"
              type="number"
              min={1}
              max={60}
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value)}
            />
          </div>
        </div>
      )}
      {previa.isFetching && (
        <p role="status" className="text-sm text-muted-foreground">
          Calculando prévia…
        </p>
      )}
      {previa.isError && (
        <p role="alert" className="text-sm text-danger-strong">
          {getSafeErrorMessage(previa.error, "Confira os dados para calcular a prévia.")}
        </p>
      )}
      {!!previa.data?.linhas.length && (
        <ul aria-label="Prévia das parcelas" className="max-h-40 divide-y overflow-auto rounded-md border px-3 text-sm">
          {previa.data.linhas.map((linha, i) => (
            <li key={linha.id ?? i} className="flex flex-wrap justify-between gap-x-3 py-2">
              <span>
                {i + 1}. {formatDate(linha.vencimento)}
              </span>
              <span>
                {linha.id && <>{formatCurrency(linha.anterior)} → </>}
                {formatCurrency(linha.novo)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1">
        <Label htmlFor="aditivo-aceite">Aceite do cliente (opcional)</Label>
        <Textarea
          id="aditivo-aceite"
          value={aceite}
          maxLength={4000}
          onChange={(e) => setAceite(e.target.value)}
          placeholder="Informe quando o cliente aceitou ou inclua o link do comprovante."
        />
      </div>
    </FormDialog>
  );
}
