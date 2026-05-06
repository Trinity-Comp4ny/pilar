import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { User, Mail, Phone, Building2, ShieldCheck } from "lucide-react";
import { formatPhone } from "@/lib/maskUtils";
import { usePageTitle } from "@/hooks/usePageTitle";
import { MfaSetup } from "@/components/MfaSetup";
import { profileEditSchema, profileEditDefaultValues, type ProfileEditFormData } from "@/schemas";

export default function Profile() {
  usePageTitle("Perfil");
  const [editing, setEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  const form = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    mode: "onChange",
    defaultValues: profileEditDefaultValues,
  });

  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const contact = form.watch("contact");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;

        setEmail(auth.user.email || "");

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("first_name, last_name, contato, empresas(nome)")
          .eq("id", auth.user.id)
          .single();

        if (error) throw error;

        form.reset({
          firstName: profile?.first_name ?? "",
          lastName: profile?.last_name ?? "",
          contact: profile?.contato ?? "",
        });
        setCompanyName(profile?.empresas?.nome || "");
      } catch (err: unknown) {
        toast.error("Erro ao carregar perfil");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [form]);

  const handleSave = async (values: ProfileEditFormData) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          contato: values.contact,
        })
        .eq("id", auth.user.id);

      if (error) throw error;

      setEditing(false);
      toast.success("Perfil atualizado", { description: "Suas informações foram salvas com sucesso" });
    } catch (err: unknown) {
      toast.error("Erro ao salvar");
    }
  };

  const inputReadonlyClass = !editing
    ? "bg-black/5 border-black/10 text-black/80"
    : "border-brand/20 focus-visible:ring-brand/20";
  const alwaysReadonlyClass = "bg-black/5 border-black/10 text-black/80";

  return (
    <PageLayout
      header={
        <PageHeader title="Perfil" description="Gerencie suas informações">
          {!editing ? (
            <Button
              onClick={() => setEditing(true)}
              className="rounded-full bg-brand hover:bg-brand/90 text-ink"
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
                onClick={form.handleSubmit(handleSave)}
                className="rounded-full bg-brand hover:bg-brand/90 text-ink"
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
          <Card className={"border border-black/5 lg:col-span-1 " + (editing ? "ring-1 ring-brand/25" : "")}>
            <CardHeader>
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-brand/10 flex items-center justify-center">
                  <User size={40} className="text-brand" />
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

          <Card className={"border border-black/5 lg:col-span-2 " + (editing ? "ring-1 ring-brand/25" : "")}>
            <CardHeader className={editing ? "bg-brand/5" : ""}>
              <CardTitle>Dados do Perfil</CardTitle>
              <CardDescription>Atualize seus dados pessoais</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly={!editing} className={inputReadonlyClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Sobrenome *</FormLabel>
                        <FormControl>
                          <Input {...field} readOnly={!editing} className={inputReadonlyClass} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input id="company" value={companyName} readOnly className={alwaysReadonlyClass} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={email} readOnly className={alwaysReadonlyClass} />
                  </div>
                  <FormField
                    control={form.control}
                    name="contact"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel>Contato (Celular)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                            readOnly={!editing}
                            className={inputReadonlyClass}
                            placeholder="(11) 99999-9999"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Segurança
              </CardTitle>
              <CardDescription>Autenticação de dois fatores (TOTP)</CardDescription>
            </CardHeader>
            <CardContent>
              <MfaSetup />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
