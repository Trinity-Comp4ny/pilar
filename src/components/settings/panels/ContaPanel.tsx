import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { User, Mail, Phone, Building2, Rocket } from "lucide-react";
import { formatPhone } from "@/lib/maskUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { profileEditSchema, profileEditDefaultValues, type ProfileEditFormData } from "@/schemas";
import { useAuth } from "@/contexts/AuthContext";
import { EmailChangeCard } from "@/components/profile/EmailChangeCard";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboardingState } from "@/hooks/useOnboardingState";

// Aba Conta do modal: identidade do usuário (nome, sobrenome, contato) e o email de
// login (troca com confirmação). Empresa é apenas-leitura aqui (muda na aba Empresa).
export function ContaPanel() {
  const { user, profile, refreshProfile } = useAuth();
  const { isAdmin } = usePermissions();
  const { reset: resetOnboarding } = useOnboardingState();
  const [editing, setEditing] = useState(false);

  const handleRefazerTour = async () => {
    try {
      await resetOnboarding();
      toast.success("Guia reativado", { description: "Os primeiros passos vão reaparecer no app." });
    } catch {
      toast.error("Não deu para reativar o guia");
    }
  };

  const companyName = profile?.empresas?.nome ?? "";
  const email = user?.email ?? "";
  const isLoading = !profile;

  const form = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    mode: "onChange",
    defaultValues: profileEditDefaultValues,
  });

  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const contact = form.watch("contact");

  useEffect(() => {
    if (!profile) return;
    form.reset({
      firstName: profile.first_name ?? "",
      lastName: profile.last_name ?? "",
      contact: profile.contato ?? "",
    });
  }, [profile, form]);

  const handleSave = async (values: ProfileEditFormData) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.firstName.trim(),
          last_name: values.lastName.trim(),
          contato: values.contact,
        })
        .eq("id", user.id);

      if (error) throw error;

      setEditing(false);
      toast.success("Conta atualizada", { description: "Suas informações foram salvas com sucesso" });
      void refreshProfile();
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const inputReadonlyClass = !editing
    ? "bg-black/5 border-black/10 text-black/80"
    : "border-brand/20 focus-visible:ring-brand/20";
  const alwaysReadonlyClass = "bg-black/5 border-black/10 text-black/80";

  if (isLoading) {
    return (
      <Card className="border border-black/5">
        <CardContent className="pt-6 grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-16 w-16 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
            <User size={28} className="text-ink" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold truncate">{[firstName, lastName].filter(Boolean).join(" ") || "—"}</p>
            <div className="mt-1 space-y-0.5 text-sm text-black/60">
              {email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={14} className="text-black/40" /> <span className="break-all">{email}</span>
                </span>
              )}
              {contact && (
                <span className="flex items-center gap-1.5">
                  <Phone size={14} className="text-black/40" /> {contact}
                </span>
              )}
              {companyName && (
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} className="text-black/40" /> {companyName}
                </span>
              )}
            </div>
          </div>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)} variant="brand" className="rounded-full flex-shrink-0">
            Editar
          </Button>
        ) : (
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" onClick={() => setEditing(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button onClick={form.handleSubmit(handleSave)} variant="brand" className="rounded-full">
              Salvar
            </Button>
          </div>
        )}
      </div>

      <Card className={"border border-black/5 " + (editing ? "ring-1 ring-brand/25" : "")}>
        <CardHeader className={editing ? "bg-brand/5" : ""}>
          <CardTitle>Dados pessoais</CardTitle>
          <CardDescription>Atualize seus dados</CardDescription>
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
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem className="space-y-2 md:col-span-2">
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

      <EmailChangeCard
        currentEmail={email}
        onChanged={() => {
          /* confirmação chega por email; o profile atualiza no próximo load */
        }}
      />

      {isAdmin && (
        <Card className="border border-black/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket size={16} className="text-ink" /> Guia de primeiros passos
            </CardTitle>
            <CardDescription>Reative o checklist e os balões de ajuda do início.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="rounded-full" onClick={handleRefazerTour}>
              Refazer o guia
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
