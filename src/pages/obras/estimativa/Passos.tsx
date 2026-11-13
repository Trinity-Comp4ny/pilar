import { Building2, Factory, Home, type LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { BusyMark } from "@/components/motion/BusyMark";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { lookupCEP } from "@/lib/brasilApi";
import { formatCEP, onlyDigits } from "@/lib/maskUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { avisosCoerencia, rotuloPadrao, type SaidaCalculo } from "@/lib/estimativaObra";
import {
  PADROES,
  SUBTIPOS,
  UFS,
  type Ficha,
  type Padrao,
  type Premissas,
  type ResultadoEstimativa,
  type TipoObra,
} from "@/schemas/estimativaObra";
import { Campo, CampoNumero, Contador, Pilula } from "./componentes";
import type { Insumos } from "./hooks";
import { DescrevaAObra } from "./DescrevaAObra";
import { ItensDaObra } from "./ItensDaObra";
import { resumoDosItens } from "./itensCatalogo";
import {
  PADRAO_INFO,
  PASSO_ROTULO,
  TIPO_INFO,
  UFS_ORDENADAS,
  UF_NOME,
  dataDoInicio,
  rotuloInicio,
  type ErrosDaFicha,
  type Passo,
} from "./lib";

type InsumosProntos = Extract<Insumos, { estado: "ok" }>;

export interface PassoProps {
  ficha: Ficha;
  atualizar: <K extends keyof Ficha>(campo: K, valor: Ficha[K]) => void;
  erros: ErrosDaFicha;
}

const ICONE_TIPO: Record<TipoObra, LucideIcon> = { residencial: Home, comercial: Building2, industrial: Factory };

function Opcao({
  ativa,
  titulo,
  descricao,
  icone: Icone,
  onClick,
  desabilitada,
}: {
  ativa: boolean;
  titulo: string;
  descricao: string;
  icone?: LucideIcon;
  onClick: () => void;
  desabilitada?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativa}
      disabled={desabilitada}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-2xl border bg-card p-4 text-left transition-colors",
        ativa ? "border-ink ring-2 ring-brand" : "hover:border-border-strong",
        desabilitada && "cursor-not-allowed opacity-45"
      )}
    >
      {Icone && (
        <span className={cn("mb-1 grid h-9 w-9 place-items-center rounded-xl", ativa ? "bg-brand" : "bg-muted")}>
          <Icone className="h-[18px] w-[18px] text-ink" aria-hidden="true" />
        </span>
      )}
      <span className="text-sm font-semibold text-ink">{titulo}</span>
      <span className="text-xs leading-snug text-ink-soft">{descricao}</span>
    </button>
  );
}

