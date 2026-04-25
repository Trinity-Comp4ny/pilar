import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2, RefreshCw, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  target_table: string;
  target_id: string | null;
  diff: Record<string, { old: unknown; new: unknown }> | null;
  created_at: string;
}

const ACTION_COLOR: Record<AuditLog["action"], string> = {
  INSERT: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCSV(logs: AuditLog[]) {
  const header = ["created_at", "actor_email", "action", "target_table", "target_id", "diff"];
  const rows = logs.map((l) =>
    [l.created_at, l.actor_email, l.action, l.target_table, l.target_id, l.diff].map(csvEscape).join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const SENSITIVE_TABLES = [
  "clientes",
  "fornecedores",
  "projetos",
  "receitas",
  "despesas",
  "contas",
  "cartoes_credito",
  "marcos_faturamento",
  "propostas",
  "leads",
  "asaas_config",
  "profiles",
  "empresas",
  "cliente_portal_accounts",
  "portal_tokens",
  "convites",
];

export function AuditoriaTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterTable, setFilterTable] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterActor, setFilterActor] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("audit_logs")
        .select("id, actor_id, actor_email, action, target_table, target_id, diff, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterTable !== "all") q = q.eq("target_table", filterTable);
      if (filterAction !== "all") q = q.eq("action", filterAction);
      if (filterActor.trim()) q = q.ilike("actor_email", `%${filterActor.trim()}%`);

      const { data, error: err } = await q;
      if (err) throw err;
      setLogs((data as unknown as AuditLog[]) ?? []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTable, filterAction, filterActor]);

  const diffPreview = useMemo(() => {
    return (diff: AuditLog["diff"]) => {
      if (!diff) return "—";
      const keys = Object.keys(diff);
      if (keys.length === 0) return "—";
      return keys.slice(0, 3).join(", ") + (keys.length > 3 ? ` +${keys.length - 3}` : "");
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent-orange/10 flex items-center justify-center">
                <ShieldCheck size={18} className="text-accent-orange" />
              </div>
              <div>
                <CardTitle>Auditoria</CardTitle>
                <CardDescription>Ações críticas registradas no sistema (últimos 200)</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportCSV(logs)} disabled={loading || !logs.length}>
                <Download className="h-4 w-4 mr-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tabela</Label>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {SENSITIVE_TABLES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ação</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="INSERT">INSERT</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Autor (email)</Label>
              <Input
                placeholder="admin@empresa.com"
                value={filterActor}
                onChange={(e) => setFilterActor(e.target.value)}
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-12 text-sm text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Quando</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead className="w-[90px]">Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Campos alterados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const isExpanded = expanded === log.id;
                    return (
                      <Fragment key={log.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpanded(isExpanded ? null : log.id)}
                        >
                          <TableCell className="text-xs font-mono">
                            {format(parseISO(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-xs">{log.actor_email ?? "—"}</TableCell>
                          <TableCell>
                            <Badge className={ACTION_COLOR[log.action]} variant="secondary">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{log.target_table}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{diffPreview(log.diff)}</TableCell>
                        </TableRow>
                        {isExpanded && log.diff && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/30">
                              <pre className="text-xs overflow-x-auto p-2">{JSON.stringify(log.diff, null, 2)}</pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
