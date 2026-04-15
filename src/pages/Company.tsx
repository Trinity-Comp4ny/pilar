import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users as UsersIcon, Palette } from "lucide-react";
import { formatCNPJ, formatPhone, onlyDigits } from "@/lib/maskUtils";
import { getSafeErrorMessage } from "@/lib/safeError";
import type { CompanyData, CompanyUser } from "./company/types";
import { ROLES } from "./company/types";
import { CompanySummaryCard } from "./company/components/CompanySummaryCard";
import { CompanyDataTab } from "./company/components/CompanyDataTab";
import { CompanyUsersTab } from "./company/components/CompanyUsersTab";
import { CompanyVisualTab } from "./company/components/CompanyVisualTab";
import { LogoPreviewDialog, EditUserDialog, DeleteUserDialog } from "./company/components/CompanyDialogs";

export default function Company() {
  const { toast } = useToast();
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingVisual, setEditingVisual] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("user");
  const isAdmin = currentRole === "admin";
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
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof ROLES)[number]>("user");

  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserContact, setEditUserContact] = useState("");
  const [editUserRole, setEditUserRole] = useState<(typeof ROLES)[number]>("user");
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

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
          "id, empresa_id, role, empresas(id, nome, cnpj, status, email, contato, endereco, cidade, estado, cep, logo_url)"
        )
        .eq("id", user.id)
        .single();

      if (profile?.role) setCurrentRole(profile.role);
      if (profile?.empresa_id) setCompanyId(profile.empresa_id);

      if (profile?.empresas) {
        const emp = profile.empresas;
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
        });
      }

      if (profile?.empresa_id) {
        const { data: companyUsers } = await supabase
          .from("profiles")
          .select("id, nome, email, role, contato")
          .eq("empresa_id", profile.empresa_id);
        if (companyUsers) {
          setUsers(
            companyUsers.map((u) => ({ id: u.id, name: u.nome, email: u.email, role: u.role, contato: u.contato }))
          );
        }
      }
    };

    fetchData()
      .catch((e: unknown) =>
        toast({ variant: "destructive", title: "Erro ao carregar", description: getSafeErrorMessage(e) })
      )
      .finally(() => setIsLoading(false));
  }, [toast]);

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
        })
        .eq("id", profile.empresa_id);
      if (error) throw error;

      setEditingCompany(false);
      toast({ title: "Dados salvos", description: "Informações da empresa atualizadas com sucesso" });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: getSafeErrorMessage(err) });
    }
  };

  const addUser = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { email: inviteEmail.trim(), nome: inviteName.trim(), role: inviteRole },
      });
      if (error) throw error;

      toast({ title: "Convite enviado", description: `Um email foi enviado para ${inviteEmail}` });
      setUsers([
        ...users,
        { id: "pending-" + Date.now(), name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole },
      ]);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("user");
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao convidar",
        description: "Verifique se a função 'invite-user' está implantada ou tente novamente.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const openEditUser = (u: CompanyUser) => {
    setEditUserId(u.id);
    setEditUserName(u.name || "");
    setEditUserContact(u.contato || "");
    setEditUserRole(ROLES.includes(u.role as (typeof ROLES)[number]) ? (u.role as (typeof ROLES)[number]) : "user");
    setIsEditUserOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editUserId) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nome: editUserName, contato: editUserContact, role: editUserRole })
        .eq("id", editUserId);
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUserId ? { ...u, name: editUserName, contato: editUserContact, role: editUserRole } : u
        )
      );
      setIsEditUserOpen(false);
      toast({ title: "Usuário atualizado" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Erro ao atualizar usuário", description: getSafeErrorMessage(e) });
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserId) return;
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", deleteUserId);
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
      setIsDeleteUserOpen(false);
      setDeleteUserId(null);
      toast({ title: "Usuário removido" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Erro ao remover usuário", description: getSafeErrorMessage(e) });
    }
  };

  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ variant: "destructive", title: "Formato inválido", description: "Use PNG, JPG, WebP ou SVG." });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast({ variant: "destructive", title: "Arquivo muito grande", description: "O logo deve ter no máximo 2MB." });
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
      toast({ title: "Configuração salva", description: "Visual da empresa atualizado com sucesso" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Erro ao salvar logo", description: getSafeErrorMessage(e) });
    }
  };

  return (
    <PageLayout
      header={<PageHeader title="Empresa" description="Gerencie as informações e configurações da empresa" />}
    >
      <div className="w-full max-w-6xl mx-auto space-y-6">
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
                  inviteName={inviteName}
                  inviteEmail={inviteEmail}
                  inviteRole={inviteRole}
                  isInviting={isInviting}
                  onInviteNameChange={setInviteName}
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
        name={editUserName}
        contact={editUserContact}
        role={editUserRole}
        onNameChange={setEditUserName}
        onContactChange={setEditUserContact}
        onRoleChange={setEditUserRole}
        onSave={handleSaveUser}
      />
      <DeleteUserDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen} onConfirm={confirmDeleteUser} />
    </PageLayout>
  );
}
