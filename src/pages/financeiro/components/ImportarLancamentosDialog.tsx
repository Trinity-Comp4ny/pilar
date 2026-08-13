import { useMemo, useRef, useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Undo2,
  Upload,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { formatCurrencyInput, formatValorToInput, parseCurrencyString } from "@/lib/currencyUtils";
import { lineHash, type ImportTipoDoc } from "@/lib/importFinanceiro";
import { extrairTextoPdf } from "@/lib/pdfText";
import { useImportFinanceiro, type ItemImport, type ResumoImport } from "../hooks/useImportFinanceiro";

const NONE = "__none__";

const TIPOS: { value: ImportTipoDoc; label: string }[] = [
  { value: "extrato", label: "Extrato bancário" },
  { value: "fatura", label: "Fatura de cartão" },
  { value: "planilha", label: "Planilha de gastos" },
];

const ACCEPT =
  ".pdf,application/pdf,.csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

/** Campo de valor com máscara de Real (R$ 1.234,56), editável. */
function ValorInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [txt, setTxt] = useState(() => formatValorToInput(value));
  return (
    <Input
      value={txt}
      inputMode="numeric"
      className="h-8 text-right tabular-nums"
      onChange={(e) => {
        const formatado = formatCurrencyInput(e.target.value);
        setTxt(formatado);
        onChange(parseCurrencyString(formatado));
      }}
    />
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
}

export function ImportarLancamentosDialog({ open, onOpenChange, onImported }: Props) {
  const { auxQuery, extrairArquivo, extrairTextoIA, gravarLote, desfazer, gravando, temDesfazer } =
    useImportFinanceiro();

  const [tipoDoc, setTipoDoc] = useState<ImportTipoDoc>("extrato");
  const [itens, setItens] = useState<ItemImport[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [textoColado, setTextoColado] = useState("");
  const [fase, setFase] = useState<"idle" | "lendo" | "extraindo">("idle");
  const [contaId, setContaId] = useState<string>(NONE);
  const [projetoId, setProjetoId] = useState<string>(NONE);
  const [resumo, setResumo] = useState<ResumoImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const aux = auxQuery.data;
  const ocupado = fase !== "idle";

  const incluidos = useMemo(() => itens.filter((i) => i.incluir), [itens]);
  const nCriar = incluidos.filter((i) => i.acao === "criar").length;
  const nConciliar = incluidos.filter((i) => i.acao === "conciliar").length;
  const temDuplicata = useMemo(() => itens.some((i) => i.duplicataId), [itens]);
  const totalSaidas = useMemo(
    () => incluidos.filter((i) => i.tipo === "despesa").reduce((s, i) => s + i.valor, 0),
    [incluidos]
  );
  const totalEntradas = useMemo(
    () => incluidos.filter((i) => i.tipo === "receita").reduce((s, i) => s + i.valor, 0),
    [incluidos]
  );
  const todosMarcados = itens.length > 0 && itens.every((i) => i.incluir);

  function atualizar(id: string, campo: Partial<ItemImport>) {
    setItens((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const merged = { ...i, ...campo };
        if ("data" in campo || "descricao" in campo || "valor" in campo) {
          merged.lineHash = lineHash({ data: merged.data, valor: merged.valor, descricao: merged.descricao });
        }
        return merged;
      })
    );
  }

  function definirTipoTodos(tipo: "despesa" | "receita") {
    setItens((prev) => prev.map((i) => (i.tipo === tipo ? i : { ...i, tipo, categoriaId: null })));
  }

  function marcarTodos(incluir: boolean) {
    setItens((prev) => prev.map((i) => ({ ...i, incluir })));
  }

  function removerLinha(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id));
  }

  /** Fatura de cartão: todo movimento é saída, salvo estorno. Reforça o palpite da IA. */
  function comDefaultDoc(lista: ItemImport[]): ItemImport[] {
    if (tipoDoc !== "fatura") return lista;
    return lista.map((i) => (i.tipo === "despesa" ? i : { ...i, tipo: "despesa", categoriaId: null }));
  }

  /** Um único seletor de arquivo: roteia por extensão. PDF → texto local + IA; CSV/Excel → parsing determinístico. */
  async function onArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !aux) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "pdf") {
        setFase("lendo");
        const texto = await extrairTextoPdf(file);
        if (!texto.trim()) {
          toast.error("PDF sem texto legível", {
            description: "Parece um PDF digitalizado (imagem). Copie o texto e cole na caixa abaixo.",
          });
          return;
        }
        await extrair(texto);
      } else {
        setFase("extraindo");
        const r = await extrairArquivo(file, aux);
        setItens(r.itens);
        setAvisos(r.avisos);
        setResumo(null);
        if (r.itens.length === 0) {
          toast.error("Nada reconhecido no arquivo", {
            description: "Confira se a planilha tem data, descrição e valor.",
          });
        }
      }
    } catch (err) {
      toast.error("Erro ao ler arquivo", { description: msg(err) });
    } finally {
      setFase("idle");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function extrair(texto: string) {
    if (!texto.trim() || !aux) return;
    setFase("extraindo");
    try {
      const r = await extrairTextoIA(texto, tipoDoc, aux);
      setItens(comDefaultDoc(r.itens));
      setAvisos(r.avisos);
      setResumo(null);
      if (r.itens.length === 0) {
        toast.error("Nenhum lançamento extraído", { description: "Revise o texto." });
      }
    } catch (err) {
      toast.error("Falha ao extrair", { description: msg(err) });
    } finally {
      setFase("idle");
    }
  }

  async function onConfirmar() {
    if (incluidos.length === 0) return;
    try {
      const r = await gravarLote(itens, {
        contaId: contaId === NONE ? null : contaId,
        projetoId: projetoId === NONE ? null : projetoId,
      });
      setResumo(r);
      setItens([]);
      setAvisos([]);
      setTextoColado("");
      onImported?.();
      toast.success("Importação concluída", {
        description: `${r.criados} lançamento(s) criado(s), ${r.conciliados} conciliado(s).`,
      });
    } catch (err) {
      toast.error("Erro ao gravar", { description: msg(err) });
    }
  }

  async function onDesfazer() {
    try {
      await desfazer();
      setResumo(null);
      onImported?.();
      toast.success("Importação desfeita");
    } catch (err) {
      toast.error("Erro ao desfazer", { description: msg(err) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar lançamentos</DialogTitle>
          <DialogDescription>
            Suba um extrato ou fatura em PDF, CSV ou Excel. A IA extrai os lançamentos e você revisa antes de gravar.
          </DialogDescription>
        </DialogHeader>

        {auxQuery.isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="space-y-4">
            {/* Entrada */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo de documento</label>
                <Select value={tipoDoc} onValueChange={(v) => setTipoDoc(v as ImportTipoDoc)}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Arquivo</label>
                <div>
                  <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onArquivo} />
                  <Button onClick={() => fileRef.current?.click()} disabled={ocupado}>
                    <Upload className="mr-2 h-4 w-4" />
                    {fase === "lendo" ? "Lendo PDF..." : fase === "extraindo" ? "Processando..." : "Escolher arquivo"}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              PDF, CSV ou Excel. O PDF é lido no seu navegador e só o texto vai para a extração, nunca a imagem do
              documento.
            </p>

            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Ou cole o texto do extrato/fatura
              </summary>
              <div className="mt-2 space-y-2">
                <Textarea
                  value={textoColado}
                  onChange={(e) => setTextoColado(e.target.value)}
                  placeholder="Cole aqui as linhas do extrato ou da fatura..."
                  rows={5}
                />
                <Button onClick={() => extrair(textoColado)} disabled={ocupado || !textoColado.trim()}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {fase === "extraindo" ? "Extraindo..." : "Extrair com IA"}
                </Button>
              </div>
            </details>

            {/* Resumo pós-importação */}
            {resumo && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>
                    <strong>{resumo.criados}</strong> criado(s), <strong>{resumo.conciliados}</strong> conciliado(s).
                    Saídas {formatCurrency(resumo.totalDespesa)}, entradas {formatCurrency(resumo.totalReceita)}.
                  </span>
                  {temDesfazer && (
                    <Button variant="outline" size="sm" onClick={onDesfazer}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      Desfazer
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Avisos */}
            {avisos.length > 0 && (
              <div className="rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2 font-medium text-warning-strong">
                  <AlertTriangle className="h-4 w-4" />
                  {avisos.length} linha(s) não interpretada(s)
                </div>
                <ul className="mt-1 list-disc pl-6 text-xs text-muted-foreground">
                  {avisos.slice(0, 8).map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview */}
            {itens.length > 0 && aux && (
              <div className="space-y-4">
                {temDuplicata && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Alguns lançamentos batem com contas já cadastradas como pendentes (mesmo valor e data próxima). Na
                      coluna <strong>Situação</strong> você escolhe: <strong>marcar como pago</strong> a conta que já
                      existe, ou <strong>criar novo</strong> lançamento à parte.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Ações em massa */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Conta bancária (todas)</label>
                    <Select value={contaId} onValueChange={setContaId}>
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhuma</SelectItem>
                        {aux.contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} {c.banco ? `· ${c.banco}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Projeto (todos, opcional)</label>
                    <Select value={projetoId} onValueChange={setProjetoId}>
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nenhum</SelectItem>
                        {aux.projetos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Marcar todos como</label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => definirTipoTodos("despesa")}>
                        <ArrowDownLeft className="mr-1 h-4 w-4 text-destructive" />
                        Saída
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => definirTipoTodos("receita")}>
                        <ArrowUpRight className="mr-1 h-4 w-4 text-positive" />
                        Entrada
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Totais */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span>
                    <span className="text-muted-foreground">Selecionados:</span> <strong>{incluidos.length}</strong> de{" "}
                    {itens.length}
                  </span>
                  <span>
                    <span className="text-muted-foreground">A criar:</span> <strong>{nCriar}</strong>
                  </span>
                  <span>
                    <span className="text-muted-foreground">A conciliar:</span> <strong>{nConciliar}</strong>
                  </span>
                  <span className="text-destructive">
                    <span className="text-muted-foreground">Saídas:</span> {formatCurrency(totalSaidas)}
                  </span>
                  <span className="text-positive">
                    <span className="text-muted-foreground">Entradas:</span> {formatCurrency(totalEntradas)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={todosMarcados}
                            onCheckedChange={(v) => marcarTodos(Boolean(v))}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead className="w-36">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-32">Valor</TableHead>
                        <TableHead className="w-28">Tipo</TableHead>
                        <TableHead className="w-48">Categoria</TableHead>
                        <TableHead className="w-40">
                          <span className="inline-flex items-center gap-1">
                            Situação
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-64">
                                Se o lançamento bate com uma conta pendente já cadastrada, marque a existente como paga
                                em vez de criar duplicada.
                              </TooltipContent>
                            </Tooltip>
                          </span>
                        </TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((it) => {
                        const cats = aux.categorias.filter((c) => !c.tipo || c.tipo.toLowerCase() === it.tipo);
                        return (
                          <TableRow key={it.id} className={it.incluir ? "" : "opacity-50"}>
                            <TableCell>
                              <Checkbox
                                checked={it.incluir}
                                onCheckedChange={(v) => atualizar(it.id, { incluir: Boolean(v) })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                value={it.data}
                                onChange={(e) => atualizar(it.id, { data: e.target.value })}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={it.descricao}
                                  onChange={(e) => atualizar(it.id, { descricao: e.target.value })}
                                  className="h-8"
                                />
                                {it.confianca < 0.6 && (
                                  <Badge variant="outline" className="shrink-0 text-warning-strong">
                                    revisar
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <ValorInput value={it.valor} onChange={(n) => atualizar(it.id, { valor: n })} />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 w-full justify-start"
                                onClick={() =>
                                  atualizar(it.id, {
                                    tipo: it.tipo === "despesa" ? "receita" : "despesa",
                                    categoriaId: null,
                                  })
                                }
                              >
                                {it.tipo === "despesa" ? (
                                  <>
                                    <ArrowDownLeft className="mr-1 h-4 w-4 text-destructive" />
                                    Saída
                                  </>
                                ) : (
                                  <>
                                    <ArrowUpRight className="mr-1 h-4 w-4 text-positive" />
                                    Entrada
                                  </>
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={it.categoriaId ?? NONE}
                                onValueChange={(v) => atualizar(it.id, { categoriaId: v === NONE ? null : v })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Sem categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NONE}>Sem categoria</SelectItem>
                                  {cats.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {it.duplicataId ? (
                                <button
                                  type="button"
                                  className="text-left"
                                  onClick={() =>
                                    atualizar(it.id, { acao: it.acao === "conciliar" ? "criar" : "conciliar" })
                                  }
                                >
                                  {it.acao === "conciliar" ? (
                                    <Badge className="bg-brand text-ink">marcar como pago</Badge>
                                  ) : (
                                    <Badge variant="outline">criar novo</Badge>
                                  )}
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">novo</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removerLinha(it.id)}
                                aria-label="Remover linha"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setItens([])}>
                    Limpar
                  </Button>
                  <Button onClick={onConfirmar} disabled={gravando || incluidos.length === 0}>
                    {gravando ? "Gravando..." : `Importar ${incluidos.length} lançamento(s)`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Erro inesperado";
}
