import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Phone, Building2 } from "lucide-react";
import { formatPhone } from "@/lib/maskUtils";
import { getSafeErrorMessage } from "@/lib/safeError";

export default function Profile() {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [contact, setContact] = useState<string>("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;

        setEmail(auth.user.email || "");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("nome, contato, empresas(nome)")
          .eq("id", auth.user.id)
          .single();

        if (error) throw error;

        const fullName = profile?.nome || "";
        const parts = fullName.trim().split(/\s+/).filter(Boolean);
        const first = parts[0] || "";
        const last = parts.slice(1).join(" ");

        setFirstName(first);
        setLastName(last);
        setContact(profile?.contato || "");
        setCompanyName(profile?.empresas?.nome || "");
      } catch (err: unknown) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar perfil",
          description: getSafeErrorMessage(err),
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const nome = [firstName, lastName].filter(Boolean).join(" ").trim();

      const { error } = await supabase
        .from("profiles")
        .update({
          nome,
          contato: contact,
        })
        .eq("id", auth.user.id);

      if (error) throw error;

      setEditing(false);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso",
      });
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: getSafeErrorMessage(err),
      });
    }
  };

  const inputReadonlyClass = !editing
    ? "bg-black/5 border-black/10 text-black/80"
    : "border-accent-orange/20 focus-visible:ring-accent-orange/20";
  const alwaysReadonlyClass = "bg-black/5 border-black/10 text-black/80";

  return (
    <PageLayout
      header={
        <PageHeader title="Perfil" description="Gerencie suas informações">
          {!editing ? (
            <Button
              onClick={() => setEditing(true)}
              className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
              disabled={isLoading}
            >
              Editar Perfil
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} className="rounded-full">
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white"
              >
                Salvar Alterações
              </Button>
            </div>
          )}
        </PageHeader>
      }
    >
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className={"border border-black/5 lg:col-span-1 " + (editing ? "ring-1 ring-accent-orange/25" : "")}>
            <CardHeader>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-accent-orange/10 flex items-center justify-center">
                  <User size={40} className="text-accent-orange" />
                </div>
                <div>
                  <CardTitle className="text-xl">{[firstName, lastName].filter(Boolean).join(" ") || "-"}</CardTitle>
                  <CardDescription className="mt-1">{companyName || "-"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail size={16} className="text-black/40" />
                    <span className="text-black/70 break-all">{email}</span>
                  </div>
                )}
                {contact && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={16} className="text-black/40" />
                    <span className="text-black/70">{contact}</span>
                  </div>
                )}
                {companyName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 size={16} className="text-black/40" />
                    <span className="text-black/70">{companyName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={"border border-black/5 lg:col-span-2 " + (editing ? "ring-1 ring-accent-orange/25" : "")}>
            <CardHeader className={editing ? "bg-accent-orange/5" : ""}>
              <CardTitle>Dados do Perfil</CardTitle>
              <CardDescription>Atualize seus dados pessoais</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nome *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    readOnly={!editing}
                    className={inputReadonlyClass}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Sobrenome *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    readOnly={!editing}
                    className={inputReadonlyClass}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input id="company" value={companyName} readOnly className={alwaysReadonlyClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={email} readOnly className={alwaysReadonlyClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contato (Celular)</Label>
                  <Input
                    id="contact"
                    value={contact}
                    onChange={(e) => setContact(formatPhone(e.target.value))}
                    readOnly={!editing}
                    className={inputReadonlyClass}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
