import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Users } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AvatarStack } from "@/components/AvatarStack";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { PilarRole } from "@/lib/roles";
import { toDataSourceResult } from "@/types/dataSource";
import { ROLE_LABEL, edgeFetch, type UsuarioPlataforma } from "./api";
import { useAcaoEmpresa, useEmpresas, useUsuariosPlataforma } from "./hooks";
import { quandoRelativo } from "./lib";
import { FiltroChips } from "./components/FiltroChips";

type FiltroPapel = "todos" | PilarRole;
type FiltroAcesso = "todos" | "7d" | "30d" | "nunca";

const DIA = 24 * 60 * 60 * 1000;

export default function Usuarios() {
  usePageTitle("Usuários · Ultra admin");
  const navigate = useNavigate();
  const query = useUsuariosPlataforma();
  const empresasQ = useEmpresas();
  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("todas");
  const [papel, setPapel] = useState<FiltroPapel>("todos");
  const [acesso, setAcesso] = useState<FiltroAcesso>("todos");
  const [remover, setRemover] = useState<UsuarioPlataforma | null>(null);

  const usuarios = useMemo(() => query.data ?? [], [query.data]);
  const temUltimoAcesso = usuarios.some((u) => u.lastSignInAt);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const agora = Date.now();
    return usuarios.filter((u) => {
      if (empresa !== "todas" && u.empresaId !== empresa) return false;
      if (papel !== "todos" && u.role !== papel) return false;
      const desde = u.lastSignInAt ? agora - new Date(u.lastSignInAt).getTime() : null;
      if (acesso === "7d" && (desde === null || desde > 7 * DIA)) return false;
      if (acesso === "30d" && (desde === null || desde > 30 * DIA)) return false;
      if (acesso === "nunca" && desde !== null) return false;
      if (!q) return true;
      return (u.nome ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });
  }, [usuarios, busca, empresa, papel, acesso]);

  const contaPapel = (p: PilarRole) => usuarios.filter((u) => u.role === p).length;

  const removerUsuario = useAcaoEmpresa({
    run: (u: UsuarioPlataforma) =>
      edgeFetch("ultra-admin-usuarios", { method: "DELETE", body: { user_id: u.id, empresa_id: u.empresaId } }),
    sucesso: "Usuário removido",
    erro: "Não foi possível remover o usuário",
    contexto: "ultra-admin-usuarios:cross-delete",
  });

  const abrirEmpresa = (u: UsuarioPlataforma) => {
    if (u.empresaId) navigate(`/ultra-admin/empresas/${u.empresaId}?tab=usuarios`);
  };

  const colunas: ColumnDef<UsuarioPlataforma>[] = [
    {
      key: "nome",
      header: "Usuário",
      getSortValue: (u) => (u.nome ?? u.email ?? "").toLowerCase(),
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <AvatarStack pessoas={[u.nome ?? u.email ?? "?"]} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{u.nome ?? "Sem nome"}</p>
            <p className="truncate text-xs text-ink-muted">{u.email ?? "-"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "empresa",
      header: "Empresa",
      getSortValue: (u) => u.empresaNome ?? "",
      cell: (u) => <span className="text-ink-soft">{u.empresaNome ?? "-"}</span>,
    },
    {
      key: "papel",
      header: "Papel",
      getSortValue: (u) => u.role,
      cell: (u) => <Badge variant="neutral">{ROLE_LABEL[u.role]}</Badge>,
    },
    ...(temUltimoAcesso
      ? [
          {
            key: "ultimoAcesso",
            header: "Último acesso",
            getSortValue: (u: UsuarioPlataforma) => u.lastSignInAt ?? "",
            cell: (u: UsuarioPlataforma) => (
              <span className="text-ink-soft">{quandoRelativo(u.lastSignInAt) ?? "Nunca entrou"}</span>
            ),
          },
        ]
      : []),
    {
      key: "criadoEm",
      header: "Conta criada",
      getSortValue: (u) => u.createdAt ?? "",
      cell: (u) => <span className="text-ink-soft">{quandoRelativo(u.createdAt) ?? "-"}</span>,
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      align: "end",
      cell: (u) =>
        u.role === "ultra_admin" ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0"
                aria-label={`Ações de ${u.nome ?? u.email}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {u.empresaId && <DropdownMenuItem onClick={() => abrirEmpresa(u)}>Abrir empresa</DropdownMenuItem>}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemover(u)}>
                Remover usuário
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    },
  ];

  return (
    <PilarPage title="Usuários" search={{ value: busca, onChange: setBusca, placeholder: "Buscar por nome ou e-mail" }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FiltroChips<FiltroPapel>
          ariaLabel="Filtrar por papel"
          value={papel}
          onChange={setPapel}
          opcoes={[
            { value: "todos", label: "Todos", count: usuarios.length },
            { value: "admin", label: "Admins", count: contaPapel("admin") },
            { value: "coordenador", label: "Coordenadores", count: contaPapel("coordenador") },
            { value: "user", label: "Usuários", count: contaPapel("user") },
            { value: "ultra_admin", label: "Ultra admins", count: contaPapel("ultra_admin") },
          ]}
        />
        <div className="flex gap-2">
          {temUltimoAcesso && (
            <Select value={acesso} onValueChange={(v) => setAcesso(v as FiltroAcesso)}>
              <SelectTrigger className="h-9 w-44" aria-label="Filtrar por último acesso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Qualquer acesso</SelectItem>
                <SelectItem value="7d">Entrou em 7 dias</SelectItem>
                <SelectItem value="30d">Entrou em 30 dias</SelectItem>
                <SelectItem value="nunca">Nunca entrou</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={empresa} onValueChange={setEmpresa}>
            <SelectTrigger className="h-9 w-52" aria-label="Filtrar por empresa">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {(empresasQ.data ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={colunas}
        data={toDataSourceResult<UsuarioPlataforma>({ data: visiveis, isLoading: query.isLoading, error: query.error })}
        rowKey={(u) => u.id}
        onRowClick={abrirEmpresa}
        defaultSortKey="nome"
        minWidth="760px"
        errorTitle="Não foi possível carregar os usuários"
        emptyState={
          <EmptyState
            icon={Users}
            title="Nenhum usuário com esses filtros"
            description="Limpe a busca ou troque os filtros."
          />
        }
      />

      <ConfirmDialog
        open={!!remover}
        onOpenChange={(o) => !o && setRemover(null)}
        title="Remover usuário?"
        itemName={remover?.nome ?? remover?.email ?? undefined}
        description="O login é apagado e a pessoa perde o acesso na hora. Os dados que ela criou continuam na empresa."
        confirmText="Remover"
        loading={removerUsuario.isPending}
        onConfirm={() => remover && removerUsuario.mutate(remover, { onSuccess: () => setRemover(null) })}
      />
    </PilarPage>
  );
}
