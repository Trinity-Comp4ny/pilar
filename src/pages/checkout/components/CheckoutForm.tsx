import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CreditCard, QrCode, FileText, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { BillingType, CheckoutPayload, CreditCardData, CreditCardHolderInfo } from "../hooks/useCheckoutCreate";
import type { BillingCycle } from "@/pages/planos/components/CycleToggle";

interface CheckoutFormProps {
  planSlug: string;
  planNome: string;
  planValue: number;
  cycle: BillingCycle;
  onSubmit: (payload: CheckoutPayload) => void;
  isSubmitting: boolean;
  errorMessage: string | null;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function validCnpj(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (digits: string, weights: number[]) =>
    digits.split("").reduce((sum, n, i) => sum + parseInt(n) * weights[i], 0);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  const r1 = calc(d.slice(0, 12), w1) % 11;
  const r2 = calc(d.slice(0, 13), w2) % 11;
  return parseInt(d[12]) === (r1 < 2 ? 0 : 11 - r1) && parseInt(d[13]) === (r2 < 2 ? 0 : 11 - r2);
}

function validCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const sum = (digits: string, mult: number) => digits.split("").reduce((s, n, i) => s + parseInt(n) * (mult - i), 0);
  const r1 = sum(d.slice(0, 9), 10) % 11;
  const r2 = sum(d.slice(0, 10), 11) % 11;
  return parseInt(d[9]) === (r1 < 2 ? 0 : 11 - r1) && parseInt(d[10]) === (r2 < 2 ? 0 : 11 - r2);
}

export function CheckoutForm({
  planSlug,
  planNome,
  planValue,
  cycle,
  onSubmit,
  isSubmitting,
  errorMessage,
}: CheckoutFormProps) {
  const [billingType, setBillingType] = useState<BillingType>("CREDIT_CARD");

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");

  // Cartão
  const [ccHolder, setCcHolder] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccMonth, setCcMonth] = useState("");
  const [ccYear, setCcYear] = useState("");
  const [ccCcv, setCcCcv] = useState("");

  // Endereço do titular (exigido pelo Asaas em cartão)
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const digits = onlyDigits(cpfCnpj);
    const cpfCnpjValid = digits.length === 11 ? validCpf(digits) : digits.length === 14 ? validCnpj(digits) : false;
    if (!cpfCnpjValid) {
      toast.error("CPF/CNPJ inválido", { description: "Verifique o número informado." });
      return;
    }

    const payload: CheckoutPayload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      company_name: companyName.trim(),
      cpf_cnpj: onlyDigits(cpfCnpj),
      telefone: telefone ? onlyDigits(telefone) : undefined,
      plan_slug: planSlug,
      billing_cycle: cycle,
      billing_type: billingType,
    };

    if (billingType === "CREDIT_CARD") {
      const card: CreditCardData = {
        holderName: ccHolder.trim(),
        number: onlyDigits(ccNumber),
        expiryMonth: ccMonth.trim().padStart(2, "0"),
        expiryYear: ccYear.trim().length === 2 ? `20${ccYear.trim()}` : ccYear.trim(),
        ccv: ccCcv.trim(),
      };

      const holder: CreditCardHolderInfo = {
        name: nome.trim(),
        email: email.trim().toLowerCase(),
        cpfCnpj: onlyDigits(cpfCnpj),
        postalCode: onlyDigits(holderPostalCode),
        addressNumber: holderAddressNumber.trim(),
        phone: telefone ? onlyDigits(telefone) : undefined,
      };

      payload.credit_card = card;
      payload.credit_card_holder_info = holder;
    }

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-5">
        <header>
          <h2 className="text-lg font-medium text-slate-900">Seus dados</h2>
          <p className="text-xs text-slate-500">Use o CPF/CNPJ que vai constar na nota.</p>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
            <Input
              id="cpfCnpj"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              required
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone (opcional)</Label>
            <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Ex: Arquitetura Silva"
            />
            <p className="text-xs text-slate-400">Será o nome da empresa dentro do Pilar. Dá pra mudar depois.</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-medium text-slate-900">Pagamento</h2>
          <p className="text-xs text-slate-500">
            {formatBRL(planValue)} — plano {planNome} {cycle === "yearly" ? "anual" : "mensal"}
          </p>
        </header>

        <Tabs value={billingType} onValueChange={(v) => setBillingType(v as BillingType)}>
          <TabsList className="grid grid-cols-3 w-full h-auto p-1 bg-slate-100">
            <TabsTrigger value="CREDIT_CARD" className="gap-2 py-3">
              <CreditCard className="w-4 h-4" /> Cartão
            </TabsTrigger>
            <TabsTrigger value="PIX" className="gap-2 py-3">
              <QrCode className="w-4 h-4" /> PIX
            </TabsTrigger>
            <TabsTrigger value="BOLETO" className="gap-2 py-3">
              <FileText className="w-4 h-4" /> Boleto
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {billingType === "CREDIT_CARD" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="ccHolder">Nome impresso no cartão</Label>
              <Input
                id="ccHolder"
                value={ccHolder}
                onChange={(e) => setCcHolder(e.target.value)}
                required
                autoComplete="cc-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccNumber">Número do cartão</Label>
              <Input
                id="ccNumber"
                value={ccNumber}
                onChange={(e) => setCcNumber(e.target.value)}
                required
                inputMode="numeric"
                maxLength={19}
                autoComplete="cc-number"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ccMonth">Mês</Label>
                <Input
                  id="ccMonth"
                  value={ccMonth}
                  onChange={(e) => setCcMonth(e.target.value)}
                  required
                  maxLength={2}
                  placeholder="MM"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccYear">Ano</Label>
                <Input
                  id="ccYear"
                  value={ccYear}
                  onChange={(e) => setCcYear(e.target.value)}
                  required
                  maxLength={4}
                  placeholder="AAAA"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccCcv">CVV</Label>
                <Input
                  id="ccCcv"
                  value={ccCcv}
                  onChange={(e) => setCcCcv(e.target.value)}
                  required
                  maxLength={4}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="holderPostalCode">CEP do titular</Label>
                <Input
                  id="holderPostalCode"
                  value={holderPostalCode}
                  onChange={(e) => setHolderPostalCode(e.target.value)}
                  required
                  inputMode="numeric"
                  maxLength={9}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="holderAddressNumber">Número</Label>
                <Input
                  id="holderAddressNumber"
                  value={holderAddressNumber}
                  onChange={(e) => setHolderAddressNumber(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        )}

        {billingType === "PIX" && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 border border-slate-200">
            Após confirmar, você verá o QR Code e o código copia-e-cola pra pagar na hora. Liberação automática em
            segundos após o pagamento.
          </p>
        )}

        {billingType === "BOLETO" && (
          <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4 border border-slate-200">
            Após confirmar, você verá a linha digitável e o link do PDF. Liberação em 1 a 3 dias úteis após o pagamento.
          </p>
        )}
      </section>

      {errorMessage && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{errorMessage}</div>
      )}

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full h-12 text-sm font-medium", "bg-brand hover:bg-brand/90 text-ink")}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4 mr-2" /> Pagar {formatBRL(planValue)}
            </>
          )}
        </Button>
        <p className="text-[11px] text-slate-400 text-center mt-3">
          Ao continuar você concorda com nossos termos. Pagamento seguro via Asaas.
        </p>
      </div>
    </form>
  );
}
