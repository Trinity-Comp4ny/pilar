import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, MapPin, Briefcase, Calendar } from "lucide-react";

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  cargo: string;
  departamento: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  dataAdmissao: string;
  bio: string;
};

const STORAGE_KEY = "vrz-user-profile";

export default function Profile() {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const [data, setData] = useState<ProfileData>({ 
    name: "Usuário", 
    email: "", 
    phone: "",
    cargo: "",
    departamento: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    dataAdmissao: "",
    bio: ""
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setData({
          name: parsed.name || "Usuário",
          email: parsed.email || "",
          phone: parsed.phone || "",
          cargo: parsed.cargo || "",
          departamento: parsed.departamento || "",
          endereco: parsed.endereco || "",
          cidade: parsed.cidade || "",
          estado: parsed.estado || "",
          cep: parsed.cep || "",
          dataAdmissao: parsed.dataAdmissao || "",
          bio: parsed.bio || ""
        });
      } catch {
        // ignore
      }
    } else {
      const headerName = localStorage.getItem("vrz-user-name");
      if (headerName) setData((d) => ({ ...d, name: headerName }));
    }
  }, []);

  const handleChange = (field: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (data.name) localStorage.setItem("vrz-user-name", data.name);
    setEditing(false);
    toast({
      title: "Perfil atualizado",
      description: "Suas informações foram salvas com sucesso",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight">Perfil</h1>
          <p className="text-sm text-black/60 mt-1">Gerencie suas informações pessoais</p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90">
            Editar Perfil
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90">
              Salvar Alterações
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Summary Card */}
        <Card className="border border-black/5 lg:col-span-1">
          <CardHeader>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-24 w-24 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                <User size={40} className="text-[hsl(var(--primary))]" />
              </div>
              <div>
                <CardTitle className="text-xl">{data.name}</CardTitle>
                <CardDescription className="mt-1">{data.cargo || "Cargo não definido"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={16} className="text-black/40" />
                  <span className="text-black/70">{data.email}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={16} className="text-black/40" />
                  <span className="text-black/70">{data.phone}</span>
                </div>
              )}
              {data.departamento && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={16} className="text-black/40" />
                  <span className="text-black/70">{data.departamento}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Information */}
        <Card className="border border-black/5 lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações Detalhadas</CardTitle>
            <CardDescription>Mantenha seus dados atualizados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input 
                  id="name" 
                  value={data.name} 
                  onChange={handleChange("name")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={data.email} 
                  onChange={handleChange("email")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input 
                  id="phone" 
                  value={data.phone} 
                  onChange={handleChange("phone")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Input 
                  id="cargo" 
                  value={data.cargo} 
                  onChange={handleChange("cargo")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Input 
                  id="departamento" 
                  value={data.departamento} 
                  onChange={handleChange("departamento")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataAdmissao">Data de Admissão</Label>
                <Input 
                  id="dataAdmissao" 
                  type="date" 
                  value={data.dataAdmissao} 
                  onChange={handleChange("dataAdmissao")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input 
                  id="endereco" 
                  value={data.endereco} 
                  onChange={handleChange("endereco")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input 
                  id="cidade" 
                  value={data.cidade} 
                  onChange={handleChange("cidade")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input 
                  id="estado" 
                  value={data.estado} 
                  onChange={handleChange("estado")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input 
                  id="cep" 
                  value={data.cep} 
                  onChange={handleChange("cep")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Biografia</Label>
                <Textarea 
                  id="bio" 
                  value={data.bio} 
                  onChange={handleChange("bio")} 
                  readOnly={!editing} 
                  className={!editing ? "bg-black/5" : ""} 
                  rows={4}
                  placeholder="Conte um pouco sobre você..."
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
