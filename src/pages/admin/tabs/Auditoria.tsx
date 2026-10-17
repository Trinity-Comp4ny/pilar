import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/PageSlots";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { FilterBar, FilterSelect } from "@/components/filters/FilterBar";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { RefreshCw, Download, FileSearch } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { untypedFrom } from "@/lib/supabaseRpc";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { BusyMark } from "@/components/motion/BusyMark";
import { ReadingRing } from "@/components/motion/ReadingRing";

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
  UPDATE: "bg-info-soft text-info-strong",
  DELETE: "bg-danger-soft text-danger-strong",
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
  user: "bg-info-soft text-info-strong",
  empresa: "bg-highlight-soft text-highlight-strong",
  member: "bg-positive/10 text-positive-strong",
  billing: "bg-warning-soft text-warning-strong",
  impersonation: "bg-attention-soft text-attention-strong",
};

const CATEGORY_LABEL_PT: Record<string, string> = {
  user: "Usuário",
  empresa: "Empresa",
  member: "Membro",
  billing: "Cobrança",
  impersonation: "Impersonation",
};

// Achado em QA: a tabela de auditoria mostrava a ação e a categoria cruas
// (snake_case, em inglês) — só quem lê o código do backend entendia.
const ACTION_LABEL_PT: Record<string, string> = {
  bulk_toggle_feature: "Alternância de feature em massa",
  cancel_invite: "Convite cancelado",
  convert_to_paid: "Conversão para pagante",
  create_company: "Empresa criada",
  delete_user: "Usuário removido",
  invite_dispatch_failed: "Falha no envio do convite",
  invite_user: "Convite enviado",
  portal_proposta_aprovada: "Proposta aprovada no portal",
  resend_invite: "Convite reenviado",
  update_company: "Empresa atualizada",
  update_plan: "Plano atualizado",
  update_user_access: "Acesso do usuário atualizado",
  impersonation_start: "Início de impersonation",
  impersonation_stop: "Fim de impersonation",
};

