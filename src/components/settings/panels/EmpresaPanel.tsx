import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, Users as UsersIcon, Palette } from "lucide-react";
import { formatCNPJ, formatPhone, onlyDigits } from "@/lib/maskUtils";
import type { CompanyData, CompanyUser } from "@/pages/company/types";
import { ROLES } from "@/pages/company/types";
import { CompanySummaryCard } from "@/pages/company/components/CompanySummaryCard";
import { CompanyDataTab } from "@/pages/company/components/CompanyDataTab";
import { CompanyUsersTab } from "@/pages/company/components/CompanyUsersTab";
import { CompanyVisualTab } from "@/pages/company/components/CompanyVisualTab";
import { LogoPreviewDialog, EditUserDialog, DeleteUserDialog } from "@/pages/company/components/CompanyDialogs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useRequireAal2 } from "@/hooks/useRequireAal2";

// Conteúdo da aba Empresa do modal de configurações. É o antigo /company sem a casca
// de página (PageLayout/PageHeader): todo o estado e handlers seguem centralizados
// aqui, as tabs continuam presentacionais. Mutações sensíveis passam por requireAal2.
export function EmpresaPanel() {
  const requireAal2 = useRequireAal2();
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingVisual, setEditingVisual] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("user");
  const isAdmin = currentRole === "admin" || currentRole === "ultra_admin";
  const [isLogoPreviewOpen, setIsLogoPreviewOpen] = useState(false);

  const [companyData, setCompanyData] = useState<CompanyData>({
    nomeEmpresa: "",
    cnpj: "",
    email: "",
    contato: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    status: "active",
    logoUrl: "",
  });

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("user");

  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserFirstName, setEditUserFirstName] = useState("");
  const [editUserLastName, setEditUserLastName] = useState("");
  const [editUserContact, setEditUserContact] = useState("");
  const [editUserRole, setEditUserRole] = useState<(typeof ROLES)[number]>("user");
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select(
          "id, empresa_id, role, empresas(id, nome, cnpj, status, email, contato, endereco, cidade, estado, cep, logo_url, pix_chave, pix_instrucoes)"
        )
        .eq("id", user.id)
        .single();

      if (profile?.role) setCurrentRole(profile.role);
      if (profile?.empresa_id) setCompanyId(profile.empresa_id);

      if (profile?.empresas) {
        const emp = profile.empresas as unknown as {
          nome?: string;
          cnpj?: string;
          email?: string;
          contato?: string;
          endereco?: string;
          cidade?: string;
          estado?: string;
          cep?: string;
          status?: string;
          logo_url?: string;
          pix_chave?: string;
          pix_instrucoes?: string;
        };
        setCompanyData({
          nomeEmpresa: emp.nome || "",
          cnpj: emp.cnpj || "",
          email: emp.email || "",
          contato: emp.contato || "",
          endereco: emp.endereco || "",
          cidade: emp.cidade || "",
          estado: emp.estado || "",
          cep: emp.cep || "",
          status: emp.status || "active",
          logoUrl: emp.logo_url || "",
          pixChave: emp.pix_chave || "",
          pixInstrucoes: emp.pix_instrucoes || "",
        });
      }

      if (profile?.empresa_id) {
        const { data: companyUsers } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, role, contato")
          .eq("empresa_id", profile.empresa_id);
        if (companyUsers) {
          setUsers(
            companyUsers.map((u) => ({
              id: u.id,
              name:
                [(u as { first_name?: string }).first_name, (u as { last_name?: string }).last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim() ||
                u.email ||
                "",
              email: u.email ?? "",
              role: u.role ?? "user",
              contato: u.contato ?? undefined,
            }))
          );
        }
      }
    };

    fetchData()
      .catch(() => toast.error("Erro ao carregar"))
      .finally(() => setIsLoading(false));
  }, []);

  const formatCEP = (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    if (!digits) return "";
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleCompanyFieldChange = (field: keyof CompanyData, value: string) => {
    const formatters: Partial<Record<keyof CompanyData, (v: string) => string>> = {
      cnpj: formatCNPJ,
      contato: formatPhone,
      cep: formatCEP,
    };
    const formatted = formatters[field] ? formatters[field]!(value) : value;
    setCompanyData((prev) => ({ ...prev, [field]: formatted }));
  };

  const handleSaveCompany = async () => {
    // Status que interrompem o acesso da própria empresa exigem confirmação forte (risco de auto-lockout).
    if (companyData.status === "suspended" || companyData.status === "cancelled") {
      setIsStatusConfirmOpen(true);
      return;
    }
    await performSaveCompany();
  };

  const performSaveCompany = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile?.empresa_id) return;

      const { error } = await supabase
        .from("empresas")
        .update({
          nome: companyData.nomeEmpresa,
          cnpj: companyData.cnpj,
          status: companyData.status,
          email: companyData.email,
          contato: companyData.contato,
          endereco: companyData.endereco,
          cidade: companyData.cidade,
          estado: companyData.estado,
          cep: companyData.cep,
          pix_chave: companyData.pixChave || null,
          pix_instrucoes: companyData.pixInstrucoes || null,
        } as never)
        .eq("id", profile.empresa_id);
      if (error) throw error;

      setEditingCompany(false);
      toast.success("Dados salvos", { description: "Informações da empresa atualizadas com sucesso" });
    } catch (err: unknown) {
      toast.error("Erro ao salvar");
    }
  };

  const addUser = async () => {
    if (!inviteFirstName.trim() || !inviteEmail.trim()) return;
    if (!(await requireAal2())) return;
    setIsInviting(true);
    try {
      const fullName = [inviteFirstName.trim(), inviteLastName.trim()].filter(Boolean).join(" ");
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { email: inviteEmail.trim(), nome: fullName, role: inviteRole },
      });
      if (error) throw error;

      toast.success("Convite enviado", { description: `Um email foi enviado para ${inviteEmail}` });
      // invite-user rebaixa qualquer papel fora de admin/user para "user"; refletir
      // o que o servidor concede, não o escolhido, para o otimismo não mentir. ACH-AUTH-14.
      const grantedRole = inviteRole === "admin" ? "admin" : "user";
      setUsers([
        ...users,
        { id: "pending-" + Date.now(), name: fullName, email: inviteEmail.trim(), role: grantedRole },
      ]);
      setInviteFirstName("");
      setInviteLastName("");
      setInviteEmail("");
      setInviteRole("user");
    } catch {
      toast.error("Erro ao convidar", {
        description: "Verifique se a função 'invite-user' está implantada ou tente novamente.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const openEditUser = (u: CompanyUser) => {
    if (u.role === "ultra_admin") {
      toast.error("Usuário protegido", {
        description: "Ultra admin não pode ser editado aqui (seria rebaixado). Use /ultra-admin ou SQL.",
      });
      return;
    }
    setEditUserId(u.id);
    const [primeiro, ...resto] = (u.name || "").split(" ");
    setEditUserFirstName(primeiro || "");
    setEditUserLastName(resto.join(" "));
    setEditUserContact(u.contato || "");
    setEditUserRole(ROLES.includes(u.role as (typeof ROLES)[number]) ? (u.role as (typeof ROLES)[number]) : "user");
    setIsEditUserOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editUserId) return;
    if (!editUserFirstName.trim() || !editUserLastName.trim()) {
      toast.error("Nome e sobrenome são obrigatórios");
      return;
    }
    if (!(await requireAal2())) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: editUserFirstName,
          last_name: editUserLastName,
          contato: editUserContact,
          role: editUserRole,
        } as never)
        .eq("id", editUserId);
      if (error) throw error;
      const fullName = [editUserFirstName, editUserLastName].filter(Boolean).join(" ");
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUserId ? { ...u, name: fullName, contato: editUserContact, role: editUserRole } : u
        )
      );
      setIsEditUserOpen(false);
      toast.success("Usuário atualizado");
    } catch {
      toast.error("Erro ao atualizar usuário");
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    if (!(await requireAal2())) return;
    try {
      // Remoção via edge function: apaga o auth.user (invalida sessão/convites),
      // valida tenancy e audita. O delete direto no profile deixava o auth.user
      // órfão (usuário ainda logava, sem profile) e distorcia o limite de plano.
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: deleteUserId },
      });
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
      setIsDeleteUserOpen(false);
      setDeleteUserId(null);
      toast.success("Usuário removido");
    } catch (err) {
      toast.error("Erro ao remover usuário", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Formato inválido", { description: "Use PNG, JPG, WebP ou SVG." });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error("Arquivo muito grande", { description: "O logo deve ter no máximo 2MB." });
      e.target.value = "";
      return;
    }
    setPendingLogoFile(file);
  };

  const uploadCompanyLogo = async () => {
    if (!pendingLogoFile) return;
    if (!companyId) throw new Error("Empresa não encontrada");
    const ext = pendingLogoFile.name.split(".").pop()?.toLowerCase() || "png";
    const filePath = `${companyId}/logo-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(filePath, pendingLogoFile, { upsert: true });
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("company-logos").getPublicUrl(filePath);
    const { error: updateError } = await supabase
      .from("empresas")
      .update({ logo_url: data.publicUrl })
      .eq("id", companyId);
    if (updateError) throw updateError;

    setCompanyData((prev) => ({ ...prev, logoUrl: data.publicUrl }));
    setPendingLogoFile(null);
  };

  const handleSaveVisual = async () => {
    try {
      await uploadCompanyLogo();
      setEditingVisual(false);
      toast.success("Configuração salva", { description: "Visual da empresa atualizado com sucesso" });
    } catch {
      toast.error("Erro ao salvar logo");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CompanySummaryCard
          companyData={companyData}
          usersCount={users.length}
          editingCompany={editingCompany}
          pendingLogoFile={pendingLogoFile}
          onLogoPreview={() => setIsLogoPreviewOpen(true)}
        />

        <div className="lg:col-span-2">
          <Tabs defaultValue="dados" className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="dados" className="gap-2">
                  <Building2 size={16} /> Dados
                </TabsTrigger>
                <TabsTrigger value="usuarios" className="gap-2">
                  <UsersIcon size={16} /> Usuários{" "}
                  <Badge variant="secondary" className="ml-1">
                    {users.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="visual" className="gap-2">
                  <Palette size={16} /> Personalização
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dados" className="mt-6">
              <CompanyDataTab
                companyData={companyData}
                editing={editingCompany}
                isAdmin={isAdmin}
                isLoading={isLoading}
                onEdit={() => setEditingCompany(true)}
                onCancel={() => setEditingCompany(false)}
                onSave={handleSaveCompany}
                onChange={handleCompanyFieldChange}
                onStatusChange={(v) => setCompanyData((prev) => ({ ...prev, status: v }))}
              />
            </TabsContent>

            <TabsContent value="usuarios" className="mt-6">
              <CompanyUsersTab
                users={users}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
                inviteFirstName={inviteFirstName}
                inviteLastName={inviteLastName}
                inviteEmail={inviteEmail}
                inviteRole={inviteRole}
                isInviting={isInviting}
                onInviteFirstNameChange={setInviteFirstName}
                onInviteLastNameChange={setInviteLastName}
                onInviteEmailChange={setInviteEmail}
                onInviteRoleChange={setInviteRole}
                onAddUser={addUser}
                onEditUser={openEditUser}
                onDeleteUser={(id) => {
                  setDeleteUserId(id);
                  setIsDeleteUserOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="visual" className="mt-6">
              <CompanyVisualTab
                companyData={companyData}
                editing={editingVisual}
                isAdmin={isAdmin}
                isLoading={isLoading}
                pendingLogoFile={pendingLogoFile}
                onEdit={() => setEditingVisual(true)}
                onCancel={() => setEditingVisual(false)}
                onSave={handleSaveVisual}
                onLogoFileChange={handleLogoFileChange}
                onLogoPreview={() => setIsLogoPreviewOpen(true)}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <LogoPreviewDialog
        open={isLogoPreviewOpen}
        onOpenChange={setIsLogoPreviewOpen}
        pendingLogoFile={pendingLogoFile}
        logoUrl={companyData.logoUrl}
      />
      <EditUserDialog
        open={isEditUserOpen}
        onOpenChange={setIsEditUserOpen}
        firstName={editUserFirstName}
        lastName={editUserLastName}
        contact={editUserContact}
        role={editUserRole}
        onFirstNameChange={setEditUserFirstName}
        onLastNameChange={setEditUserLastName}
        onContactChange={setEditUserContact}
        onRoleChange={setEditUserRole}
        onSave={handleSaveUser}
      />
      <DeleteUserDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen} onConfirm={confirmDeleteUser} />
      <ConfirmDialog
        open={isStatusConfirmOpen}
        onOpenChange={setIsStatusConfirmOpen}
        onConfirm={() => {
          setIsStatusConfirmOpen(false);
          performSaveCompany();
        }}
        title={companyData.status === "cancelled" ? "Cancelar a empresa?" : "Suspender a empresa?"}
        description={
          companyData.status === "cancelled"
            ? "A empresa será marcada como cancelada. Isso pode bloquear o acesso de todos os usuários, inclusive o seu. Tem certeza?"
            : "A empresa será marcada como suspensa. Isso pode bloquear o acesso de todos os usuários, inclusive o seu. Tem certeza?"
        }
        itemName={companyData.nomeEmpresa}
        variant="destructive"
        confirmText={companyData.status === "cancelled" ? "Cancelar empresa" : "Suspender empresa"}
        cancelText="Voltar"
      />
    </>
  );
}
