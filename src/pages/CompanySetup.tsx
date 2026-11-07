import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/safeError";
import { analytics } from "@/lib/analytics";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, FolderKanban, Globe, Hash, HardHat } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import {
  companySetupSchema,
  companySetupDefaultValues,
  type CompanySetupFormData,
  type CompanySetupFormInput,
} from "@/schemas";
import { Logo } from "@/components/Logo";
import { BusyMark } from "@/components/motion/BusyMark";
import { EscolhaChips } from "@/components/forms/EscolhaChips";
import { cn } from "@/lib/utils";
import { useConsultaCnpj, type ConsultaCnpj } from "@/hooks/useConsultaCnpj";
import {
  CANAIS,
  DISCIPLINAS,
  OBJETIVOS,
  PORTES,
  normalizarSite,
  sugerirSite,
  type Objetivo,
} from "@/lib/perfilEscritorio";

type Etapa = "escritorio" | "comecar";
type Papel = "user" | "coordenador" | "admin";
type ConviteRascunho = { email: string; papel: Papel };

const ICONE_OBJETIVO: Record<Objetivo, typeof Building2> = {
  gestao: Building2,
  projetos: FolderKanban,
  obras: HardHat,
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CONVITES_VAZIOS: ConviteRascunho[] = [
  { email: "", papel: "user" },
  { email: "", papel: "user" },
  { email: "", papel: "user" },
];

function formatarCnpj(v: string): string {
  return v
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

/**
 * Configuração do escritório pelo dono (SPEC 149), etapas 2 e 3 de 3:
 * "Seu escritório" (nome, CNPJ, site, porte, disciplinas, como conheceu) e
 * "Por onde começar" (pilar de partida e convite opcional de colegas). Tudo
 * que o ultra-admin anotou na criação já vem preenchido.
 */
export default function CompanySetup() {
  usePageTitle("Configuração da Empresa");
  const [etapa, setEtapa] = useState<Etapa>("escritorio");
  const [isLoading, setIsLoading] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);
  const [convites, setConvites] = useState<ConviteRascunho[]>(CONVITES_VAZIOS);
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const siteSugerido = sugerirSite(user?.email);

  const form = useForm<CompanySetupFormInput, unknown, CompanySetupFormData>({
    resolver: zodResolver(companySetupSchema),
    mode: "onChange",
    defaultValues: companySetupDefaultValues,
  });

  // Prefill com o que a empresa já tem (nome sempre; perfil quando o
  // ultra-admin anotou na criação).
  const { reset } = form;
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const empresa = profile?.empresas;
    if (!empresa || hydrated) return;
    reset({
      name: empresa.nome ?? "",
      cnpj: empresa.cnpj ? formatarCnpj(empresa.cnpj) : "",
      site: empresa.site ?? "",
      porte: empresa.porte ?? "",
      disciplinas: empresa.disciplinas ?? [],
      comoConheceu: empresa.como_conheceu ?? "",
    });
    if (
      empresa.objetivo_inicial === "gestao" ||
      empresa.objetivo_inicial === "projetos" ||
      empresa.objetivo_inicial === "obras"
    ) {
      setObjetivo(empresa.objetivo_inicial);
    }
    setHydrated(true);
  }, [profile?.empresas, hydrated, reset]);

  const targetProgress = etapa === "escritorio" ? Math.round((2 / 3) * 100) : 100;
  useEffect(() => {
    const t = window.setTimeout(() => setProgressValue(targetProgress), 150);
    return () => window.clearTimeout(t);
  }, [targetProgress]);

  const empresaId = profile?.empresa_id ?? null;
  const receita = useConsultaCnpj(form.watch("cnpj") ?? "");

  // Etapa 2: grava o perfil do escritório já (sem concluir o onboarding), para
  // não perder o que foi digitado se a pessoa fechar a aba na etapa 3.
  const salvarEscritorio = async (values: CompanySetupFormData) => {
    if (!empresaId) {
      toast.error("Empresa não encontrada");
      return;
    }
    setIsLoading(true);
    try {
      // Endereço da Receita só preenche o que o escritório ainda não tem.
      const empresa = profile?.empresas;
      const enderecoReceita = receita.estado === "ok" ? receita.dados.endereco : null;
      const doEndereco = enderecoReceita
        ? {
            ...(!empresa?.endereco && enderecoReceita.logradouro ? { endereco: enderecoReceita.logradouro } : {}),
            ...(!empresa?.cidade && enderecoReceita.cidade ? { cidade: enderecoReceita.cidade } : {}),
            ...(!empresa?.estado && enderecoReceita.uf ? { estado: enderecoReceita.uf } : {}),
            ...(!empresa?.cep && enderecoReceita.cep ? { cep: enderecoReceita.cep } : {}),
          }
        : {};
      const { error } = await supabase
        .from("empresas")
        .update({
          nome: values.name,
          cnpj: values.cnpj || null,
          site: normalizarSite(values.site ?? ""),
          porte: values.porte || null,
          disciplinas: values.disciplinas.length > 0 ? values.disciplinas : null,
          como_conheceu: values.comoConheceu || null,
          ...doEndereco,
        })
        .eq("id", empresaId);
      if (error) throw error;

      // CNPJ confirmado na Receita fica registrado como verificado (razão social,
      // situação, CNAE), pela mesma edge do nível Prata (SPEC 098). Não bloqueia:
      // se falhar, o CNPJ já está salvo e o cron de reverificação cobre.
      if (receita.estado === "ok" && values.cnpj) {
        await supabase.functions
          .invoke("verificar-documento", { body: { documento: values.cnpj.replace(/\D/g, "") } })
          .catch(() => undefined);
      }

      analytics.track("onboarding_etapa_concluida", {
        etapa: "escritorio",
        porte: values.porte || "sem_resposta",
        disciplinas: values.disciplinas.length,
        como_conheceu: values.comoConheceu || "sem_resposta",
        tem_site: Boolean(values.site),
        tem_cnpj: Boolean(values.cnpj),
      });
      setEtapa("comecar");
    } catch (err: unknown) {
      toast.error("Erro ao salvar", { description: getSafeErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const convitesValidos = convites.filter((c) => c.email.trim());
  const convitesInvalidos = convitesValidos.some((c) => !EMAIL_RE.test(c.email.trim()));

  const enviarConvites = async (): Promise<number> => {
    let falhas = 0;
    for (const c of convitesValidos) {
      const { error } = await supabase.functions.invoke("invite-user", {
        body: { email: c.email.trim().toLowerCase(), nome: "", role: c.papel },
      });
      if (error) {
        falhas += 1;
        const msg = await edgeFunctionErrorMessage(error, "Não foi possível enviar o convite.");
        toast.error(`Convite para ${c.email.trim()} não saiu`, { description: msg });
        continue;
      }
      analytics.track("convite_enviado", { papel: c.papel, origem: "onboarding" });
    }
    return convitesValidos.length - falhas;
  };

  const concluir = async () => {
    if (!empresaId) return;
    if (convitesInvalidos) {
      toast.error("Confira os e-mails dos colegas");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("empresas")
        .update({ objetivo_inicial: objetivo, onboarding_completed: true })
        .eq("id", empresaId);
      if (error) throw error;

      const enviados = convitesValidos.length > 0 ? await enviarConvites() : 0;

      await refreshProfile();

      if (objetivo) analytics.track("onboarding_objetivo_escolhido", { objetivo });
      analytics.track("empresa_onboarding_concluido", { empresa_id: empresaId, convites: enviados });

      toast.success("Escritório configurado.", {
        description:
          enviados > 0 ? `Boas-vindas ao Pilar. ${enviados} convite(s) enviado(s).` : "Boas-vindas ao Pilar.",
      });
      navigate("/inicio");
    } catch (err: unknown) {
      toast.error("Erro ao salvar", { description: getSafeErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  };

  const setConvite = (i: number, patch: Partial<ConviteRascunho>) =>
    setConvites((lista) => lista.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const site = form.watch("site");

  return (
    <div className="landing-grain min-h-dvh w-full flex overflow-hidden bg-paper">
      <div className="w-full lg:w-1/2 flex items-start lg:items-center justify-center p-8 lg:p-16 bg-paper relative overflow-y-auto">
        {/* Aurora sutil */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-brand/6 rounded-full blur-[100px] animate-aurora" />
        </div>
        {etapa === "escritorio" ? (
          <Link
            to="/profile-setup"
            className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setEtapa("escritorio")}
            className="absolute top-8 left-8 lg:left-12 flex items-center gap-2 text-ink-soft hover:text-brand transition-colors font-medium text-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Voltar
          </button>
        )}

        <div className="w-full max-w-[480px] space-y-8 pt-10 lg:pt-0 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo variant="mark" size="md" />
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-ink">Pilar</div>
                  <div className="text-xs text-ink-soft">
                    Configuração inicial · Etapa {etapa === "escritorio" ? 2 : 3} de 3
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-brand/70" />
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    etapa === "escritorio" ? "bg-brand shadow-sm shadow-brand/30" : "bg-brand/70"
                  )}
                />
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    etapa === "comecar" ? "bg-brand shadow-sm shadow-brand/30" : "bg-muted"
                  )}
                />
              </div>
            </div>

            <Progress
              value={progressValue}
              className="h-2 bg-paper-border"
              indicatorClassName="bg-gradient-brand transition-all duration-700 ease-out"
            />
          </div>

          {etapa === "escritorio" ? (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Seu escritório</h1>
                <p className="text-sm text-ink-soft">
                  Confira o que já sabemos e complete o resto. Só o nome é obrigatório.
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(salvarEscritorio)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">
                          Nome do escritório <span className="text-danger-mid">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <Building2 className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                            <Input
                              {...field}
                              className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-ink-soft font-medium">CNPJ</FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <Hash className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                              <Input
                                {...field}
                                placeholder="00.000.000/0000-00"
                                inputMode="numeric"
                                className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                                maxLength={18}
                                onChange={(e) => field.onChange(formatarCnpj(e.target.value))}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="site"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-ink-soft font-medium">Site</FormLabel>
                          <FormControl>
                            <div className="relative group">
                              <Globe className="absolute left-3 top-3 h-4 w-4 text-ink/40 group-focus-within:text-brand transition-colors" />
                              <Input
                                {...field}
                                placeholder={siteSugerido ?? "seuescritorio.com.br"}
                                className="pl-10 h-11 bg-paper-alt border-paper-border focus:border-brand focus:ring-brand/20 transition-all"
                              />
                            </div>
                          </FormControl>
                          {siteSugerido && !site && (
                            <button
                              type="button"
                              className="text-xs text-ink-soft underline-offset-2 hover:underline"
                              onClick={() => form.setValue("site", siteSugerido, { shouldDirty: true })}
                            >
                              Usar {siteSugerido}
                            </button>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <ResultadoReceita consulta={receita} />

                  <FormField
                    control={form.control}
                    name="disciplinas"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">Disciplinas do escritório</FormLabel>
                        <FormControl>
                          <EscolhaChips
                            multiplo
                            ariaLabel="Disciplinas do escritório"
                            opcoes={DISCIPLINAS}
                            value={field.value ?? []}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="porte"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">Quantas pessoas trabalham aí</FormLabel>
                        <FormControl>
                          <EscolhaChips
                            ariaLabel="Quantas pessoas trabalham no escritório"
                            opcoes={PORTES}
                            value={field.value || null}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="comoConheceu"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-ink-soft font-medium">Como você conheceu o Pilar?</FormLabel>
                        <FormControl>
                          <EscolhaChips
                            ariaLabel="Como você conheceu o Pilar"
                            opcoes={CANAIS}
                            value={field.value || null}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormDescription className="text-xs text-ink-soft">Opcional.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    variant="brand"
                    className="w-full h-11 font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <BusyMark className="mr-2 h-4 w-4" /> Salvando...
                      </>
                    ) : (
                      <>
                        Continuar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-ink">Por onde começar?</h1>
                <p className="text-sm text-ink-soft">
                  O Pilar cobre os três. Escolha o que quer organizar primeiro e os primeiros passos começam por ele.
                </p>
              </div>

              <div role="radiogroup" aria-label="Por onde começar" className="grid gap-3">
                {OBJETIVOS.map((o) => {
                  const Icone = ICONE_OBJETIVO[o.value];
                  const ativo = objetivo === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setObjetivo(o.value)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black/10",
                        ativo ? "border-ink bg-paper-alt" : "border-paper-border bg-paper hover:border-black/20"
                      )}
                    >
                      <Icone className={cn("mt-0.5 h-5 w-5 shrink-0", ativo ? "text-ink" : "text-ink/40")} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{o.label}</span>
                        <span className="block text-sm text-ink-soft">{o.descricao}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-ink">Chame seu time</h2>
                  <p className="text-xs text-ink-soft">
                    Opcional. Dá para convidar depois em Administração › Usuários.
                  </p>
                </div>
                {convites.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`convite-email-${i}`} className="sr-only">
                        E-mail do colega {i + 1}
                      </Label>
                      <Input
                        id={`convite-email-${i}`}
                        type="email"
                        value={c.email}
                        onChange={(e) => setConvite(i, { email: e.target.value })}
                        placeholder="colega@escritorio.com.br"
                        className="h-11 bg-paper-alt border-paper-border"
                        aria-invalid={Boolean(c.email.trim()) && !EMAIL_RE.test(c.email.trim())}
                      />
                    </div>
                    <Select value={c.papel} onValueChange={(v) => setConvite(i, { papel: v as Papel })}>
                      <SelectTrigger className="h-11 w-[150px] bg-paper-alt" aria-label={`Papel do colega ${i + 1}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuário</SelectItem>
                        <SelectItem value="coordenador">Coordenador</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <Button
                variant="brand"
                className="w-full h-11 font-medium shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all active:scale-[0.98] text-sm"
                type="button"
                onClick={concluir}
                disabled={isLoading || convitesInvalidos}
              >
                {isLoading ? (
                  <>
                    <BusyMark className="mr-2 h-4 w-4" /> Entrando...
                  </>
                ) : (
                  <>
                    {convitesValidos.length > 0 ? "Convidar e entrar no Pilar" : "Entrar no Pilar"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 relative bg-black items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <video
            src="/video-login.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover opacity-70 scale-105 animate-pulse-slow grayscale"
            style={{ animationDuration: "20s" }}
          />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full w-full p-16 text-white">
          <div className="animate-in fade-in slide-in-from-top-8 duration-700 flex justify-end">
            <div className="opacity-80">
              <Logo tone="inverted" size="sm" />
            </div>
          </div>

          <div className="space-y-6 max-w-lg ml-auto text-right animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            <div className="flex justify-end">
              <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {etapa === "escritorio" ? "Seu escritório" : "Último passo"}
              </span>
            </div>

            <blockquote className="text-3xl font-light leading-snug">
              "Gestão com agentes de IA para escritórios de engenharia e arquitetura."
            </blockquote>

            <p className="text-sm text-white/70">Gestão, projetos e obras no mesmo lugar. Comece por onde dói mais.</p>
          </div>

          <div className="text-xs text-white/40 text-right animate-in fade-in duration-1000 delay-300">
            © {new Date().getFullYear()} Pilar. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </div>
  );
}

/** O que a Receita tem para o CNPJ digitado (SPEC 149): conferência, sem bloquear o cadastro. */
function ResultadoReceita({ consulta }: { consulta: ConsultaCnpj }) {
  if (consulta.estado === "inativo") return null;
  if (consulta.estado === "consultando") {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-soft" role="status">
        <BusyMark className="h-3.5 w-3.5" /> Consultando a Receita Federal...
      </p>
    );
  }
  if (consulta.estado === "indisponivel") {
    return (
      <p className="text-xs text-ink-soft" role="status">
        A Receita não respondeu agora. Pode seguir: o CNPJ fica salvo e conferimos depois.
      </p>
    );
  }
  if (consulta.estado === "erro") {
    return (
      <p className="text-xs text-ink-soft" role="status">
        {consulta.mensagem}
      </p>
    );
  }
  const { dados } = consulta;
  const ativa = dados.situacao === "ATIVA";
  const local = [dados.endereco?.cidade, dados.endereco?.uf].filter(Boolean).join("/");
  return (
    <div
      role="status"
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm",
        ativa ? "border-paper-border bg-paper-alt" : "border-warning-mid-border bg-warning-soft"
      )}
    >
      <p className="text-xs text-ink-soft">Receita Federal</p>
      <p className="font-medium text-ink">{dados.razaoSocial}</p>
      <p className={cn("text-xs", ativa ? "text-ink-soft" : "text-warning-strong")}>
        {[ativa ? "Situação ativa" : `Situação: ${dados.situacao.toLowerCase()}`, dados.nomeFantasia, local]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}
