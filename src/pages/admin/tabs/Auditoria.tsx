import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2, RefreshCw, Download, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { untypedFrom } from "@/lib/supabaseRpc";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── audit_logs (triggers DB) ────────────────────────────────────────────────

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
  INSERT: "bg-positive/10 text-positive-strong",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

// ─── admin_audit_logs (ações administrativas) ─────────────────────────────────

interface AdminAuditLog {
  id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  category: string;
  target_type: string | null;
  target_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  user: "bg-blue-100 text-blue-700",
  empresa: "bg-purple-100 text-purple-700",
  member: "bg-positive/10 text-positive-strong",
  billing: "bg-yellow-100 text-yellow-700",
  impersonation: "bg-orange-100 text-orange-700",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCSV(csv: string, name: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAuditLogsCSV(logs: AuditLog[]) {
  const header = ["created_at", "actor_email", "action", "target_table", "target_id", "diff"];
  const rows = logs.map((l) =>
    [l.created_at, l.actor_email, l.action, l.target_table, l.target_id, l.diff].map(csvEscape).join(",")
  );
  downloadCSV([header.join(","), ...rows].join("\n"), "audit-dados");
}

function exportAdminLogsCSV(logs: AdminAuditLog[]) {
  const header = ["created_at", "actor_email", "actor_role", "action", "category", "target_name", "metadata"];
  const rows = logs.map((l) =>
    [l.created_at, l.actor_email, l.actor_role, l.action, l.category, l.target_name, l.metadata]
      .map(csvEscape)
      .join(",")
  );
  downloadCSV([header.join(","), ...rows].join("\n"), "audit-admin");
}

const SENSITIVE_TABLES = [
  "clientes",
  "fornecedores",
  "projetos",
  "receitas",
  "despesas",
  "contas",
  "cartoes",
  "marcos_faturamento",
  "propostas",
  "leads",
  "asaas_config",
  "profiles",
  "empresas",
  "cliente_portal_accounts",
  "convites",
];

// ─── audit_logs tab ──────────────────────────────────────────────────────────

function DataAuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterActor, setFilterActor] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // gen:types não inclui audit_logs ainda
      let q = untypedFrom<AuditLog>("audit_logs")
        .select("id, actor_id, actor_email, action, target_table, target_id, diff, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterTable !== "all") q = q.eq("target_table", filterTable);
      if (filterAction !== "all") q = q.eq("action", filterAction);
      if (filterActor.trim()) q = q.ilike("actor_email", `%${filterActor.trim()}%`);

      const { data, error: err } = await q;
      if (err) throw err;
      setLogs(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTable, filterAction, filterActor]);

  const diffPreview = useMemo(
    () => (diff: AuditLog["diff"]) => {
      if (!diff) return "—";
      const keys = Object.keys(diff);
      if (keys.length === 0) return "—";
      return keys.slice(0, 3).join(", ") + (keys.length > 3 ? ` +${keys.length - 3}` : "");
    },
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mutações em tabelas sensíveis registradas por triggers (últimos 200).
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAuditLogsCSV(logs)} disabled={!logs.length}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

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
          <Input placeholder="admin@empresa.com" value={filterActor} onChange={(e) => setFilterActor(e.target.value)} />
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhum registro encontrado"
          description="Ajuste os filtros ou aguarde novas ações."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Quando</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead className="w-[90px]">Ação</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Campos</TableHead>
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
    </div>
  );
}

// ─── admin_audit_logs tab ─────────────────────────────────────────────────────

function AdminActionsTab() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterActor, setFilterActor] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      // gen:types não inclui admin_audit_logs ainda
      let q = untypedFrom<AdminAuditLog>("admin_audit_logs")
        .select("id, actor_email, actor_role, action, category, target_type, target_name, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterCategory !== "all") q = q.eq("category", filterCategory);
      if (filterActor.trim()) q = q.ilike("actor_email", `%${filterActor.trim()}%`);

      const { data, error: err } = await q;
      if (err) throw err;
      setLogs(data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar logs admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterActor]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Convites, remoções, features, impersonation (últimos 200).</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAdminLogsCSV(logs)} disabled={!logs.length}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Categoria</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="empresa">Empresa</SelectItem>
              <SelectItem value="member">Membro</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="impersonation">Impersonation</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Autor (email)</Label>
          <Input placeholder="admin@empresa.com" value={filterActor} onChange={(e) => setFilterActor(e.target.value)} />
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhum registro encontrado"
          description="Ajuste os filtros ou aguarde novas ações."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Quando</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Alvo</TableHead>
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
                      <TableCell className="text-xs">{log.actor_email}</TableCell>
                      <TableCell className="text-xs font-medium">{log.actor_role}</TableCell>
                      <TableCell className="text-xs font-mono">{log.action}</TableCell>
                      <TableCell>
                        <Badge
                          className={CATEGORY_COLOR[log.category] ?? "bg-gray-100 text-gray-700"}
                          variant="secondary"
                        >
                          {log.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.target_name ?? log.target_type ?? "—"}
                      </TableCell>
                    </TableRow>
                    {isExpanded && log.metadata && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30">
                          <pre className="text-xs overflow-x-auto p-2">{JSON.stringify(log.metadata, null, 2)}</pre>
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
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export function AuditoriaTab() {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-black/5 bg-white">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center">
              <ShieldCheck size={18} className="text-ink" />
            </div>
            <div>
              <CardTitle className="text-lg font-medium tracking-tight">Auditoria</CardTitle>
              <CardDescription>Log completo de dados e ações administrativas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin">
            <TabsList className="mb-4">
              <TabsTrigger value="admin">Ações Admin</TabsTrigger>
              <TabsTrigger value="dados">Mutações de Dados</TabsTrigger>
            </TabsList>
            <TabsContent value="admin">
              <AdminActionsTab />
            </TabsContent>
            <TabsContent value="dados">
              <DataAuditTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
