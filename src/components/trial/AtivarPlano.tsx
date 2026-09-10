import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { onlyDigits, formatDocument, formatCEP, validateCPF, validateCNPJ } from "@/lib/maskUtils";
import { detectCardBrand, formatCardNumber, formatExpiry, validateCreditCard } from "@/lib/creditCard";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import { analytics } from "@/lib/analytics";
import { usePlans, calculateYearlySavingPct } from "@/pages/planos/hooks/usePlans";
import { CycleToggle, type BillingCycle } from "@/pages/planos/components/CycleToggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { MySubscription } from "@/pages/billing/hooks/useMySubscription";

interface AtivarPlanoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: MySubscription;
  onAtivado: () => void;
}

// SPEC 098, requisito 14: "Ativar plano" tokeniza o cartão sem cobrar nada
// agora. A cobrança real só acontece no dia 14 (trial-expiry-cron), e a
// evidência de que o admin concordou é o checkbox datado abaixo, gravado em
// consentimentos_cobranca pela própria edge — não há segunda aprovação.
export function AtivarPlano({ open, onOpenChange, subscription, onAtivado }: AtivarPlanoProps) {
  const { user } = useAuth();
  const { data: plans } = usePlans();

  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [planId, setPlanId] = useState<string>("");
  const [ccHolder, setCcHolder] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExpiry, setCcExpiry] = useState("");
  const [ccCcv, setCcCcv] = useState("");
  const [holderCpfCnpj, setHolderCpfCnpj] = useState("");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("");
  const [consentimento, setConsentimento] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const sucedeu = useRef(false);
  const cardBrand = detectCardBrand(ccNumber);

  const planoSelecionado = useMemo(() => plans?.find((p) => p.id === planId) ?? null, [plans, planId]);
  const valor = planoSelecionado
    ? cycle === "yearly"
      ? (planoSelecionado.preco_anual ?? planoSelecionado.preco_mensal * 12)
      : planoSelecionado.preco_mensal
    : 0;
  // formatDate espera data pura (YYYY-MM-DD); trial_ends_at é timestamptz completo.
  const dataPrimeiraCobranca = subscription.trial_ends_at ? formatDate(subscription.trial_ends_at.slice(0, 10)) : "-";

  const handleOpenChange = (v: boolean) => {
    if (!v && !sucedeu.current) {
      analytics.track("trial_ativar_plano_abandonado", {});
    }
    if (v) {
      analytics.track("trial_ativar_plano_iniciado", {});
      setPlanId((prev) => prev || plans?.find((p) => p.destaque)?.id || plans?.[0]?.id || "");
    }
    onOpenChange(v);
  };

  const cpfCnpjDigits = onlyDigits(holderCpfCnpj);
  const cpfCnpjValido =
    cpfCnpjDigits.length === 11
      ? validateCPF(cpfCnpjDigits)
      : cpfCnpjDigits.length === 14
        ? validateCNPJ(cpfCnpjDigits)
        : false;

  const cardValidation = validateCreditCard(ccNumber, ccExpiry);
  const formValido =
    !!planId &&
    consentimento &&
    ccHolder.trim().length >= 2 &&
    cardValidation.ok &&
    ccCcv.trim().length >= 3 &&
    cpfCnpjValido &&
    onlyDigits(holderPostalCode).length === 8 &&
    holderAddressNumber.trim().length > 0;

  const handleSubmit = async () => {
    if (!formValido || !planoSelecionado) return;
    setIsPending(true);
    try {
      const expiryDigits = onlyDigits(ccExpiry);
      const { data, error } = await supabase.functions.invoke<{ error?: string }>("ativar-plano", {
        body: {
          plan_id: planoSelecionado.id,
          billing_cycle: cycle,
          credit_card: {
            holderName: ccHolder.trim(),
            number: onlyDigits(ccNumber),
            expiryMonth: expiryDigits.slice(0, 2),
            expiryYear: `20${expiryDigits.slice(2, 4)}`,
            ccv: ccCcv.trim(),
          },
          credit_card_holder_info: {
            name: ccHolder.trim(),
            email: user?.email ?? "",
            cpfCnpj: cpfCnpjDigits,
            postalCode: onlyDigits(holderPostalCode),
            addressNumber: holderAddressNumber.trim(),
          },
        },
      });

      if (error) {
        throw new Error(await edgeFunctionErrorMessage(error, "Falha ao ativar o plano"));
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      sucedeu.current = true;
      analytics.track("trial_ativar_plano_concluido", { plan_id: planoSelecionado.id, billing_cycle: cycle });
      toast.success("Plano ativado", {
        description: `Sua empresa já está no nível Ouro. A primeira cobrança de ${formatCurrency(valor)} acontece em ${dataPrimeiraCobranca}.`,
      });
      onAtivado();
      onOpenChange(false);
    } catch (e) {
      toast.error("Não foi possível ativar o plano", {
        description: e instanceof Error ? e.message : "Tente novamente",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Ativar plano"
      description="Nada é cobrado agora. Escolha o plano e informe o cartão para garantir a continuidade sem interrupção."
      size="md"
      zClassName="z-[70]"
      onSubmit={handleSubmit}
      submitLabel="Ativar plano"
      isPending={isPending}
      submitDisabled={!formValido}
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <CycleToggle value={cycle} onChange={setCycle} />
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {(plans ?? []).map((plan) => {
            const savingPct = calculateYearlySavingPct(plan);
            const price = cycle === "yearly" ? (plan.preco_anual ?? plan.preco_mensal * 12) / 12 : plan.preco_mensal;
            const isSelected = plan.id === planId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanId(plan.id)}
                className={cn(
                  "relative text-left p-3 rounded-xl border-2 transition-all",
                  isSelected ? "border-brand bg-brand/5" : "border-border hover:border-border"
                )}
              >
                {plan.destaque && (
                  <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider bg-brand/10 text-brand px-2 py-0.5 rounded-full">
                    Sugerido
                  </span>
                )}
                {isSelected && !plan.destaque && (
                  <span className="absolute top-2 right-2">
                    <Check className="w-4 h-4 text-ink" />
                  </span>
                )}
                <p className="text-sm font-medium text-ink">{plan.nome}</p>
                <p className="text-xl font-semibold text-ink mt-1">{formatCurrency(price)}</p>
                <p className="text-xs text-ink-muted">
                  /mês{cycle === "yearly" && savingPct ? ` · ${savingPct}% off no anual` : ""}
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-3 pt-1 border-t border-border">
          <p className="text-xs text-ink-muted pt-3">Dados do cartão</p>
          <div className="space-y-1.5">
            <Label htmlFor="ativar-cc-holder">Nome impresso no cartão</Label>
            <Input
              id="ativar-cc-holder"
              value={ccHolder}
              onChange={(e) => setCcHolder(e.target.value)}
              autoComplete="cc-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ativar-cc-number" className="flex items-center justify-between">
              Número do cartão
              {cardBrand && <span className="text-[11px] uppercase tracking-wider text-ink-disabled">{cardBrand}</span>}
            </Label>
            <Input
              id="ativar-cc-number"
              value={ccNumber}
              onChange={(e) => setCcNumber(formatCardNumber(e.target.value))}
              inputMode="numeric"
              maxLength={19}
              autoComplete="cc-number"
              placeholder="0000 0000 0000 0000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ativar-cc-expiry">Validade</Label>
              <Input
                id="ativar-cc-expiry"
                value={ccExpiry}
                onChange={(e) => setCcExpiry(formatExpiry(e.target.value))}
                maxLength={5}
                placeholder="MM/AA"
                inputMode="numeric"
                autoComplete="cc-exp"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ativar-cc-ccv">CVV</Label>
              <Input
                id="ativar-cc-ccv"
                type="password"
                value={ccCcv}
                onChange={(e) => setCcCcv(onlyDigits(e.target.value))}
                maxLength={4}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="•••"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ativar-cpf-cnpj">CPF ou CNPJ do titular</Label>
              <Input
                id="ativar-cpf-cnpj"
                value={formatDocument(holderCpfCnpj)}
                onChange={(e) => setHolderCpfCnpj(e.target.value)}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ativar-cep">CEP</Label>
              <Input
                id="ativar-cep"
                value={formatCEP(holderPostalCode)}
                onChange={(e) => setHolderPostalCode(e.target.value)}
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ativar-numero">Número do endereço</Label>
            <Input
              id="ativar-numero"
              value={holderAddressNumber}
              onChange={(e) => setHolderAddressNumber(e.target.value)}
            />
          </div>
        </div>

        {planoSelecionado && (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm text-ink-muted">
            Nada é cobrado agora. A primeira cobrança de <strong className="text-ink">{formatCurrency(valor)}</strong>{" "}
            acontece em <strong className="text-ink">{dataPrimeiraCobranca}</strong>, só se você continuar. Cancele
            antes disso em Configurações, sem cobrança.
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-ink-muted cursor-pointer">
          <Checkbox checked={consentimento} onCheckedChange={(v) => setConsentimento(v === true)} className="mt-0.5" />
          <span>Entendo que a cobrança começa em {dataPrimeiraCobranca} e que posso cancelar antes.</span>
        </label>
      </div>
    </FormDialog>
  );
}
