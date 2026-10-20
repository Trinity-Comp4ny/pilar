import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Info } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { KPICard } from "@/components/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rotuloMesBase, rotuloRegime } from "@/lib/estimativaObra";
import {
  coberturaDoMes,
  interpretarPlanilhaCub,
  opcoesMesBase,
  resumirMeses,
  type LinhaCubLida,
  type ResumoMes,
} from "../estimativaCubImport";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { REGIMES, UFS, type Regime } from "@/schemas/estimativaObra";
import { toDataSourceResult } from "@/types/dataSource";
import { gravarCub, lerCelulas, useCubGravado } from "../estimativaAdmin";
import { useAcaoEmpresa } from "../hooks";

const LINHAS_NA_PREVIA = 50;
const ERROS_VISIVEIS = 30;

const PADRAO_ROTULO: Record<string, string> = { baixo: "Baixo", normal: "Normal", alto: "Alto", unico: "Único" };
const REGIME_ROTULO: Record<Regime, string> = { onerado: "Sem desoneração", desonerado: "Com desoneração" };

const colunasPrevia: ColumnDef<LinhaCubLida>[] = [
  { key: "linha", header: "Linha", getSortValue: (l) => l.linha, cell: (l) => l.linha, className: "tabular-nums" },
  { key: "uf", header: "UF", getSortValue: (l) => l.uf, cell: (l) => l.uf, mobile: "title" },
  { key: "subtipo", header: "Subtipo", getSortValue: (l) => l.subtipo, cell: (l) => l.subtipo, mobile: "subtitle" },
  { key: "padrao", header: "Padrão", cell: (l) => PADRAO_ROTULO[l.padrao], mobile: "badge" },
  {
    key: "valor",
    header: "R$/m²",
    align: "end",
    getSortValue: (l) => l.valor_m2,
    cell: (l) => formatCurrency(l.valor_m2),
    className: "tabular-nums",
    mobile: "trailing",
  },
];

const colunasMeses: ColumnDef<ResumoMes>[] = [
  {
    key: "mes",
    header: "Mês-base",
    getSortValue: (m) => m.mesBase,
    cell: (m) => <span className="font-medium text-ink">{rotuloMesBase(m.mesBase)}</span>,
    mobile: "title",
  },
  { key: "regime", header: "Regime", cell: (m) => REGIME_ROTULO[m.regime] },
  {
    key: "linhas",
    header: "Linhas",
    align: "end",
    cell: (m) => formatNumber(m.linhas),
    className: "tabular-nums",
    mobile: "trailing",
  },
  {
    key: "ufs",
    header: "UFs",
    align: "end",
    cell: (m) => `${m.ufs} de ${UFS.length}`,
    className: "tabular-nums",
    mobile: "subtitle",
  },
  { key: "quando", header: "Última importação", cell: (m) => formatDateTime(m.ultimaImportacao) },
];

/**
 * CUB mensal (SPEC 136, BEZ-13). O ultra admin escolhe o mês-base, envia a planilha e vê a prévia com os
 * erros por linha antes de gravar. Nada é gravado enquanto houver erro.
 */
