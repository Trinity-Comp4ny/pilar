import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Info } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { KPICard } from "@/components/KPICard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rotuloMesBase } from "@/lib/estimativaObra";
import { formatDateTime, formatNumber } from "@/lib/format";
import { UFS, type Regime } from "@/schemas/estimativaObra";
import { toDataSourceResult } from "@/types/dataSource";
import { gravarSinapi, lerAbasSinapi, useParametrosEstimativa, useSinapiGravado } from "../estimativaAdmin";
import {
  codigosDoCatalogo,
  interpretarSinapi,
  resumirSinapi,
  type CoberturaDoCodigo,
  type LinhaSinapiLida,
  type ResumoSinapi,
} from "../estimativaSinapiImport";
import { useAcaoEmpresa } from "../hooks";

const ERROS_VISIVEIS = 30;

const REGIME_ROTULO: Record<Regime, string> = { onerado: "Sem desoneração", desonerado: "Com desoneração" };

const colunasCobertura: ColumnDef<CoberturaDoCodigo>[] = [
  { key: "item", header: "Item do catálogo", cell: (c) => c.rotulo, mobile: "title" },
  { key: "codigo", header: "Código", cell: (c) => c.codigo, className: "tabular-nums", mobile: "subtitle" },
  { key: "regime", header: "Regime", cell: (c) => REGIME_ROTULO[c.regime], mobile: "badge" },
  {
    key: "ufs",
    header: "UFs com preço",
    align: "end",
    getSortValue: (c) => c.ufs,
    cell: (c) => (c.ufs === 0 ? <Badge variant="warning">nenhuma</Badge> : `${formatNumber(c.ufs)} de ${UFS.length}`),
    className: "tabular-nums",
    mobile: "trailing",
  },
];

