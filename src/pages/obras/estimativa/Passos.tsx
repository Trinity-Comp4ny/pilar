import { Building2, Factory, Home, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { avisosCoerencia, rotuloPadrao, type SaidaCalculo } from "@/lib/estimativaObra";
import { PADROES, SUBTIPOS, type Ficha, type Padrao, type TipoObra } from "@/schemas/estimativaObra";
import { Campo, CampoNumero, Contador, Pilula } from "./componentes";
import {
  PADRAO_INFO,
  PASSO_ROTULO,
  TIPO_INFO,
  UFS_ORDENADAS,
  UF_NOME,
  proximosMeses,
  rotuloMes,
  type ErrosDaFicha,
  type Passo,
} from "./lib";

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
  const meses = useMemo(() => {
    const lista = proximosMeses(new Date());
    return lista.some((m) => m.valor === ficha.inicio)
      ? lista
      : [{ valor: ficha.inicio, rotulo: rotuloMes(ficha.inicio) }, ...lista];
  }, [ficha.inicio]);

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
      <Campo id="est-inicio" rotulo="Início previsto" erro={erros.inicio}>
        <Select value={ficha.inicio} onValueChange={(v) => atualizar("inicio", v)}>
          <SelectTrigger id="est-inicio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meses.map((m) => (
              <SelectItem key={m.valor} value={m.valor}>
                {m.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <fieldset className="sm:col-span-2">
        <legend className="mb-1.5 text-sm font-medium text-ink-soft">Relevo do terreno</legend>
        <div className="flex flex-wrap gap-2">
          {TOPOGRAFIAS_OPCOES.map((t) => (
            <Pilula key={t.valor} ativa={ficha.topografia === t.valor} onClick={() => atualizar("topografia", t.valor)}>
              {t.rotulo}
            </Pilula>
          ))}
        </div>
        {ficha.topografia === "inclinado" && (
          <div className="mt-3 sm:max-w-[calc(50%-0.5rem)]">
            <Campo
              id="est-arrimo"
              rotulo="Muro de arrimo"
              dica="Comprimento vezes altura média, em m². Sem a medida, o item fica a definir. Terraplenagem e fundação especial dependem de levantamento topográfico e sondagem."
              erro={erros.arrimo}
            >
              <CampoNumero
                id="est-arrimo"
                valor={ficha.arrimo}
                onChange={(n) => atualizar("arrimo", n)}
                sufixo="m²"
                erro={erros.arrimo}
              />
            </Campo>
          </div>
        )}
      </fieldset>
    </div>
  );
}

const TOPOGRAFIAS_OPCOES: { valor: Ficha["topografia"]; rotulo: string }[] = [
  { valor: "plano", rotulo: "Plano" },
  { valor: "inclinado", rotulo: "Inclinado, precisa de contenção" },
];

const NIVEIS_MARCENARIA: { valor: Ficha["marcenaria"]; rotulo: string }[] = [
  { valor: "nenhuma", rotulo: "Nenhuma" },
  { valor: "basica", rotulo: "Básica" },
  { valor: "completa", rotulo: "Completa" },
];

export function PassoPrograma({ ficha, atualizar, erros }: PassoProps) {
  const residencial = ficha.tipo === "residencial";
  const itens: { campo: "gourmet" | "elevador" | "subsolo" | "paisagismo"; rotulo: string; so?: "residencial" }[] = [
    { campo: "gourmet", rotulo: "Área gourmet", so: "residencial" },
    { campo: "elevador", rotulo: "Elevador" },
    { campo: "subsolo", rotulo: "Subsolo" },
    { campo: "paisagismo", rotulo: "Paisagismo" },
  ];
  return (
    <div className="space-y-6">
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
        {residencial && (
          <Campo id="est-piscina" rotulo="Piscina" erro={erros.piscina} dica="Deixe 0 se não tiver.">
            <CampoNumero
              id="est-piscina"
              valor={ficha.piscina}
              onChange={(n) => atualizar("piscina", n)}
              sufixo="m²"
              erro={erros.piscina}
            />
          </Campo>
        )}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Itens da obra</legend>
        <div className="flex flex-wrap gap-2">
          {itens
            .filter((i) => !i.so || residencial)
            .map((i) => (
              <Pilula key={i.campo} ativa={ficha[i.campo]} onClick={() => atualizar(i.campo, !ficha[i.campo])}>
                {i.rotulo}
              </Pilula>
            ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-soft">Marcenaria e móveis planejados</legend>
        <div className="flex flex-wrap gap-2">
          {NIVEIS_MARCENARIA.map((n) => (
            <Pilula key={n.valor} ativa={ficha.marcenaria === n.valor} onClick={() => atualizar("marcenaria", n.valor)}>
              {n.rotulo}
            </Pilula>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-ink-soft">
        O que não está no CUB (fundação, piscina, marcenaria, paisagismo, elevador) entra como adicional, com valor
        próprio.
      </p>
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
  const adicionais = [
    ficha.tipo === "residencial" && ficha.piscina > 0 && `piscina de ${ficha.piscina.toLocaleString("pt-BR")} m²`,
    ficha.tipo === "residencial" && ficha.gourmet && "área gourmet",
    ficha.elevador && "elevador",
    ficha.subsolo && "subsolo",
    ficha.paisagismo && "paisagismo",
    ficha.marcenaria !== "nenhuma" && `marcenaria ${ficha.marcenaria === "basica" ? "básica" : "completa"}`,
  ].filter(Boolean);

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
          valor={`${UF_NOME[ficha.uf]} (${ficha.uf}) · início em ${rotuloMes(ficha.inicio)}`}
          passo="local"
          onEditar={onEditar}
        />
        <LinhaRevisao
          rotulo="Tamanho"
          valor={`${ficha.area.toLocaleString("pt-BR")} m² em ${ficha.pavimentos} pavimento${ficha.pavimentos > 1 ? "s" : ""} · terreno de ${ficha.terreno.toLocaleString("pt-BR")} m²`}
          passo="local"
          onEditar={onEditar}
        />
        <LinhaRevisao
          rotulo="Terreno"
          valor={
            ficha.topografia === "inclinado"
              ? ficha.arrimo > 0
                ? `inclinado, com ${ficha.arrimo.toLocaleString("pt-BR")} m² de muro de arrimo`
                : "inclinado, muro de arrimo a medir"
              : "plano"
          }
          passo="local"
          onEditar={onEditar}
        />
        <LinhaRevisao rotulo="Programa" valor={programa.join(" · ")} passo="programa" onEditar={onEditar} />
        <LinhaRevisao
          rotulo="Adicionais"
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