export function CubImportacao() {
  const entrada = useRef<HTMLInputElement>(null);
  const opcoes = useMemo(() => opcoesMesBase(new Date()), []);
  // A tabela de um mês costuma sair no começo do mês seguinte: o padrão é o mês anterior.
  const [mes, setMes] = useState(opcoes[1].valor);
  // Sem desoneração é a série clássica do CUB e a que a estimativa usa quando ninguém escolhe.
  const [regime, setRegime] = useState<Regime>("onerado");
  const [arquivo, setArquivo] = useState<{ nome: string; celulas: string[][] } | null>(null);
  const [lendo, setLendo] = useState(false);

  const gravado = useCubGravado();
  const gravadas = useMemo(() => gravado.data ?? [], [gravado.data]);
  const resumos = useMemo(() => resumirMeses(gravadas), [gravadas]);
  const maisRecente = resumos[0]?.mesBase ?? null;
  // A cobertura é do regime escolhido, no mês mais novo que ele tem.
  const maisRecenteDoRegime = resumos.find((r) => r.regime === regime)?.mesBase ?? null;
  const cobertura = useMemo(
    () => (maisRecenteDoRegime ? coberturaDoMes(gravadas, maisRecenteDoRegime, regime) : null),
    [gravadas, maisRecenteDoRegime, regime]
  );

  const resultado = useMemo(
    () => (arquivo ? interpretarPlanilhaCub(arquivo.celulas, mes, regime) : null),
    [arquivo, mes, regime]
  );
  const mesJaImportado = resumos.find((r) => r.mesBase === mes && r.regime === regime);

  const importar = useAcaoEmpresa({
    run: (entradaImportar: { linhas: LinhaCubLida[]; fonte: string }) =>
      gravarCub(entradaImportar.linhas, entradaImportar.fonte),
    sucesso: (e) =>
      `CUB de ${rotuloMesBase(e.linhas[0].mes_base)} (${rotuloRegime(e.linhas[0].regime)}) importado: ${formatNumber(e.linhas.length)} linhas.`,
    erro: "Não foi possível importar o CUB",
    contexto: "ultra-admin:estimativa-cub",
  });

  const escolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    setLendo(true);
    try {
      setArquivo({ nome: file.name, celulas: await lerCelulas(file) });
    } catch (e) {
      toast.error("Não foi possível ler a planilha", {
        description: e instanceof Error ? e.message : "Tente de novo com outro arquivo.",
      });
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const podeImportar =
    !!resultado && !resultado.erroGeral && resultado.erros.length === 0 && resultado.linhas.length > 0;
  const semNada = !gravado.isLoading && !gravado.error && gravadas.length === 0 && !arquivo;

  return (
    <div className="space-y-4">
      {gravado.error && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger-mid bg-danger-soft px-3 py-2 text-sm text-danger-strong"
          role="alert"
        >
          <span>Não foi possível carregar o CUB já importado. Os números abaixo podem estar incompletos.</span>
          <Button variant="outline" size="sm" onClick={() => void gravado.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <KPICard
          label="Mês-base mais recente"
          value={maisRecente ? rotuloMesBase(maisRecente) : "Nenhum"}
          loading={gravado.isLoading}
        />
        <KPICard
          label="UFs com tabela"
          value={cobertura ? `${cobertura.com.length} de ${UFS.length}` : "0"}
          subtitle={
            maisRecenteDoRegime ? `${rotuloRegime(regime)}, em ${rotuloMesBase(maisRecenteDoRegime)}` : undefined
          }
          loading={gravado.isLoading}
        />
        <KPICard label="Linhas gravadas" value={formatNumber(gravadas.length)} loading={gravado.isLoading} />
      </div>

      <input
        ref={entrada}
        type="file"
        accept=".xlsx,.xls,.csv,.txt"
        className="sr-only"
        aria-label="Planilha do CUB"
        onChange={(e) => void escolherArquivo(e.target.files?.[0])}
      />

      {semNada ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={FileSpreadsheet}
            iconTone="brand"
            title="Nenhum CUB importado"
            description="Sem o CUB, nenhuma empresa consegue gerar estimativa. Envie a planilha do mês (UF, código do CUB e valor por m²) e o Pilar confere antes de gravar."
            action={{ label: "Escolher a planilha", onClick: () => entrada.current?.click(), variant: "brand" }}
          >
            <p className="mt-3 text-xs text-ink-soft">Aceita .xlsx e .csv, até 5 MB.</p>
          </EmptyState>
        </div>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-5" aria-labelledby="cub-importar">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="cub-importar" className="text-base font-semibold text-ink">
                Importar o CUB de um mês
              </h2>
              <p className="text-sm text-ink-soft">
                Planilha com UF, código do CUB (ex.: R1-A) e valor por m². Uma planilha por regime.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-44">
                <label htmlFor="cub-regime" className="mb-1 block text-xs font-medium text-ink-soft">
                  Regime
                </label>
                <Select value={regime} onValueChange={(v) => setRegime(v as Regime)}>
                  <SelectTrigger id="cub-regime">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {REGIME_ROTULO[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label htmlFor="cub-mes" className="mb-1 block text-xs font-medium text-ink-soft">
                  Mês-base
                </label>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger id="cub-mes">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoes.map((o) => (
                      <SelectItem key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant={arquivo ? "outline" : "brand"} loading={lendo} onClick={() => entrada.current?.click()}>
                {arquivo ? "Trocar a planilha" : "Escolher a planilha"}
              </Button>
            </div>
          </div>

          {mesJaImportado && (
            <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm text-info-strong">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {rotuloMesBase(mes)} ({rotuloRegime(regime)}) já tem {formatNumber(mesJaImportado.linhas)}{" "}
                {mesJaImportado.linhas === 1 ? "linha" : "linhas"}. Importar de novo corrige os valores desse mês; as
                estimativas já salvas guardam o valor da versão e não mudam.
              </span>
            </p>
          )}

          {resultado && arquivo && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">{arquivo.nome}</span>
                {!resultado.erroGeral && (
                  <>
                    <Badge variant="success">
                      {formatNumber(resultado.linhas.length)} {resultado.linhas.length === 1 ? "pronta" : "prontas"}
                    </Badge>
                    {resultado.erros.length > 0 && (
                      <Badge variant="warning">
                        {formatNumber(resultado.erros.length)} com {resultado.erros.length === 1 ? "erro" : "erros"}
                      </Badge>
                    )}
                  </>
                )}
              </div>

              {resultado.erroGeral && (
                <p
                  className="rounded-lg border border-warning-mid bg-warning-soft px-3 py-2 text-sm text-warning-strong"
                  role="alert"
                >
                  {resultado.erroGeral}
                </p>
              )}

              {resultado.erros.length > 0 && (
                <div
                  className="rounded-lg border border-warning-mid bg-warning-soft px-3 py-3 text-sm text-warning-strong"
                  role="alert"
                >
                  <p className="font-medium">Não gravamos nada enquanto houver erro.</p>
                  <p className="mb-2">Corrija as linhas na planilha e envie de novo.</p>
                  <ul className="space-y-0.5">
                    {resultado.erros.slice(0, ERROS_VISIVEIS).map((e) => (
                      <li key={e.linha}>
                        <span className="tabular-nums font-medium">Linha {e.linha}:</span> {e.mensagem}
                      </li>
                    ))}
                  </ul>
                  {resultado.erros.length > ERROS_VISIVEIS && (
                    <p className="mt-1">e mais {formatNumber(resultado.erros.length - ERROS_VISIVEIS)}.</p>
                  )}
                </div>
              )}

              {resultado.linhas.length > 0 && (
                <div className="space-y-2">
                  <DataTable
                    columns={colunasPrevia}
                    data={toDataSourceResult<LinhaCubLida>({ data: resultado.linhas.slice(0, LINHAS_NA_PREVIA) })}
                    rowKey={(l) => `${l.uf}-${l.subtipo}-${l.padrao}`}
                    density="compact"
                  />
                  {resultado.linhas.length > LINHAS_NA_PREVIA && (
                    <p className="text-xs text-ink-soft">
                      Mostrando {LINHAS_NA_PREVIA} de {formatNumber(resultado.linhas.length)} linhas.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  variant="brand"
                  disabled={!podeImportar}
                  loading={importar.isPending}
                  onClick={() =>
                    importar.mutate(
                      { linhas: resultado.linhas, fonte: `Planilha importada: ${arquivo.nome}`.slice(0, 200) },
                      { onSuccess: () => setArquivo(null) }
                    )
                  }
                >
                  {podeImportar
                    ? `Importar ${formatNumber(resultado.linhas.length)} ${resultado.linhas.length === 1 ? "linha" : "linhas"}`
                    : "Importar"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {cobertura && maisRecenteDoRegime && maisRecente && (
        <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5" aria-labelledby="cub-cobertura">
          <h2 id="cub-cobertura" className="text-base font-semibold text-ink">
            Cobertura por UF em {rotuloMesBase(maisRecenteDoRegime ?? maisRecente)} ({rotuloRegime(regime)})
          </h2>
          <ul className="flex flex-wrap gap-1.5" aria-label="UFs com e sem tabela">
            {UFS.map((uf) => {
              const tem = cobertura.com.includes(uf);
              return (
                <li key={uf}>
                  <Badge variant={tem ? "success" : "warning"}>
                    {uf}
                    <span className="sr-only">{tem ? " com tabela" : " sem tabela"}</span>
                  </Badge>
                </li>
              );
            })}
          </ul>
          {cobertura.sem.length > 0 && (
            <p className="text-sm text-ink-soft">
              Uma obra em UF sem tabela usa a UF mais próxima com tabela, e a faixa de custo fica mais larga, com aviso.
            </p>
          )}
        </section>
      )}

      {resumos.length > 0 && (
        <section className="space-y-2" aria-labelledby="cub-meses">
          <h2 id="cub-meses" className="text-base font-semibold text-ink">
            Meses importados
          </h2>
          <DataTable
            columns={colunasMeses}
            data={toDataSourceResult<ResumoMes>({ data: resumos })}
            rowKey={(m) => m.mesBase}
          />
        </section>
      )}
    </div>
  );
}
