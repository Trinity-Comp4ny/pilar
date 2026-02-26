import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpRight, Building2, Maximize2, Users as UsersIcon, Palette, Upload, Pencil, Trash2 } from "lucide-react";
import { formatCNPJ, formatPhone, onlyDigits } from "@/lib/maskUtils";

type CompanyUser = { id: string; name: string; email: string; role: string; contato?: string };
type CompanyData = {
  nomeEmpresa: string;
  cnpj: string;
  email: string;
  contato: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  status: string;
  logoUrl?: string;
};

const ROLES = ["admin", "financeiro", "marketing", "operacional", "user"] as const;
const STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "cancelled", label: "Cancelada" },
] as const;

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
  
  // Company data
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
  
  // Users state
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

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      // Fetch Profile & Company ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, empresa_id, role, empresas(id, nome, cnpj, status, email, contato, endereco, cidade, estado, cep, logo_url)')
        .eq('id', user.id)
        .single();

      if (profile?.role) setCurrentRole((profile as any).role);
      if (profile?.empresa_id) setCompanyId((profile as any).empresa_id);

      if (profile?.empresas) {
        const emp = profile.empresas as any;
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

      // Fetch Users
      if (profile?.empresa_id) {
        const { data: companyUsers } = await supabase
          .from('profiles')
          .select('id, nome, email, role, contato')
          .eq('empresa_id', profile.empresa_id);
        
        if (companyUsers) {
          setUsers(companyUsers.map((u: any) => ({
            id: u.id,
            name: u.nome,
            email: u.email,
            role: u.role,
            contato: u.contato,
          })));
        }
      }
    };

    fetchData()
      .catch((e) => {
        toast({
          variant: "destructive",
          title: "Erro ao carregar",
          description: e?.message,
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleCompanyChange = (field: keyof CompanyData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCompanyData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCompanyStatusChange = (value: string) => {
    setCompanyData((prev) => ({ ...prev, status: value }));
  };
  
  const handleSaveCompany = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get company ID
      const { data: profile } = await supabase.from('profiles').select('empresa_id').eq('id', user.id).single();
      if (!profile?.empresa_id) return;

      const { error } = await supabase
        .from('empresas')
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
        .eq('id', profile.empresa_id);

      if (error) throw error;

      setEditingCompany(false);
      toast({
        title: "Dados salvos",
        description: "Informações da empresa atualizadas com sucesso",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message
      });
    }
  };

  const addUser = async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    
    setIsInviting(true);
    try {
      // Call Edge Function to invite user
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: inviteEmail.trim(), 
          nome: inviteName.trim(), 
          role: inviteRole 
        } 
      });

      if (error) throw error;

      toast({
        title: "Convite enviado",
        description: `Um email foi enviado para ${inviteEmail}`,
      });

      // Optimistically add to list (or refetch)
      setUsers([...users, {
        id: "pending-" + Date.now(),
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      }]);

      setInviteName("");
      setInviteEmail("");
      setInviteRole("user");

    } catch (error: any) {
      console.error("Invite error:", error);
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
    setEditUserRole((ROLES.includes(u.role as any) ? (u.role as any) : "user") as any);
    setIsEditUserOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editUserId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: editUserName,
          contato: editUserContact,
          role: editUserRole,
        })
        .eq("id", editUserId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUserId
            ? { ...u, name: editUserName, contato: editUserContact, role: editUserRole }
            : u
        )
      );

      setIsEditUserOpen(false);
      toast({ title: "Usuário atualizado" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao atualizar usuário", description: e?.message });
    }
  };

  const requestDeleteUser = (id: string) => {
    setDeleteUserId(id);
    setIsDeleteUserOpen(true);
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
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao remover usuário", description: e?.message });
    }
  };
  
  const handleSaveVisual = () => {
    setEditingVisual(false);
    toast({
      title: "Configuração salva",
      description: "Visual da empresa atualizado com sucesso",
    });
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    const publicUrl = data.publicUrl;

    const { error: updateError } = await supabase
      .from("empresas")
      .update({ logo_url: publicUrl })
      .eq("id", companyId);

    if (updateError) throw updateError;

    setCompanyData((prev) => ({ ...prev, logoUrl: publicUrl }));
    setPendingLogoFile(null);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "active") {
      return { label: "Ativa", className: "bg-emerald-600/15 text-emerald-700 border border-emerald-600/20" };
    }
    if (s === "suspended") {
      return { label: "Suspensa", className: "bg-amber-600/15 text-amber-700 border border-amber-600/20" };
    }
    if (s === "cancelled") {
      return { label: "Cancelada", className: "bg-red-600/15 text-red-700 border border-red-600/20" };
    }
    return { label: status || "-", className: "bg-black/10 text-black/70 border border-black/10" };
  };

  const formatCEP = (value: string) => {
    const digits = onlyDigits(value).slice(0, 8);
    if (!digits) return "";
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const inputReadonlyClass = !editingCompany ? "bg-black/5 border-black/10 text-black/80" : "border-accent-orange/20 focus-visible:ring-accent-orange/20";
  const alwaysReadonlyClass = "bg-black/5 border-black/10 text-black/80";

  return (
    <PageLayout
      header={
        <PageHeader title="Empresa" description="Gerencie as informações e configurações da empresa" />
      }
    >
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={"border border-black/5 lg:col-span-1 overflow-hidden " + (editingCompany ? "ring-1 ring-accent-orange/25" : "")}
          >
            <CardHeader className={(editingCompany ? "bg-accent-orange/5" : "")}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div
                  role="button"
                  tabIndex={0}
                  className="h-28 w-28 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => {
                    if (pendingLogoFile || companyData.logoUrl) setIsLogoPreviewOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (pendingLogoFile || companyData.logoUrl)) setIsLogoPreviewOpen(true);
                  }}
                >
                  {pendingLogoFile ? (
                    <img
                      src={URL.createObjectURL(pendingLogoFile)}
                      alt="Logo (prévia)"
                      className="w-full h-full object-contain p-4"
                    />
                  ) : companyData.logoUrl ? (
                    <img src={companyData.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                  ) : (
                    <span className="text-xs text-black/50">Sem logo</span>
                  )}
                </div>

                <div className="min-w-0">
                  <CardTitle className="text-xl truncate">{companyData.nomeEmpresa || "Empresa"}</CardTitle>
                  <div className="mt-2 flex justify-center">
                    <Badge className={"rounded-full " + getStatusBadge(companyData.status).className}>
                      {getStatusBadge(companyData.status).label}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs text-black/50">Email</p>
                    <p className="text-sm text-black/80 break-all">{companyData.email || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-black/50">Contato</p>
                    <p className="text-sm text-black/80">{companyData.contato || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-black/50">CNPJ</p>
                    <p className="text-sm text-black/80">{companyData.cnpj || "-"}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-black/50">Endereço</p>
                    <p className="text-sm text-black/80">{companyData.endereco || "-"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-black/50">Cidade</p>
                      <p className="text-sm text-black/80">{companyData.cidade || "-"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-black/50">Estado</p>
                      <p className="text-sm text-black/80">{companyData.estado || "-"}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-black/50">CEP</p>
                    <p className="text-sm text-black/80">{companyData.cep || "-"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-black/5 bg-white p-4">
                  <p className="text-xs text-black/50">Pessoas vinculadas</p>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-sm font-medium">{users.length}</p>
                    <Link
                      to="/pessoas"
                      className="text-sm text-accent-orange hover:underline inline-flex items-center gap-1"
                    >
                      Ver pessoas
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <Tabs defaultValue="dados" className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="dados" className="gap-2">
                    <Building2 size={16} />
                    Dados
                  </TabsTrigger>
                  <TabsTrigger value="usuarios" className="gap-2">
                    <UsersIcon size={16} />
                    Usuários
                    <Badge variant="secondary" className="ml-1">
                      {users.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="visual" className="gap-2">
                    <Palette size={16} />
                    Personalização
                  </TabsTrigger>
                </TabsList>
              </div>

          {/* Company Data Section */}
          <TabsContent value="dados" className="mt-6">
            <Card className={"border border-black/5 " + (editingCompany ? "ring-1 ring-accent-orange/25" : "")}
            >
              <CardHeader className={"flex flex-row items-center justify-between " + (editingCompany ? "bg-accent-orange/5" : "")}
              >
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 size={20} />
                    Dados da Empresa
                  </CardTitle>
                  <CardDescription className="mt-1">Informações gerais sobre a empresa</CardDescription>
                </div>
                {!editingCompany ? (
                  <Button
                    onClick={() => setEditingCompany(true)}
                    className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                    disabled={!isAdmin || isLoading}
                  >
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditingCompany(false)} className="rounded-full">
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveCompany}
                      className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                    >
                      Salvar
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input
                      value={companyData.nomeEmpresa}
                      onChange={handleCompanyChange("nomeEmpresa")}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      value={companyData.cnpj}
                      onChange={(e) => setCompanyData((prev) => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={companyData.email}
                      onChange={handleCompanyChange("email")}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contato</Label>
                    <Input
                      value={companyData.contato}
                      onChange={(e) => setCompanyData((prev) => ({ ...prev, contato: formatPhone(e.target.value) }))}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Status</Label>
                    {editingCompany ? (
                      <Select value={companyData.status} onValueChange={handleCompanyStatusChange}>
                        <SelectTrigger className={inputReadonlyClass}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className={"h-10 rounded-md px-3 flex items-center " + alwaysReadonlyClass}>
                        <Badge className={"rounded-full " + getStatusBadge(companyData.status).className}>
                          {getStatusBadge(companyData.status).label}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Endereço</Label>
                    <Input
                      value={companyData.endereco}
                      onChange={handleCompanyChange("endereco")}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={companyData.cidade}
                      onChange={handleCompanyChange("cidade")}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={companyData.estado}
                      onChange={handleCompanyChange("estado")}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={companyData.cep}
                      onChange={(e) => setCompanyData((prev) => ({ ...prev, cep: formatCEP(e.target.value) }))}
                      readOnly={!editingCompany}
                      className={inputReadonlyClass}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Section */}
          <TabsContent value="usuarios" className="mt-6">
            <Card className="border border-black/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon size={20} />
                  Usuários da Empresa
                </CardTitle>
                <CardDescription>Gerencie os usuários com acesso ao sistema</CardDescription>
              </CardHeader>
              <CardContent>
                {isAdmin && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-name">Nome completo</Label>
                        <Input
                          id="invite-name"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="Nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="email@empresa.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Função</Label>
                        <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <Button
                        onClick={addUser}
                        className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                        disabled={isInviting || !inviteName.trim() || !inviteEmail.trim()}
                      >
                        {isInviting ? "Enviando convite..." : "Adicionar Usuário"}
                      </Button>
                      <p className="text-xs text-black/50">
                        O convite será enviado por email e o usuário aparecerá como pendente.
                      </p>
                    </div>
                  </div>
                )}
                <div className="hidden md:block mt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-black/50">
                            Nenhum usuário adicionado
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((u) => (
                          <TableRow key={u.id} className={u.id.startsWith("pending-") ? "opacity-80" : ""}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span className="line-clamp-1">{u.name}</span>
                                {u.id.startsWith("pending-") && <Badge variant="secondary">Pendente</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-black/70">{u.email}</TableCell>
                            <TableCell className="text-black/70">{u.role || "-"}</TableCell>
                            <TableCell className="text-right">
                              {isAdmin && !u.id.startsWith("pending-") ? (
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => openEditUser(u)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-full text-red-600"
                                    onClick={() => requestDeleteUser(u.id)}
                                    disabled={u.id === currentUserId}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-black/40">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="md:hidden mt-6 space-y-3">
                  {users.length === 0 ? (
                    <div className="text-sm text-black/50 bg-black/5 rounded-lg p-4">
                      Nenhum usuário adicionado
                    </div>
                  ) : (
                    users.map((u) => (
                      <Card key={u.id} className="border border-black/5">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium line-clamp-1">{u.name}</p>
                                {u.id.startsWith("pending-") && (
                                  <Badge variant="secondary">Pendente</Badge>
                                )}
                              </div>
                              <p className="text-xs text-black/60 break-all mt-1">{u.email}</p>
                              <p className="text-xs text-black/60 mt-1">{u.role || "-"}</p>
                            </div>
                            {isAdmin && !u.id.startsWith("pending-") ? (
                              <div className="flex flex-col gap-2">
                                <Button variant="outline" size="sm" className="rounded-full" onClick={() => openEditUser(u)}>
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-full text-red-600"
                                  onClick={() => requestDeleteUser(u.id)}
                                  disabled={u.id === currentUserId}
                                >
                                  Remover
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visual Config Section */}
          <TabsContent value="visual" className="mt-6">
            <Card className={"border border-black/5 " + (editingVisual ? "ring-1 ring-accent-orange/25" : "")}
            >
              <CardHeader className={"flex flex-row items-center justify-between " + (editingVisual ? "bg-accent-orange/5" : "")}
              >
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette size={20} />
                    Personalização Visual
                  </CardTitle>
                  <CardDescription className="mt-1">Envie a logo da sua empresa</CardDescription>
                </div>
                {!editingVisual ? (
                  <Button
                    onClick={() => setEditingVisual(true)}
                    className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                    disabled={!isAdmin || isLoading}
                  >
                    Editar
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEditingVisual(false)} className="rounded-full">
                      Cancelar
                    </Button>
                    <Button
                      onClick={async () => {
                        try {
                          await uploadCompanyLogo();
                          handleSaveVisual();
                        } catch (e: any) {
                          toast({ variant: "destructive", title: "Erro ao salvar logo", description: e?.message });
                        }
                      }}
                      className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
                    >
                      Salvar
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Upload size={14} />
                      Logo da Empresa
                    </Label>
                    <Input type="file" accept="image/*" onChange={handleLogoFileChange} disabled={!editingVisual} />
                    <p className="text-xs text-black/50">
                      Recomendado: PNG/SVG com fundo transparente.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Pré-visualização</Label>
                      {(pendingLogoFile || companyData.logoUrl) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => setIsLogoPreviewOpen(true)}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      className="p-4 bg-black/5 rounded-xl min-h-[180px] border border-black/10 flex items-center justify-center cursor-pointer"
                      onClick={() => {
                        if (pendingLogoFile || companyData.logoUrl) setIsLogoPreviewOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (pendingLogoFile || companyData.logoUrl)) setIsLogoPreviewOpen(true);
                      }}
                    >
                      {pendingLogoFile ? (
                        <img
                          src={URL.createObjectURL(pendingLogoFile)}
                          alt="Logo (prévia)"
                          className="max-h-[240px] w-full object-contain"
                        />
                      ) : companyData.logoUrl ? (
                        <img src={companyData.logoUrl} alt="Logo" className="max-h-[240px] w-full object-contain" />
                      ) : (
                        <span className="text-sm text-black/50">Nenhuma logo enviada</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={isLogoPreviewOpen} onOpenChange={setIsLogoPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Logo da empresa</DialogTitle>
            <DialogDescription>Pré-visualização ampliada.</DialogDescription>
          </DialogHeader>
          <div className="bg-black/5 border border-black/10 rounded-xl p-6 flex items-center justify-center min-h-[320px]">
            {pendingLogoFile ? (
              <img
                src={URL.createObjectURL(pendingLogoFile)}
                alt="Logo (prévia)"
                className="max-h-[520px] w-full object-contain"
              />
            ) : companyData.logoUrl ? (
              <img src={companyData.logoUrl} alt="Logo" className="max-h-[520px] w-full object-contain" />
            ) : (
              <span className="text-sm text-black/50">Nenhuma logo enviada</span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Altere o nome, contato e função do usuário.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Nome completo</Label>
              <Input value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Input value={editUserContact} onChange={(e) => setEditUserContact(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={editUserRole} onValueChange={(v) => setEditUserRole(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button onClick={handleSaveUser} className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white">
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá o perfil do usuário da sua empresa. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDeleteUser}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