const colunasMeses: ColumnDef<ResumoSinapi>[] = [
  {
    key: "mes",
    header: "Mês-base",
    getSortValue: (m) => m.mesBase,
    cell: (m) => <span className="font-medium text-ink">{rotuloMesBase(m.mesBase)}</span>,
    mobile: "title",
  },
  { key: "regime", header: "Regime", cell: (m) => REGIME_ROTULO[m.regime] },
  {
    key: "codigos",
    header: "Itens",
    align: "end",
    cell: (m) => formatNumber(m.codigos),
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
 * SINAPI mensal (SPEC 137, BEZ-69). O ultra admin envia o relatório de referência da Caixa e vê a prévia
 * antes de gravar. O mês e o regime vêm do próprio arquivo, e só os códigos do catálogo da estimativa são
 * guardados. Nada é gravado enquanto houver erro.
 */
export function SinapiImportacao() {
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<{ nome: string; abas: Awaited<ReturnType<typeof lerAbasSinapi>> } | null>(
    null
  );
  const [lendo, setLendo] = useState(false);

  const parametros = useParametrosEstimativa();
  const catalogo = useMemo(
    () => codigosDoCatalogo(parametros.data?.parametros.adicionais ?? {}),
    [parametros.data?.parametros.adicionais]
  );

  const gravado = useSinapiGravado();
  const gravadas = useMemo(() => gravado.data ?? [], [gravado.data]);
  const resumos = useMemo(() => resumirSinapi(gravadas), [gravadas]);
  const maisRecente = resumos[0]?.mesBase ?? null;
  const codigosNoMes = maisRecente
    ? Math.max(...resumos.filter((r) => r.mesBase === maisRecente).map((r) => r.codigos))
    : 0;

  const resultado = useMemo(() => (arquivo ? interpretarSinapi(arquivo.abas, catalogo) : null), [arquivo, catalogo]);
  const jaImportado = resultado?.mesBase
    ? resumos.filter((r) => r.mesBase === resultado.mesBase && resultado.regimes.includes(r.regime))
    : [];

  const importar = useAcaoEmpresa({
    run: (e: { linhas: LinhaSinapiLida[]; fonte: string }) => gravarSinapi(e.linhas, e.fonte),
    sucesso: (e) =>
      `SINAPI de ${rotuloMesBase(e.linhas[0].mes_base)} importado: ${formatNumber(e.linhas.length)} preços.`,
    erro: "Não foi possível importar o SINAPI",
    contexto: "ultra-admin:estimativa-sinapi",
  });

  const escolherArquivo = async (file: File | undefined) => {
    if (!file) return;
    setLendo(true);
    try {
      setArquivo({ nome: file.name, abas: await lerAbasSinapi(file) });
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
          <span>Não foi possível carregar o SINAPI já importado. Os números abaixo podem estar incompletos.</span>
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
          label="Itens do catálogo com preço"
          value={`${codigosNoMes} de ${catalogo.size}`}
          subtitle={maisRecente ? `em ${rotuloMesBase(maisRecente)}` : undefined}
          loading={gravado.isLoading || parametros.isLoading}
        />
        <KPICard label="Preços gravados" value={formatNumber(gravadas.length)} loading={gravado.isLoading} />
      </div>

      <input
        ref={entrada}
        type="file"
        accept=".xlsx"
        className="sr-only"
        aria-label="Relatório do SINAPI"
        onChange={(e) => void escolherArquivo(e.target.files?.[0])}
      />

      {semNada ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={FileSpreadsheet}
            iconTone="brand"
            title="Nenhum SINAPI importado"
            description="Sem o SINAPI, os itens do catálogo que dependem dele ficam sem preço de referência. Envie o relatório do mês e o Pilar confere antes de gravar."
            action={{ label: "Escolher o relatório", onClick: () => entrada.current?.click(), variant: "brand" }}
          >
            <p className="mt-3 text-xs text-ink-soft">
              Arquivo SINAPI_Referência_AAAA_MM.xlsx, de dentro do zip que a Caixa publica perto do dia 9.
            </p>
          </EmptyState>
        </div>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-5" aria-labelledby="sinapi-importar">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="sinapi-importar" className="text-base font-semibold text-ink">
                Importar o SINAPI de um mês
              </h2>
              <p className="max-w-xl text-sm text-ink-soft">
                O mês e o regime vêm das abas ISD (sem desoneração) e ICD (com desoneração). Só os preços dos itens do
                catálogo são guardados.
              </p>
            </div>
            <Button variant={arquivo ? "outline" : "brand"} loading={lendo} onClick={() => entrada.current?.click()}>
              {arquivo ? "Trocar o relatório" : "Escolher o relatório"}
            </Button>
          </div>

          {resultado && arquivo && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                <span className="text-sm font-medium text-ink">{arquivo.nome}</span>
                {!resultado.erroGeral && resultado.mesBase && (
                  <>
                    <Badge variant="info">{rotuloMesBase(resultado.mesBase)}</Badge>
                    {resultado.regimes.map((r) => (
                      <Badge key={r} variant="info">
                        {REGIME_ROTULO[r]}
                      </Badge>
                    ))}
                    <Badge variant="success">
                      {formatNumber(resultado.linhas.length)} {resultado.linhas.length === 1 ? "preço" : "preços"}
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
                  <p className="mb-2">Confira o arquivo da Caixa e envie de novo.</p>
                  <ul className="space-y-0.5">
                    {resultado.erros.slice(0, ERROS_VISIVEIS).map((e, i) => (
                      <li key={`${e.aba}-${e.linha}-${i}`}>
                        <span className="tabular-nums font-medium">
                          Aba {e.aba}, linha {e.linha}:
                        </span>{" "}
                        {e.mensagem}
                      </li>
                    ))}
                  </ul>
                  {resultado.erros.length > ERROS_VISIVEIS && (
                    <p className="mt-1">e mais {formatNumber(resultado.erros.length - ERROS_VISIVEIS)}.</p>
                  )}
                </div>
              )}

              {jaImportado.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm text-info-strong">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {rotuloMesBase(jaImportado[0].mesBase)} já foi importado. Importar de novo corrige os preços desse
                    mês; as estimativas já salvas guardam o valor da versão e não mudam.
                  </span>
                </p>
              )}

              {!resultado.erroGeral && resultado.cobertura.length > 0 && (
                <DataTable
                  columns={colunasCobertura}
                  data={toDataSourceResult<CoberturaDoCodigo>({ data: resultado.cobertura })}
                  rowKey={(c) => `${c.codigo}-${c.regime}`}
                  density="compact"
                />
              )}

              {resultado.semPreco.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm text-info-strong">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Sem preço em nenhuma UF neste mês:{" "}
                    {resultado.semPreco.map((s) => `${s.rotulo} (${s.codigo})`).join(", ")}. Esses itens ficam "a
                    definir" ou com o valor da empresa ou do usuário.
                  </span>
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button
                  variant="brand"
                  disabled={!podeImportar}
                  loading={importar.isPending}
                  onClick={() =>
                    importar.mutate(
                      {
                        linhas: resultado.linhas,
                        fonte: `SINAPI ${rotuloMesBase(resultado.mesBase ?? "")} (${arquivo.nome})`.slice(0, 200),
                      },
                      { onSuccess: () => setArquivo(null) }
                    )
                  }
                >
                  {podeImportar
                    ? `Importar ${formatNumber(resultado.linhas.length)} ${resultado.linhas.length === 1 ? "preço" : "preços"}`
                    : "Importar"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {resumos.length > 0 && (
        <section className="space-y-2" aria-labelledby="sinapi-meses">
          <h2 id="sinapi-meses" className="text-base font-semibold text-ink">
            Meses importados
          </h2>
          <DataTable
            columns={colunasMeses}
            data={toDataSourceResult<ResumoSinapi>({ data: resumos })}
            rowKey={(m) => `${m.mesBase}-${m.regime}`}
          />
        </section>
      )}

      <p className="text-xs text-ink-soft">
        O SINAPI traz custo direto, sem administração, com preço de insumo de linha corrente. Confira os termos de uso
        da Caixa antes de mostrar esses preços a terceiros.
      </p>
    </div>
  );
}
