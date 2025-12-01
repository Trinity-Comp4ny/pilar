import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users as UsersIcon, Palette, Upload } from "lucide-react";

type CompanyUser = { id: string; name: string; email: string; cargo?: string };
type CompanyData = {
  nomeEmpresa: string;
  cnpj: string;
  razaoSocial: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  sobre: string;
};
type BrandConfig = {
  headerLogo?: string;
  sidebarLogo?: string;
  primary?: string;
  accent?: string;
  text?: string;
  background?: string;
};

const USERS_KEY = "vrz-company-users";
const BRAND_KEY = "vrz-company-brand";
const COMPANY_KEY = "vrz-company-data";

export default function Company() {
  const { toast } = useToast();
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingVisual, setEditingVisual] = useState(false);
  
  // Company data
  const [companyData, setCompanyData] = useState<CompanyData>({
    nomeEmpresa: "",
    cnpj: "",
    razaoSocial: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    sobre: ""
  });
  
  // Users state
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [name, setName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userCargo, setUserCargo] = useState("");

  // Brand state
  const [brand, setBrand] = useState<BrandConfig>({
    primary: "#f97316",
    accent: "#f97316",
    text: "#ffffff",
    background: "#000000",
  });

  // Load persisted data
  useEffect(() => {
    const storedCompany = localStorage.getItem(COMPANY_KEY);
    if (storedCompany) {
      try { setCompanyData(JSON.parse(storedCompany)); } catch {}
    }
    const storedUsers = localStorage.getItem(USERS_KEY);
    if (storedUsers) {
      try { setUsers(JSON.parse(storedUsers)); } catch {}
    }
    const storedBrand = localStorage.getItem(BRAND_KEY);
    if (storedBrand) {
      try { setBrand((prev) => ({ ...prev, ...JSON.parse(storedBrand) })); } catch {}
    }
  }, []);

  // Util: HEX -> HSL triplet string: "H S% L%"
  function hexToHslTriplet(hex?: string): string | null {
    if (!hex) return null;
    let c = hex.replace(/^#/, "");
    if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
    if (c.length !== 6) return null;
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    const H = Math.round(h * 360);
    const S = Math.round(s * 100);
    const L = Math.round(l * 100);
    return `${H} ${S}% ${L}%`;
  }

  // Removed global color application to prevent system-wide theme changes
  // Colors are now only for preview/display purposes in the Company page

  const handleCompanyChange = (field: keyof CompanyData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCompanyData((prev) => ({ ...prev, [field]: e.target.value }));
  };
  
  const handleSaveCompany = () => {
    localStorage.setItem(COMPANY_KEY, JSON.stringify(companyData));
    setEditingCompany(false);
    toast({
      title: "Dados salvos",
      description: "Informações da empresa atualizadas com sucesso",
    });
  };

  const addUser = () => {
    if (!name.trim() || !userEmail.trim()) return;
    const newUser: CompanyUser = { 
      id: crypto.randomUUID(), 
      name: name.trim(), 
      email: userEmail.trim(),
      cargo: userCargo.trim() || undefined
    };
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    setName("");
    setUserEmail("");
    setUserCargo("");
    toast({
      title: "Usuário adicionado",
      description: `${name} foi adicionado com sucesso`,
    });
  };

  const removeUser = (id: string) => {
    const updated = users.filter(u => u.id !== id);
    setUsers(updated);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
  };

  const handleFile = (key: keyof BrandConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = { ...brand, [key]: dataUrl } as BrandConfig;
      setBrand(updated);
      localStorage.setItem(BRAND_KEY, JSON.stringify(updated));
    };
    reader.readAsDataURL(file);
  };

  const handleColor = (key: keyof BrandConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...brand, [key]: e.target.value } as BrandConfig;
    setBrand(updated);
    localStorage.setItem(BRAND_KEY, JSON.stringify(updated));
  };
  
  const handleSaveVisual = () => {
    setEditingVisual(false);
    toast({
      title: "Configuração salva",
      description: "Visual da empresa atualizado com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Empresa</h1>
        <p className="text-sm text-black/60 mt-1">Gerencie as informações e configurações da empresa</p>
      </div>

      {/* Company Data Section */}
      <Card className="border border-black/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 size={20} />
              Dados da Empresa
            </CardTitle>
            <CardDescription className="mt-1">Informações gerais sobre a empresa</CardDescription>
          </div>
          {!editingCompany ? (
            <Button onClick={() => setEditingCompany(true)} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90">
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingCompany(false)}>Cancelar</Button>
              <Button onClick={handleSaveCompany} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90">
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Empresa</Label>
              <Input value={companyData.nomeEmpresa} onChange={handleCompanyChange("nomeEmpresa")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={companyData.cnpj} onChange={handleCompanyChange("cnpj")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Razão Social</Label>
              <Input value={companyData.razaoSocial} onChange={handleCompanyChange("razaoSocial")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={companyData.email} onChange={handleCompanyChange("email")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={companyData.telefone} onChange={handleCompanyChange("telefone")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço</Label>
              <Input value={companyData.endereco} onChange={handleCompanyChange("endereco")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={companyData.cidade} onChange={handleCompanyChange("cidade")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={companyData.estado} onChange={handleCompanyChange("estado")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={companyData.cep} onChange={handleCompanyChange("cep")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Sobre</Label>
              <Textarea value={companyData.sobre} onChange={handleCompanyChange("sobre")} readOnly={!editingCompany} className={!editingCompany ? "bg-black/5" : ""} rows={3} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Section */}
      <Card className="border border-black/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon size={20} />
            Usuários da Empresa
          </CardTitle>
          <CardDescription>Gerencie os usuários com acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="email@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-cargo">Cargo</Label>
              <Input id="user-cargo" value={userCargo} onChange={(e) => setUserCargo(e.target.value)} placeholder="Cargo" />
            </div>
          </div>
          <Button onClick={addUser} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 mb-4">
            Adicionar Usuário
          </Button>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-black/10">
                  <th className="py-2 pr-4 font-medium">Nome</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Cargo</th>
                  <th className="py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td className="py-3 text-black/50" colSpan={4}>Nenhum usuário adicionado</td>
                  </tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-b border-black/5">
                    <td className="py-2 pr-4">{u.name}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.cargo || "-"}</td>
                    <td className="py-2">
                      <Button variant="outline" size="sm" onClick={() => removeUser(u.id)}>Remover</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Visual Config Section */}
      <Card className="border border-black/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette size={20} />
              Personalização Visual
            </CardTitle>
            <CardDescription className="mt-1">Configure cores e logotipos do sistema</CardDescription>
          </div>
          {!editingVisual ? (
            <Button onClick={() => setEditingVisual(true)} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90">
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingVisual(false)}>Cancelar</Button>
              <Button onClick={handleSaveVisual} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90">
                Salvar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload size={14} />
                  Logo do Header
                </Label>
                <Input type="file" accept="image/*" onChange={handleFile("headerLogo")} disabled={!editingVisual} />
                {brand.headerLogo && (
                  <div className="mt-2 p-4 bg-black/5 rounded-lg">
                    <img src={brand.headerLogo} alt="Logo Header" className="h-16 object-contain" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload size={14} />
                  Logo da Sidebar
                </Label>
                <Input type="file" accept="image/*" onChange={handleFile("sidebarLogo")} disabled={!editingVisual} />
                {brand.sidebarLogo && (
                  <div className="mt-2 p-4 bg-black/5 rounded-lg">
                    <img src={brand.sidebarLogo} alt="Logo Sidebar" className="h-16 object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={brand.primary} onChange={handleColor("primary")} className="w-12 h-10 p-1 cursor-pointer" disabled={!editingVisual} />
                  <Input value={brand.primary} onChange={handleColor("primary")} className="font-mono text-sm" disabled={!editingVisual} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor de Acento</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={brand.accent} onChange={handleColor("accent")} className="w-12 h-10 p-1 cursor-pointer" disabled={!editingVisual} />
                  <Input value={brand.accent} onChange={handleColor("accent")} className="font-mono text-sm" disabled={!editingVisual} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor do Texto</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={brand.text} onChange={handleColor("text")} className="w-12 h-10 p-1 cursor-pointer" disabled={!editingVisual} />
                  <Input value={brand.text} onChange={handleColor("text")} className="font-mono text-sm" disabled={!editingVisual} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor de Fundo</Label>
                <div className="flex items-center gap-3">
                  <Input type="color" value={brand.background} onChange={handleColor("background")} className="w-12 h-10 p-1 cursor-pointer" disabled={!editingVisual} />
                  <Input value={brand.background} onChange={handleColor("background")} className="font-mono text-sm" disabled={!editingVisual} />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