export function PassoTipo({
  ficha,
  erros,
  disponiveis,
  onTipo,
  onSubtipo,
  onPadrao,
}: {
  ficha: Ficha;
  erros: ErrosDaFicha;
  disponiveis: Padrao[];
  onTipo: (t: TipoObra) => void;
  onSubtipo: (s: string) => void;
  onPadrao: (p: Padrao) => void;
}) {
  const subtipos = SUBTIPOS[ficha.tipo];
  return (
    <div className="space-y-6">
      <div role="radiogroup" aria-label="Tipo de obra" className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(TIPO_INFO) as TipoObra[]).map((t) => (
          <Opcao
            key={t}
            ativa={ficha.tipo === t}
            titulo={TIPO_INFO[t].nome}
            descricao={TIPO_INFO[t].descricao}
            icone={ICONE_TIPO[t]}
            onClick={() => onTipo(t)}
          />
        ))}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Subtipo</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(subtipos).map(([chave, s]) => (
            <Pilula key={chave} ativa={ficha.subtipo === chave} onClick={() => onSubtipo(chave)} title={s.exemplo}>
              {s.nome}
            </Pilula>
          ))}
        </div>
        {erros.subtipo && (
          <p role="alert" className="mt-1.5 text-xs text-danger-mid">
            {erros.subtipo}
          </p>
        )}
      </fieldset>

      <div>
        <p className="mb-2 text-sm font-medium text-ink-soft" id="padrao-rotulo">
          Padrão de acabamento
        </p>
        <div role="radiogroup" aria-labelledby="padrao-rotulo" className="grid gap-3 sm:grid-cols-3">
          {PADROES.map((p) => {
            const livre = disponiveis.includes(p);
            return (
              <Opcao
                key={p}
                ativa={ficha.padrao === p}
                titulo={PADRAO_INFO[p].nome}
                descricao={livre ? PADRAO_INFO[p].exemplo : "Sem tabela de preço para este subtipo"}
                desabilitada={!livre}
                onClick={() => onPadrao(p)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PassoLocal({
  ficha,
  atualizar,
  erros,
  nome,
  onNome,
  clienteNome,
  onClienteNome,
  erroNome,
}: PassoProps & {
  nome: string;
  onNome: (v: string) => void;
  clienteNome: string;
  onClienteNome: (v: string) => void;
  erroNome?: string;
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState<string | null>(null);
  const ultimoCep = useRef(onlyDigits(ficha.cep ?? ""));

  // CEP → endereço, cidade e estado (BrasilAPI com ViaCEP de reserva). O estado continua editável.
  const buscarCep = async (cep: string) => {
    const digitos = onlyDigits(cep);
    if (digitos.length !== 8 || digitos === ultimoCep.current) return;
    ultimoCep.current = digitos;
    setBuscandoCep(true);
    setAvisoCep(null);
    try {
      const end = await lookupCEP(digitos);
      if (!end) {
        setAvisoCep("CEP não encontrado. Preencha o endereço e o estado à mão.");
        return;
      }
      const endereco = [end.street, end.neighborhood].filter(Boolean).join(", ");
      if (endereco) atualizar("endereco", endereco);
      if (end.city) atualizar("cidade", end.city);
      const uf = (UFS as readonly string[]).includes(end.state) ? (end.state as Ficha["uf"]) : null;
      if (uf) atualizar("uf", uf);
    } finally {
      setBuscandoCep(false);
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id="est-nome" rotulo="Nome da estimativa" erro={erroNome}>
        <Input
          id="est-nome"
          value={nome}
          maxLength={200}
          placeholder="Ex.: Residência Almeida"
          aria-invalid={erroNome ? true : undefined}
          aria-describedby={erroNome ? "est-nome-erro" : undefined}
          onChange={(e) => onNome(e.target.value)}
        />
      </Campo>
      <Campo id="est-cliente" rotulo="Cliente" dica="Opcional. Aparece na lista e no PDF.">
        <Input
          id="est-cliente"
          value={clienteNome}
          maxLength={200}
          placeholder="Nome de quem pediu a estimativa"
          onChange={(e) => onClienteNome(e.target.value)}
        />
      </Campo>
      <Campo id="est-cep" rotulo="CEP da obra" dica={avisoCep ?? "Opcional. Preenche o endereço e o estado."}>
        <div className="relative">
          <Input
            id="est-cep"
            inputMode="numeric"
            placeholder="00000-000"
            maxLength={9}
            value={ficha.cep ?? ""}
            onChange={(e) => {
              const cep = formatCEP(e.target.value);
              atualizar("cep", cep);
              void buscarCep(cep);
            }}
          />
          {buscandoCep && (
            <BusyMark className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
      </Campo>
      <Campo id="est-endereco" rotulo="Endereço" erro={erros.endereco}>
        <Input
          id="est-endereco"
          value={ficha.endereco ?? ""}
          maxLength={300}
          placeholder="Rua, bairro"
          onChange={(e) => atualizar("endereco", e.target.value)}
        />
      </Campo>
      <Campo id="est-cidade" rotulo="Cidade" erro={erros.cidade}>
        <Input
          id="est-cidade"
          value={ficha.cidade ?? ""}
          maxLength={120}
          placeholder="Ex.: Campinas"
          onChange={(e) => atualizar("cidade", e.target.value)}
        />
      </Campo>
      <Campo id="est-uf" rotulo="Estado" dica="Define a tabela de preço (CUB) usada." erro={erros.uf}>
        <Select value={ficha.uf} onValueChange={(v) => atualizar("uf", v as Ficha["uf"])}>
          <SelectTrigger id="est-uf">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UFS_ORDENADAS.map((u) => (
              <SelectItem key={u} value={u}>
                {u} · {UF_NOME[u]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
      <Campo
        id="est-inicio"
        rotulo="Início da obra"
        dica="Pode ser uma data passada, para obra que já começou."
        erro={erros.inicio}
      >
        <DatePicker
          id="est-inicio"
          value={dataDoInicio(ficha.inicio)}
          onChange={(v) => v && atualizar("inicio", v)}
          clearable={false}
        />
      </Campo>
      <Campo id="est-area" rotulo="Área construída" erro={erros.area}>
        <CampoNumero
          id="est-area"
          valor={ficha.area}
          onChange={(n) => atualizar("area", n)}
          sufixo="m²"
          erro={erros.area}
        />
      </Campo>
      <Campo id="est-pav" rotulo="Pavimentos" erro={erros.pavimentos}>
        <CampoNumero
          id="est-pav"
          valor={ficha.pavimentos}
          onChange={(n) => atualizar("pavimentos", n)}
          erro={erros.pavimentos}
        />
      </Campo>
      <Campo
        id="est-terreno"
        rotulo="Área do terreno"
        dica="Serve para estimar paisagismo e área externa."
        erro={erros.terreno}
        className="sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]"
      >
        <CampoNumero
          id="est-terreno"
          valor={ficha.terreno}
          onChange={(n) => atualizar("terreno", n)}
          sufixo="m²"
          erro={erros.terreno}
        />
      </Campo>
    </div>
  );
}

export function PassoPrograma({
  ficha,
  atualizar,
  erros,
  insumos,
  premissas,
  resultado,
  aplicar,
}: PassoProps & {
  insumos: InsumosProntos;
  premissas: Premissas;
  resultado: ResultadoEstimativa | null;
  aplicar: (fn: (f: Ficha) => Ficha) => void;
}) {
  const residencial = ficha.tipo === "residencial";
  return (
    <div className="space-y-6">
      <section aria-label="Ambientes" className="rounded-2xl border bg-card p-4 md:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-semibold text-ink">Ambientes</h3>
          <p className="max-w-md text-xs text-ink-soft">
            Não mudam o preço: o CUB já considera o padrão. Servem para conferir a ficha e para o PDF.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {residencial && (
            <>
              <Contador
                rotulo="Quartos"
                valor={ficha.quartos}
                onChange={(n) => atualizar("quartos", n)}
                erro={erros.quartos}
              />
              <Contador
                rotulo="Suítes"
                valor={ficha.suites}
                onChange={(n) => atualizar("suites", n)}
                erro={erros.suites}
              />
            </>
          )}
          <Contador
            rotulo="Banheiros"
            valor={ficha.banheiros}
            onChange={(n) => atualizar("banheiros", n)}
            erro={erros.banheiros}
          />
          {residencial && (
            <Contador
              rotulo="Lavabos"
              valor={ficha.lavabo}
              onChange={(n) => atualizar("lavabo", n)}
              erro={erros.lavabo}
            />
          )}
          <Contador
            rotulo="Vagas"
            valor={ficha.vagas}
            onChange={(n) => atualizar("vagas", n)}
            max={999}
            erro={erros.vagas}
          />
        </div>
      </section>

      <DescrevaAObra ficha={ficha} atualizar={atualizar} aplicar={aplicar} insumos={insumos} premissas={premissas} />

      <div>
        <h3 className="mb-1 text-base font-semibold text-ink">O que o CUB não cobre</h3>
        <p className="mb-3 text-sm text-ink-soft">
          Estrutura, alvenaria, instalações básicas e o acabamento do padrão já estão no CUB. Marque o que a obra terá
          além disso: cada item mostra de onde vem o preço.
        </p>
        <ItensDaObra
          ficha={ficha}
          atualizar={atualizar}
          erros={erros}
          insumos={insumos}
          premissas={premissas}
          resultado={resultado}
        />
      </div>
    </div>
  );
}

function LinhaRevisao({
  rotulo,
  valor,
  passo,
  onEditar,
}: {
  rotulo: string;
  valor: ReactNode;
  passo: Passo;
  onEditar: (p: Passo) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-3 text-sm last:border-b-0">
      <dt className="shrink-0 text-ink-soft">{rotulo}</dt>
      <dd className="flex min-w-0 items-start gap-2 text-right font-medium text-ink">
        <span className="min-w-0 break-words">{valor}</span>
        <button
          type="button"
          onClick={() => onEditar(passo)}
          className="shrink-0 text-xs font-normal text-ink-soft underline-offset-2 hover:text-ink hover:underline"
          aria-label={`Editar ${rotulo.toLowerCase()} (passo ${PASSO_ROTULO[passo].toLowerCase()})`}
        >
          Editar
        </button>
      </dd>
    </div>
  );
}

export function PassoRevisao({
  ficha,
  nome,
  clienteNome,
  calculo,
  onEditar,
}: {
  ficha: Ficha;
  nome: string;
  clienteNome: string;
  calculo: SaidaCalculo | null;
  onEditar: (p: Passo) => void;
}) {
  const subtipo = SUBTIPOS[ficha.tipo][ficha.subtipo];
  const coerencia = avisosCoerencia(ficha);
  const programa = [
    ficha.tipo === "residencial" && `${ficha.quartos} quartos (${ficha.suites} suítes)`,
    `${ficha.banheiros} banheiros`,
    ficha.tipo === "residencial" && ficha.lavabo > 0 && `${ficha.lavabo} lavabo${ficha.lavabo > 1 ? "s" : ""}`,
    `${ficha.vagas} vagas`,
  ].filter(Boolean);
  const adicionais = resumoDosItens(ficha);

  return (
    <div className="space-y-4">
      {coerencia.length > 0 && (
        <ul
          className="space-y-1 rounded-xl border border-warning-mid bg-warning-soft px-3 py-3 text-sm text-warning-strong"
          role="status"
        >
          {coerencia.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <dl className="rounded-2xl border bg-card px-4">
        <LinhaRevisao
          rotulo="Estimativa"
          valor={clienteNome ? `${nome} · ${clienteNome}` : nome || "Sem nome"}
          passo="local"
          onEditar={onEditar}
        />
        <LinhaRevisao
          rotulo="Obra"
          valor={`${TIPO_INFO[ficha.tipo].nome} · ${subtipo.nome} · padrão ${rotuloPadrao(ficha.padrao)}`}
          passo="tipo"
          onEditar={onEditar}
        />
        <LinhaRevisao
          rotulo="Local"
          valor={`${ficha.cidade ? `${ficha.cidade}, ` : ""}${UF_NOME[ficha.uf]} (${ficha.uf}) · início em ${rotuloInicio(ficha.inicio)}`}
          passo="local"
          onEditar={onEditar}
        />
        <LinhaRevisao
          rotulo="Tamanho"
          valor={`${ficha.area.toLocaleString("pt-BR")} m² em ${ficha.pavimentos} pavimento${ficha.pavimentos > 1 ? "s" : ""} · terreno de ${ficha.terreno.toLocaleString("pt-BR")} m²`}
          passo="local"
          onEditar={onEditar}
        />
        <LinhaRevisao rotulo="Programa" valor={programa.join(" · ")} passo="programa" onEditar={onEditar} />
        <LinhaRevisao
          rotulo="Itens fora do CUB"
          valor={adicionais.length > 0 ? adicionais.join(", ") : "nenhum"}
          passo="programa"
          onEditar={onEditar}
        />
      </dl>

      {calculo && !calculo.ok && (
        <p
          className="rounded-xl border border-danger-mid bg-danger-soft px-3 py-3 text-sm text-danger-strong"
          role="alert"
        >
          {calculo.mensagem}
        </p>
      )}
      {calculo?.ok && (
        <p className="text-sm text-ink-soft">
          Preço de referência: <span className="font-medium text-ink">{calculo.resultado.fonte.texto}</span>. O
          resultado sai em faixa, com custo por etapa e cronograma.
        </p>
      )}
    </div>
  );
}
