import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Truck, Link2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RowActions } from "@/components/data/RowActions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/data/DataTable";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { FormDialog } from "@/components/FormDialog";
import { MultiSelectFilter } from "@/components/filters/MultiSelectFilter";
import { FilterBar } from "@/components/filters/FilterBar";
import { Badge } from "@/components/ui/badge";
import { exportarFornecedores, type LinhaFornecedor } from "./exportarFornecedores";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getRawErrorMessage, getSafeErrorMessage } from "@/lib/safeError";
import { formatCNPJ, formatPhone, onlyDigits, validateEmail } from "@/lib/maskUtils";
import { isValidCNPJ } from "@/lib/brasilApi";
import { ReconciliarDialog } from "./ReconciliarDialog";
import { softDelete, restaurar } from "@/lib/softDelete";

import { BusyMark } from "@/components/motion/BusyMark";
import { CONTAINER_TELA_DADOS } from "@/lib/shellLayout";

interface Fornecedor extends LinhaFornecedor {
  id: string;
}

const CATEGORIAS_SUGERIDAS = ["Pisos e revestimentos", "Concreto", "Iluminação", "Móveis planejados"];
const SEM_CATEGORIA = "__sem_categoria__";
const chaveCategoria = (valor: string) => valor.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

type FormState = {
  nome: string;
  cnpj: string;
  contato: string;
  email: string;
  telefone: string;
  categorias: string[];
};

const EMPTY_FORM: FormState = { nome: "", cnpj: "", contato: "", email: "", telefone: "", categorias: [] };