const ROLE_LABEL_PT: Record<string, string> = {
  ultra_admin: "Ultra admin",
  admin: "Admin",
  coordenador: "Coordenador",
  user: "Usuário",
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
function diffPreview(diff: AuditLog["diff"]) {
  if (!diff) return "—";
  const keys = Object.keys(diff);
  if (keys.length === 0) return "—";
  return keys.slice(0, 3).join(", ") + (keys.length > 3 ? ` +${keys.length - 3}` : "");
}

// Colunas das duas tabelas (SPEC 127). Clicar na linha expande o JSON de detalhe.
const QUANDO = (iso: string) => format(parseISO(iso), "dd/MM HH:mm:ss", { locale: ptBR });

const MUTACOES_COLUMNS: ColumnDef<AuditLog>[] = [
  { key: "quando", header: "Quando", className: "w-[140px] text-xs font-mono", cell: (log) => QUANDO(log.created_at) },
  { key: "autor", header: "Autor", className: "text-xs", cell: (log) => log.actor_email ?? "—" },
  {
    key: "acao",
    header: "Ação",
    className: "w-[90px]",
    cell: (log) => (
      <Badge className={ACTION_COLOR[log.action]} variant="secondary">
        {log.action}
      </Badge>
    ),
  },
  { key: "tabela", header: "Tabela", className: "text-xs font-mono", cell: (log) => log.target_table },
  {
    key: "campos",
    header: "Campos",
    className: "text-xs text-muted-foreground",
    cell: (log) => diffPreview(log.diff),
  },
];

const ACOES_ADMIN_COLUMNS: ColumnDef<AdminAuditLog>[] = [
  { key: "quando", header: "Quando", className: "w-[140px] text-xs font-mono", cell: (log) => QUANDO(log.created_at) },
  { key: "autor", header: "Autor", className: "text-xs", cell: (log) => log.actor_email },
  {
    key: "role",
    header: "Role",
    className: "text-xs font-medium",
    cell: (log) => ROLE_LABEL_PT[log.actor_role] ?? log.actor_role,
  },
  { key: "acao", header: "Ação", className: "text-xs", cell: (log) => ACTION_LABEL_PT[log.action] ?? log.action },
  {
    key: "categoria",
    header: "Categoria",
    cell: (log) => (
      <Badge className={CATEGORY_COLOR[log.category] ?? "bg-muted text-muted-foreground"} variant="secondary">
        {CATEGORY_LABEL_PT[log.category] ?? log.category}
      </Badge>
    ),
  },
  {
    key: "alvo",
    header: "Alvo",
    className: "text-xs text-muted-foreground",
    cell: (log) => log.target_name ?? log.target_type ?? "—",
  },
];

function DataAuditTab({ visao }: { visao: React.ReactNode }) {
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

  return (
    <div className="space-y-4">
      {/* Toolbar padrão (SPEC 124): visão, filtros e ações da aba. */}
      <PageToolbar>
        <FilterBar
          end={
            <>
              <Button
                variant="outline"
                className="h-9 rounded-full px-3.5 text-[13px] font-normal"
                onClick={() => exportAuditLogsCSV(logs)}
                disabled={!logs.length}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={fetchLogs}
                disabled={loading}
                aria-label="Atualizar"
              >
                {loading ? <BusyMark className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </>
          }
        >
          {visao}
          <FilterSelect
            label="Tabela"
            value={filterTable}
            emptyValue="all"
            onChange={setFilterTable}
            options={[{ value: "all", label: "Todas" }, ...SENSITIVE_TABLES.map((t) => ({ value: t, label: t }))]}
          />
          <FilterSelect
            label="Ação"
            value={filterAction}
            emptyValue="all"
            onChange={setFilterAction}
            options={[
              { value: "all", label: "Todas" },
              { value: "INSERT", label: "INSERT" },
              { value: "UPDATE", label: "UPDATE" },
              { value: "DELETE", label: "DELETE" },
            ]}
          />
          <Input
            placeholder="Autor (email)"
            aria-label="Autor (email)"
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="h-9 w-[220px] shrink-0 rounded-full text-[13px]"
          />
        </FilterBar>
      </PageToolbar>

      <p className="text-sm text-muted-foreground">
        Mutações em tabelas sensíveis registradas por triggers (últimos 200).
      </p>

      {error && <div className="text-sm text-danger-mid">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-12">
          <ReadingRing size={64} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhum registro encontrado"
          description="Ajuste os filtros ou aguarde novas ações."
        />
      ) : (
        <div className="rounded-md border">
          <DataTable
            columns={MUTACOES_COLUMNS}
            data={{ rows: logs, isPending: false, error: null }}
            rowKey={(log) => log.id}
            onRowClick={(log) => setExpanded(expanded === log.id ? null : log.id)}
            rowLabel={(log) => `Ver campos alterados em ${log.target_table}`}
            expandedIds={new Set(expanded ? [expanded] : [])}
            renderExpanded={(log) =>
              log.diff ? <pre className="text-xs overflow-x-auto p-2">{JSON.stringify(log.diff, null, 2)}</pre> : null
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── admin_audit_logs tab ─────────────────────────────────────────────────────

function AdminActionsTab({ visao }: { visao: React.ReactNode }) {
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
      {/* Toolbar padrão (SPEC 124): visão, filtros e ações da aba. */}
      <PageToolbar>
        <FilterBar
          end={
            <>
              <Button
                variant="outline"
                className="h-9 rounded-full px-3.5 text-[13px] font-normal"
                onClick={() => exportAdminLogsCSV(logs)}
                disabled={!logs.length}
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={fetchLogs}
                disabled={loading}
                aria-label="Atualizar"
              >
                {loading ? <BusyMark className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </>
          }
        >
          {visao}
          <FilterSelect
            label="Categoria"
            value={filterCategory}
            emptyValue="all"
            onChange={setFilterCategory}
            options={[
              { value: "all", label: "Todas" },
              { value: "user", label: "Usuário" },
              { value: "empresa", label: "Empresa" },
              { value: "member", label: "Membro" },
              { value: "billing", label: "Billing" },
              { value: "impersonation", label: "Impersonation" },
            ]}
          />
          <Input
            placeholder="Autor (email)"
            aria-label="Autor (email)"
            value={filterActor}
            onChange={(e) => setFilterActor(e.target.value)}
            className="h-9 w-[220px] shrink-0 rounded-full text-[13px]"
          />
        </FilterBar>
      </PageToolbar>

      <p className="text-sm text-muted-foreground">Convites, remoções, features, impersonation (últimos 200).</p>

      {error && <div className="text-sm text-danger-mid">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-12">
          <ReadingRing size={64} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhum registro encontrado"
          description="Ajuste os filtros ou aguarde novas ações."
        />
      ) : (
        <div className="rounded-md border">
          <DataTable
            columns={ACOES_ADMIN_COLUMNS}
            data={{ rows: logs, isPending: false, error: null }}
            rowKey={(log) => log.id}
            onRowClick={(log) => setExpanded(expanded === log.id ? null : log.id)}
            rowLabel={(log) => `Ver detalhes da ação ${ACTION_LABEL_PT[log.action] ?? log.action}`}
            expandedIds={new Set(expanded ? [expanded] : [])}
            renderExpanded={(log) =>
              log.metadata ? (
                <pre className="text-xs overflow-x-auto p-2">{JSON.stringify(log.metadata, null, 2)}</pre>
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

const VISOES_AUDITORIA: ViewOption<"admin" | "dados">[] = [
  { value: "admin", label: "Ações admin" },
  { value: "dados", label: "Mutações de dados" },
];

export function AuditoriaTab() {
  const [visao, setVisao] = useState<"admin" | "dados">("admin");
  // O alternador abre a toolbar de cada aba (cada uma tem os próprios filtros).
  const alternador = (
    <ViewSwitcher options={VISOES_AUDITORIA} value={visao} onChange={setVisao} ariaLabel="Tipo de registro" />
  );
  return visao === "admin" ? <AdminActionsTab visao={alternador} /> : <DataAuditTab visao={alternador} />;
}
