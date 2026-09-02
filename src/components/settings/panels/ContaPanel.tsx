import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { Mail, Phone, Building2, Rocket, Camera, X } from "lucide-react";
import { formatPhone } from "@/lib/maskUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { profileEditSchema, profileEditDefaultValues, type ProfileEditFormData } from "@/schemas";
import { useAuth } from "@/contexts/AuthContext";
import { AvatarStack } from "@/components/AvatarStack";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmailChangeCard } from "@/components/profile/EmailChangeCard";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { PESSOAS_EMPRESA_QUERY_KEY } from "@/pages/meu-trabalho/hooks";

const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB, mesmo limite do logo de empresa

// Aba Conta do modal: identidade do usuário (nome, sobrenome, contato) e o email de
// login (troca com confirmação). Empresa é apenas-leitura aqui (muda na aba Empresa).
export function ContaPanel() {
  const { user, profile, profileError, refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const { isAdmin } = usePermissions();
  const { reset: resetOnboarding } = useOnboardingState();
  const [editing, setEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isRemoveAvatarConfirmOpen, setIsRemoveAvatarConfirmOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: getSafeErrorMessage(err, "Confira os dados e tente de novo."),
      });
    }
  };

  // Após qualquer troca de avatar_url, refresca o profile do contexto (header do
  // app, esta tela) e invalida usePessoasEmpresa (seletor de responsável, filtros
  // em Meu Trabalho) para a foto aparecer sem precisar recarregar a página.
  const sincronizarAvatarLocal = async () => {
    await refreshProfile();
    queryClient.invalidateQueries({ queryKey: PESSOAS_EMPRESA_QUERY_KEY });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato inválido", { description: "Use PNG, JPG ou WebP." });
      return;
    }
    if (file.size > AVATAR_MAX_SIZE) {
      toast.error("Arquivo muito grande", { description: "A foto deve ter no máximo 2MB." });
      return;
    }

    setUploadingAvatar(true);
    try {
      // Path fixo por usuário (upsert): troca de foto substitui a anterior no
      // bucket em vez de acumular arquivo novo a cada upload.
      const filePath = `${user.id}/avatar`;
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("user-avatars").getPublicUrl(filePath);
      // Querystring de cache-busting: o path não muda entre uploads, então sem isso
      // o browser/CDN poderia continuar servindo a foto antiga na mesma URL.
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      await sincronizarAvatarLocal();
      toast.success("Foto atualizada");
    } catch (err) {
      toast.error("Não foi possível enviar a foto", {
        description: getSafeErrorMessage(err, "Confira o arquivo e tente de novo."),
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;

      await sincronizarAvatarLocal();
      setIsRemoveAvatarConfirmOpen(false);
      toast.success("Foto removida");
    } catch (err) {
      toast.error("Não foi possível remover a foto", {
        description: getSafeErrorMessage(err, "Tente de novo em instantes."),
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const inputReadonlyClass = !editing
    ? "bg-black/5 border-black/10 text-black/80"
    : "border-brand/20 focus-visible:ring-brand/20";
  const alwaysReadonlyClass = "bg-black/5 border-black/10 text-black/80";

  if (isLoading && profileError) {
    return (
      <Card className="border border-black/5">
        <CardContent className="pt-6 space-y-3 text-center">
          <p className="text-sm text-black/60">Não deu para carregar sua conta. Confira a conexão e tente de novo.</p>
          <Button
            variant="outline"
            className="rounded-full"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              await refreshProfile();
              setRetrying(false);
            }}
          >
            {retrying ? "Tentando..." : "Tentar de novo"}
          </Button>
        </CardContent>
      </Card>
    );
  }

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
          <div className="group relative flex-shrink-0">
            <AvatarStack
              pessoas={[
                {
                  nome: [firstName, lastName].filter(Boolean).join(" ") || email || "?",
                  avatarUrl: profile?.avatar_url,
                },
              ]}
              size="lg"
            />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label="Trocar foto de perfil"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-transparent transition-colors group-hover:bg-black/40 group-hover:text-white disabled:cursor-not-allowed"
            >
              <Camera size={18} />
            </button>
            {profile?.avatar_url && !uploadingAvatar && (
              <button
                type="button"
                onClick={() => setIsRemoveAvatarConfirmOpen(true)}
                aria-label="Remover foto de perfil"
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90"
              >
                <X size={12} />
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept={AVATAR_ALLOWED_TYPES.join(",")}
              className="hidden"
              onChange={handleAvatarFileChange}
            />
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

      <ConfirmDialog
        open={isRemoveAvatarConfirmOpen}
        onOpenChange={setIsRemoveAvatarConfirmOpen}
        onConfirm={handleRemoveAvatar}
        title="Remover foto de perfil?"
        description="Sua foto será removida e o avatar volta a mostrar suas iniciais."
        confirmText="Remover foto"
        variant="destructive"
        loading={uploadingAvatar}
      />
    </div>
  );
}
