import { useMemo, useRef, useState } from "react";
import { Sparkles, AlertTriangle, Undo2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { lineHash, type ImportTipoDoc } from "@/lib/importFinanceiro";
import { useImportFinanceiro, type ItemImport, type ResumoImport } from "../hooks/useImportFinanceiro";

const NONE = "__none__";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TIPOS: { value: ImportTipoDoc; label: string }[] = [
  { value: "extrato", label: "Extrato bancário" },
  { value: "fatura", label: "Fatura de cartão" },
  { value: "planilha", label: "Planilha de gastos" },
];

export default function ImportarFinanceiro() {
  const { auxQuery, extrairCsv, extrairTextoIA, gravarLote, desfazer, gravando, temDesfazer } = useImportFinanceiro();
  const { toast } = useToast();

  const [tipoDoc, setTipoDoc] = useState<ImportTipoDoc>("extrato");
  const [itens, setItens] = useState<ItemImport[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [textoColado, setTextoColado] = useState("");
  const [extraindo, setExtraindo] = useState(false);
  const [contaId, setContaId] = useState<string>(NONE);
  const [projetoId, setProjetoId] = useState<string>(NONE);
  const [resumo, setResumo] = useState<ResumoImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const aux = auxQuery.data;

  const incluidos = useMemo(() => itens.filter((i) => i.incluir), [itens]);
  const nCriar = incluidos.filter((i) => i.acao === "criar").length;
  const nConciliar = incluidos.filter((i) => i.acao === "conciliar").length;

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

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !aux) return;
    setExtraindo(true);
    try {
      const r = await extrairCsv(file, aux);
      setItens(r.itens);
      setAvisos(r.avisos);
      setResumo(null);
      if (r.itens.length === 0) {
        toast({
          title: "Nada reconhecido no arquivo",
          description: "Confira se é um CSV de extrato com data, descrição e valor.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Erro ao ler arquivo", description: msg(err), variant: "destructive" });
    } finally {
      setExtraindo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onExtrairTexto() {
    if (!textoColado.trim() || !aux) return;
    setExtraindo(true);
    try {
      const r = await extrairTextoIA(textoColado, tipoDoc, aux);
      setItens(r.itens);
      setAvisos(r.avisos);
      setResumo(null);
      if (r.itens.length === 0) {
        toast({ title: "Nenhum lançamento extraído", description: "Revise o texto colado.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Falha ao extrair", description: msg(err), variant: "destructive" });
    } finally {
      setExtraindo(false);
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
      toast({
        title: "Importação concluída",
        description: `${r.criados} lançamento(s) criado(s), ${r.conciliados} conciliado(s).`,
      });
    } catch (err) {
      toast({ title: "Erro ao gravar", description: msg(err), variant: "destructive" });
    }
  }

  async function onDesfazer() {
    try {
      await desfazer();
      setResumo(null);
      toast({ title: "Importação desfeita" });
    } catch (err) {
      toast({ title: "Erro ao desfazer", description: msg(err), variant: "destructive" });
    }
  }

  if (auxQuery.isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      {/* Entrada */}
      <Card className="p-4 space-y-4">
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
            <label className="text-xs text-muted-foreground">Planilha (CSV)</label>
            <div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={extraindo}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Escolher CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Ou cole o texto do extrato/fatura (PDF). O texto é lido no seu navegador e só o texto vai para a extração,
            nunca a imagem do documento.
          </label>
          <Textarea
            value={textoColado}
            onChange={(e) => setTextoColado(e.target.value)}
            placeholder="Cole aqui as linhas do extrato ou da fatura..."
            rows={5}
          />
          <div>
            <Button onClick={onExtrairTexto} disabled={extraindo || !textoColado.trim()}>
              <Sparkles className="mr-2 h-4 w-4" />
              {extraindo ? "Extraindo..." : "Extrair com IA"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Resumo pós-importação */}
      {resumo && (
        <Card className="p-4 flex items-center justify-between">
          <div className="text-sm">
            <strong>{resumo.criados}</strong> criado(s), <strong>{resumo.conciliados}</strong> conciliado(s). Saídas{" "}
            {fmtBRL(resumo.totalDespesa)}, entradas {fmtBRL(resumo.totalReceita)}.
          </div>
          {temDesfazer && (
            <Button variant="outline" size="sm" onClick={onDesfazer}>
              <Undo2 className="mr-2 h-4 w-4" />
              Desfazer importação
            </Button>
          )}
        </Card>
      )}

      {/* Avisos */}
      {avisos.length > 0 && (
        <Card className="p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-warning-strong">
            <AlertTriangle className="h-4 w-4" />
            {avisos.length} linha(s) não interpretada(s)
          </div>
          <ul className="mt-1 list-disc pl-6 text-xs text-muted-foreground">
            {avisos.slice(0, 8).map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Preview */}
      {itens.length > 0 && aux && (
        <Card className="p-4 space-y-4">
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
            <div className="ml-auto text-sm text-muted-foreground">
              {nCriar} a criar · {nConciliar} a conciliar
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-36">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-32">Valor</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead className="w-48">Categoria</TableHead>
                  <TableHead className="w-40">Conciliação</TableHead>
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
                        <Input
                          type="number"
                          step="0.01"
                          value={it.valor}
                          onChange={(e) => atualizar(it.id, { valor: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={it.tipo}
                          onValueChange={(v) =>
                            atualizar(it.id, { tipo: v as "despesa" | "receita", categoriaId: null })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="despesa">Saída</SelectItem>
                            <SelectItem value="receita">Entrada</SelectItem>
                          </SelectContent>
                        </Select>
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
                            onClick={() => atualizar(it.id, { acao: it.acao === "conciliar" ? "criar" : "conciliar" })}
                          >
                            {it.acao === "conciliar" ? (
                              <Badge className="bg-brand text-ink">marcar como paga</Badge>
                            ) : (
                              <Badge variant="outline">criar novo</Badge>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">novo</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setItens([])}>
              Cancelar
            </Button>
            <Button onClick={onConfirmar} disabled={gravando || incluidos.length === 0}>
              {gravando ? "Gravando..." : `Importar ${incluidos.length} lançamento(s)`}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : "Erro inesperado";
}