export default function Fornecedores() {
  usePageTitle("Fornecedores");
  const { can } = usePermissions();
  const podeExcluir = can("obras", "delete");
  const navigate = useNavigate();
  // Decisão de produto: fornecedor é cadastro global da empresa, mas a porta de
  // gerência vive no módulo Obra (é onde ele mais se usa: cotação e conta da obra).
  // Por isso o gate é "obras". O escritório continua gerenciando o mesmo cadastro
  // pelo SupplierManager embutido no fluxo de despesa (gated por "financeiro").
  const canEdit = can("obras", "edit");
  const [reconciliarOpen, setReconciliarOpen] = useState(false);

  const [catalogo, setCatalogo] = useState<string[]>([]);
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [exportarOpen, setExportarOpen] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [incluirCnpj, setIncluirCnpj] = useState(false);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [cnpjError, setCnpjError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; nome: string } | null>(null);

  const fetchFornecedores = useCallback(async () => {
    const pagina = 500;
    const fornecedoresCarregados: Fornecedor[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("*")
        .order("nome")
        .order("id")
        .range(offset, offset + pagina - 1);
      if (error) {
        setLoadError(true);
        toast.error("Não foi possível carregar os fornecedores", {
          description: getSafeErrorMessage(error, "Atualize a página em instantes."),
        });
        return;
      }
      fornecedoresCarregados.push(
        ...(data ?? []).map((f) => ({
          id: f.id,
          nome: f.nome,
          cnpj: f.cnpj ?? undefined,
          contato: f.contato ?? undefined,
          email: f.email ?? undefined,
          telefone: f.telefone ?? undefined,
          categorias: f.categorias ?? [],
        }))
      );
      if (!data || data.length < pagina) break;
      offset += pagina;
    }
    setLoadError(false);
    setFornecedores(fornecedoresCarregados);
  }, []);

  useEffect(() => {
    void fetchFornecedores();
  }, [fetchFornecedores]);

  const buscarCatalogo = useCallback(async () => {
    const { data } = await supabase.from("fornecedor_categorias").select("nome").order("nome");
    if (data) setCatalogo(data.map(({ nome }) => nome));
  }, []);

  useEffect(() => {
    void buscarCatalogo();
  }, [buscarCatalogo]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setNovaCategoria("");
    setCurrentId(null);
    setIsEditMode(false);
    setCnpjError("");
    setEmailError("");
  };

  const handleOpenNew = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditClick = (f: Fornecedor, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNovaCategoria("");
    setForm({
      nome: f.nome,
      cnpj: f.cnpj ? formatCNPJ(f.cnpj) : "",
      contato: f.contato ?? "",
      email: f.email ?? "",
      telefone: f.telefone ? formatPhone(f.telefone) : "",
      categorias: f.categorias,
    });
    setCnpjError("");
    setEmailError("");
    setCurrentId(f.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCNPJ(value);
    setForm((prev) => ({ ...prev, cnpj: formatted }));
    if (cnpjError) setCnpjError("");
  };

  const handleTelefoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setForm((prev) => ({ ...prev, telefone: formatted }));
  };

  const validateForm = (): boolean => {
    if (!form.nome.trim()) {
      toast.error("O nome do fornecedor é obrigatório");
      return false;
    }
    let valid = true;
    const cnpjDigits = onlyDigits(form.cnpj);
    if (cnpjDigits.length > 0 && !isValidCNPJ(form.cnpj)) {
      setCnpjError("CNPJ inválido");
      valid = false;
    } else {
      setCnpjError("");
    }
    if (form.email.trim() && !validateEmail(form.email.trim())) {
      setEmailError("E-mail inválido");
      valid = false;
    } else {
      setEmailError("");
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const cnpjRaw = onlyDigits(form.cnpj) || null;
      const telefoneRaw = onlyDigits(form.telefone) || null;

      if (isEditMode && currentId) {
        const { error } = await supabase
          .from("fornecedores")
          .update({
            nome: form.nome.trim(),
            cnpj: cnpjRaw,
            contato: form.contato.trim() || null,
            email: form.email.trim() || null,
            telefone: telefoneRaw,
            categorias: form.categorias,
          })
          .eq("id", currentId);
        if (error) throw error;
        toast.success("Fornecedor atualizado");
      } else {
        const { error } = await supabase.from("fornecedores").insert({
          nome: form.nome.trim(),
          cnpj: cnpjRaw,
          contato: form.contato.trim() || null,
          email: form.email.trim() || null,
          telefone: telefoneRaw,
          categorias: form.categorias,
          empresa_id: (await supabase.rpc("get_user_empresa_id")).data,
        } as never);
        if (error) throw error;
        toast.success("Fornecedor adicionado");
      }
      resetForm();
      setIsDialogOpen(false);
      void fetchFornecedores();
      void buscarCatalogo();
    } catch (err) {
      // PostgrestError é objeto plano (não `instanceof Error`): ler a mensagem por getRawErrorMessage,
      // senão o CNPJ duplicado (fornecedores_unique_empresa_cnpj) caía no aviso genérico.
      const message = getRawErrorMessage(err);
      if (message.includes("unique") || message.includes("duplicate") || message.includes("fornecedores_cnpj")) {
        toast.error("CNPJ já cadastrado para outro fornecedor");
      } else {
        toast.error("Não foi possível salvar o fornecedor", {
          description: getSafeErrorMessage(err, "Confira os dados e tente de novo."),
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (f: Fornecedor, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setToDelete({ id: f.id, nome: f.nome });
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    const id = toDelete.id;
    // Soft delete (a RLS já esconde deleted_at da lista), com "Desfazer" no toast
    // como cliente/lead — o delete é recuperável (ACH-FOR-01).
    // Via RPC: a policy de SELECT esconde deletado, então UPDATE direto leva 42501.
    const error = await softDelete("fornecedores", id);
    if (error) {
      toast.error("Não foi possível excluir o fornecedor", {
        description: getSafeErrorMessage(error, "Tente de novo em instantes."),
      });
      return;
    }
    toast.success("Fornecedor excluído", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const restoreError = await restaurar("fornecedores", id);
          if (restoreError)
            toast.error("Não foi possível restaurar o fornecedor", {
              description: getSafeErrorMessage(restoreError, "Tente de novo em instantes."),
            });
          else {
            toast.success("Fornecedor restaurado");
            fetchFornecedores();
          }
        },
      },
    });
    setConfirmDeleteOpen(false);
    setToDelete(null);
    fetchFornecedores();
  };

  // BUG-A7-2: filter by nome, CNPJ (digits or formatted) and email
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const termDigits = onlyDigits(term);
    return fornecedores.filter((f) => {
      if (
        categoriasFiltro.length &&
        !categoriasFiltro.some((categoria) =>
          categoria === SEM_CATEGORIA ? !f.categorias.length : f.categorias.includes(categoria)
        )
      )
        return false;
      if (!term) return true;
      if (f.nome.toLowerCase().includes(term)) return true;
      const cnpjDigits = onlyDigits(f.cnpj ?? "");
      if (cnpjDigits && termDigits && cnpjDigits.includes(termDigits)) return true;
      if (formatCNPJ(cnpjDigits).includes(term)) return true;
      if ((f.email ?? "").toLowerCase().includes(term)) return true;
      return false;
    });
  }, [fornecedores, searchTerm, categoriasFiltro]);

  const categorias = useMemo(() => {
    const opcoes = new Map<string, string>();
    for (const nome of [
      ...CATEGORIAS_SUGERIDAS,
      ...catalogo,
      ...fornecedores.flatMap((f) => f.categorias),
      ...form.categorias,
    ]) {
      opcoes.set(chaveCategoria(nome), nome);
    }
    return [...opcoes.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [catalogo, fornecedores, form.categorias]);
  const opcoesCategoria = categorias.map((categoria) => ({ value: categoria, label: categoria }));

  function adicionarCategoria() {
    const nome = novaCategoria.trim().replace(/\s+/g, " ");
    if (!nome) return;
    const categoria = categorias.find((item) => chaveCategoria(item) === chaveCategoria(nome)) ?? nome;
    setForm((prev) =>
      prev.categorias.includes(categoria) ? prev : { ...prev, categorias: [...prev.categorias, categoria] }
    );
    setNovaCategoria("");
  }

  async function baixarPdf() {
    if (!filtered.length || loadError) return;
    setExportando(true);
    try {
      await exportarFornecedores(
        filtered,
        categoriasFiltro.map((c) => (c === SEM_CATEGORIA ? "Sem categoria" : c)),
        incluirCnpj
      );
      setExportarOpen(false);
    } catch {
      toast.error("Não foi possível exportar a lista.");
    } finally {
      setExportando(false);
    }
  }

  const columns: ColumnDef<Fornecedor>[] = [
    {
      key: "nome",
      mobile: "title",
      header: "Nome",
      className: "font-medium",
      getSortValue: (f) => f.nome.toLowerCase(),
      cell: (f) => f.nome,
    },
    {
      key: "categorias",
      header: "Categorias",
      mobile: "subtitle",
      cell: (f) => f.categorias.join(", ") || "Sem categoria",
    },
    {
      key: "cnpj",
      header: "CNPJ",
      getSortValue: (f) => f.cnpj ?? "",
      cell: (f) => (f.cnpj ? formatCNPJ(f.cnpj) : "-"),
    },
    {
      key: "contato",
      header: "Contato",
      className: "hidden md:table-cell text-sm text-muted-foreground",
      getSortValue: (f) => (f.contato ?? "").toLowerCase(),
      cell: (f) => f.contato || "-",
    },
    {
      key: "telefone",
      header: "Telefone",
      className: "hidden lg:table-cell text-sm text-muted-foreground",
      cell: (f) => (f.telefone ? formatPhone(f.telefone) : "-"),
    },
    {
      key: "email",
      header: "Email",
      className: "hidden md:table-cell text-sm text-muted-foreground",
      getSortValue: (f) => (f.email ?? "").toLowerCase(),
      cell: (f) => f.email || "-",
    },
    ...(canEdit
      ? [
          {
            key: "acoes",
            mobile: "trailing" as const,
            header: <span className="sr-only">Ações</span>,
            align: "end" as const,
            cell: (f: Fornecedor) => (
              <RowActions
                label={f.nome}
                actions={[
                  { label: "Editar", icon: Pencil, onClick: () => handleEditClick(f) },
                  {
                    label: "Excluir",
                    icon: Trash2,
                    destructive: true,
                    hidden: !podeExcluir,
                    onClick: () => handleDeleteClick(f),
                  },
                ]}
              />
            ),
          },
        ]
      : []),
  ];

  const emptyState = loadError ? (
    <EmptyState
      icon={Truck}
      title="Não foi possível carregar os fornecedores"
      description="Atualize a página em instantes."
      action={{ label: "Tentar de novo", variant: "outline", onClick: () => fetchFornecedores() }}
    />
  ) : fornecedores.length === 0 ? (
    <EmptyState
      icon={Truck}
      title="Nenhum fornecedor cadastrado"
      description="Crie o primeiro fornecedor para começar."
      action={can("obras", "create") ? { label: "Novo fornecedor", onClick: handleOpenNew } : undefined}
    />
  ) : (
    <EmptyState
      icon={Truck}
      title="Nenhum resultado encontrado"
      description="Ajuste a busca ou as categorias."
      action={{
        label: "Limpar filtros",
        variant: "outline",
        onClick: () => {
          setSearchTerm("");
          setCategoriasFiltro([]);
        },
      }}
    />
  );

  return (
    <PageLayout
      className="md:overflow-y-hidden"
      containerClassName={CONTAINER_TELA_DADOS}
      toolbar={
        <FilterBar>
          <MultiSelectFilter
            label="Categorias"
            options={[{ value: SEM_CATEGORIA, label: "Sem categoria" }, ...opcoesCategoria]}
            selected={categoriasFiltro}
            onChange={setCategoriasFiltro}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!filtered.length || loadError}
            onClick={() => {
              setIncluirCnpj(false);
              setExportarOpen(true);
            }}
          >
            <Download className="h-4 w-4" /> Exportar lista
          </Button>
        </FilterBar>
      }
      header={
        <PageHeader
          title="Fornecedores"
          search={{ value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar fornecedores" }}
          primaryAction={{
            label: "Novo fornecedor",
            onClick: handleOpenNew,
            icon: Plus,
            feature: "obras",
            dataTour: "onb-novo-fornecedor",
          }}
          children={
            <>
              {/* Sem linha de barra só para a contagem (a lista não tem filtro além da busca):
                  ela aparece aqui quando a busca recorta (auditoria de espaço, 2026-11). */}
              {searchTerm.trim() !== "" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {filtered.length} de {fornecedores.length}
                </span>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setReconciliarOpen(true)}>
                  <Link2 className="mr-1.5 h-4 w-4" />
                  Reconciliar
                </Button>
              )}
              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) resetForm();
                }}
              >
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{isEditMode ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
                    <DialogDescription>
                      {isEditMode ? "Atualize os dados do fornecedor" : "Cadastre um novo fornecedor"}
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSave();
                    }}
                    className="space-y-3 pt-2"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="nome" className="text-xs">
                        Nome / Razão Social *
                      </Label>
                      <Input
                        id="nome"
                        value={form.nome}
                        onChange={(e) => setForm({ ...form, nome: e.target.value })}
                        placeholder="Razão social ou nome fantasia"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cnpj" className="text-xs">
                        CNPJ
                      </Label>
                      <Input
                        id="cnpj"
                        value={form.cnpj}
                        onChange={(e) => handleCnpjChange(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        aria-invalid={!!cnpjError}
                        aria-describedby={cnpjError ? "fornecedor-cnpj-error" : undefined}
                        className={cnpjError ? "border-danger-mid focus-visible:ring-danger-mid" : ""}
                      />
                      {cnpjError && (
                        <p id="fornecedor-cnpj-error" role="alert" className="text-xs text-danger-mid">
                          {cnpjError}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="contato" className="text-xs">
                          Contato
                        </Label>
                        <Input
                          id="contato"
                          value={form.contato}
                          onChange={(e) => setForm({ ...form, contato: e.target.value })}
                          placeholder="Nome do contato"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="telefone" className="text-xs">
                          Telefone
                        </Label>
                        <Input
                          id="telefone"
                          value={form.telefone}
                          onChange={(e) => handleTelefoneChange(e.target.value)}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => {
                          setForm({ ...form, email: e.target.value });
                          if (emailError) setEmailError("");
                        }}
                        placeholder="email@exemplo.com"
                        aria-invalid={!!emailError}
                        aria-describedby={emailError ? "fornecedor-email-error" : undefined}
                        className={emailError ? "border-danger-mid focus-visible:ring-danger-mid" : ""}
                      />
                      {emailError && (
                        <p id="fornecedor-email-error" role="alert" className="text-xs text-danger-mid">
                          {emailError}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <MultiSelectFilter
                        label="Categorias"
                        options={opcoesCategoria}
                        selected={form.categorias}
                        onChange={(categorias) => setForm((prev) => ({ ...prev, categorias }))}
                      />
                      {!!form.categorias.length && (
                        <div className="flex flex-wrap gap-1">
                          {form.categorias.map((categoria) => (
                            <Badge key={categoria} variant="secondary">
                              {categoria}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <Label htmlFor="fornecedor-nova-categoria">Nova categoria</Label>
                      <div className="flex gap-2">
                        <Input
                          id="fornecedor-nova-categoria"
                          maxLength={80}
                          value={novaCategoria}
                          onChange={(e) => setNovaCategoria(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              adicionarCategoria();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!novaCategoria.trim()}
                          onClick={adicionarCategoria}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                        Cancelar
                      </Button>
                      <div className="flex-1" />
                      <Button type="submit" variant="brand" disabled={isSaving}>
                        {isSaving ? (
                          <>
                            <BusyMark className="mr-2 h-4 w-4" />
                            Salvando...
                          </>
                        ) : isEditMode ? (
                          "Atualizar"
                        ) : (
                          "Salvar"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          }
        />
      }
    >
      <Card className="rounded-2xl border border-black/5 bg-white w-full flex flex-col flex-1 min-h-0 overflow-hidden max-md:border-0 max-md:bg-transparent max-md:shadow-none">
        <CardContent className="flex-1 min-h-0 flex flex-col p-0 pb-2">
          {/* O main está com overflow-y-hidden (página de altura fixa), então o
              scroll precisa viver aqui, senão a tabela é cortada sem rolar. */}
          <div className="overflow-x-auto overflow-y-auto w-full flex-1 min-h-0">
            <DataTable
              columns={columns}
              data={{ rows: filtered }}
              rowKey={(f) => f.id}
              onRowClick={(f) => navigate(`/gestao/fornecedores/${f.id}`)}
              emptyState={emptyState}
            />
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir fornecedor"
        itemName={toDelete?.nome}
        description="O fornecedor sai das listagens e o histórico de despesas é preservado."
        confirmText="Excluir"
        cancelText="Cancelar"
      />

      <FormDialog
        open={exportarOpen}
        onOpenChange={setExportarOpen}
        title="Exportar fornecedores"
        description={`O PDF inclui ${filtered.length} fornecedor(es) do resultado atual.`}
        size="sm"
        onSubmit={baixarPdf}
        submitLabel="Baixar PDF"
        isPending={exportando}
        submitDisabled={!filtered.length || loadError}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={incluirCnpj} onChange={(e) => setIncluirCnpj(e.target.checked)} /> Incluir
          CNPJ
        </label>
      </FormDialog>
      <ReconciliarDialog open={reconciliarOpen} onOpenChange={setReconciliarOpen} />
    </PageLayout>
  );
}
