import { useState, useCallback, type FormEvent } from "react";
import { toast } from "sonner";
import { CreditCard, QrCode, FileText, Loader2, Lock, ShieldCheck, Eye, EyeOff, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

function detectCardBrand(number: string): "visa" | "mastercard" | "amex" | "elo" | null {
  const n = onlyDigits(number);
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650[0-3]|6504|6505|6516|6550)/.test(n)) return "elo";
  return null;
}

function formatCardNumber(value: string): string {
  const digits = onlyDigits(value).slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function formatTelefone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
}

const PAYMENT_METHODS: { value: BillingType; label: string; icon: React.ReactNode }[] = [
  { value: "CREDIT_CARD", label: "Cartão", icon: <CreditCard className="w-4 h-4" /> },
  { value: "PIX", label: "PIX", icon: <QrCode className="w-4 h-4" /> },
  { value: "BOLETO", label: "Boleto", icon: <FileText className="w-4 h-4" /> },
];

// Algoritmo de Luhn: valida o dígito verificador do número do cartão.
function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
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

  const [ccHolder, setCcHolder] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExpiry, setCcExpiry] = useState("");
  const [ccCcv, setCcCcv] = useState("");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("");
  const [cepAddress, setCepAddress] = useState<{ logradouro: string; bairro: string; cidade: string; uf: string } | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const [showCcv, setShowCcv] = useState(false);
  const cardBrand = detectCardBrand(ccNumber);

  const fetchCep = useCallback(async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { toast.error("CEP não encontrado"); return; }
      setCepAddress({ logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf });
    } catch {
      toast.error("Erro ao buscar CEP");
    } finally {
      setIsFetchingCep(false);
    }
  }, []);

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
      telefone: onlyDigits(telefone),
      plan_slug: planSlug,
      billing_cycle: cycle,
      billing_type: billingType,
    };

    if (billingType === "CREDIT_CARD") {
      const expiryDigits = onlyDigits(ccExpiry);
      const cardDigits = onlyDigits(ccNumber);
      const expMonth = parseInt(expiryDigits.slice(0, 2), 10);
      const expYear = 2000 + parseInt(expiryDigits.slice(2, 4), 10);

      // Validação local do cartão (ACH-AUTH-08): Luhn + comprimento + validade futura.
      if (cardDigits.length < 13 || cardDigits.length > 19 || !luhnValid(cardDigits)) {
        toast.error("Número do cartão inválido", { description: "Verifique os dígitos." });
        return;
      }
      if (!(expMonth >= 1 && expMonth <= 12) || expiryDigits.length < 4) {
        toast.error("Validade inválida", { description: "Use o formato MM/AA." });
        return;
      }
      const now = new Date();
      const lastValidDay = new Date(expYear, expMonth, 0, 23, 59, 59);
      if (lastValidDay < now) {
        toast.error("Cartão vencido", { description: "A validade informada já passou." });
        return;
      }

      const card: CreditCardData = {
        holderName: ccHolder.trim(),
        number: cardDigits,
        expiryMonth: expiryDigits.slice(0, 2),
        expiryYear: `20${expiryDigits.slice(2, 4)}`,
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
      {/* Dados pessoais */}
      <section className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Seus dados</h2>
          <p className="text-xs text-slate-500 mt-0.5">Use o CPF/CNPJ que vai constar na nota fiscal.</p>
        </div>

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
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => setTelefone(formatTelefone(e.target.value))}
              inputMode="tel"
              placeholder="(11) 99999-9999"
              required
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="companyName">Nome do escritório</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Ex: Arquitetura Silva"
            />
            <p className="text-xs text-slate-400">Pode mudar depois nas configurações.</p>
          </div>
        </div>
      </section>

      {/* Método de pagamento */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Pagamento</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatBRL(planValue)} — plano {planNome} {cycle === "yearly" ? "anual" : "mensal"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setBillingType(value)}
              className={cn(
                "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all",
                billingType === value
                  ? "border-brand bg-brand/5 text-ink-soft shadow-sm"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {billingType === "CREDIT_CARD" && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="ccHolder">Nome impresso no cartão</Label>
              <Input
                id="ccHolder"
                value={ccHolder}
                onChange={(e) => setCcHolder(e.target.value)}
                required
                autoComplete="cc-name"
                placeholder="Ex: Ricardo A. Silva"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ccNumber" className="flex items-center justify-between">
                Número do cartão
                {cardBrand && (
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{cardBrand}</span>
                )}
              </Label>
              <Input
                id="ccNumber"
                value={ccNumber}
                onChange={(e) => setCcNumber(formatCardNumber(e.target.value))}
                required
                inputMode="numeric"
                maxLength={19}
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ccExpiry">Validade</Label>
                <Input
                  id="ccExpiry"
                  value={ccExpiry}
                  onChange={(e) => setCcExpiry(formatExpiry(e.target.value))}
                  required
                  maxLength={5}
                  placeholder="MM/AA"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ccCcv">CVV</Label>
                <div className="relative">
                  <Input
                    id="ccCcv"
                    type={showCcv ? "text" : "password"}
                    value={ccCcv}
                    onChange={(e) => setCcCcv(onlyDigits(e.target.value))}
                    required
                    maxLength={4}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    placeholder="•••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCcv((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showCcv ? "Ocultar CVV" : "Mostrar CVV"}
                  >
                    {showCcv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-3">Endereço de cobrança do titular</p>
              <div className="grid grid-cols-[1fr_110px] gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="holderPostalCode">CEP</Label>
                  <div className="relative">
                    <Input
                      id="holderPostalCode"
                      value={holderPostalCode}
                      onChange={(e) => {
                        const formatted = formatCEP(e.target.value);
                        setHolderPostalCode(formatted);
                        if (onlyDigits(formatted).length === 8) fetchCep(formatted);
                      }}
                      required
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="00000-000"
                      className={isFetchingCep ? "pr-8" : ""}
                    />
                    {isFetchingCep && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="holderAddressNumber">Número</Label>
                  <Input
                    id="holderAddressNumber"
                    value={holderAddressNumber}
                    onChange={(e) => setHolderAddressNumber(e.target.value)}
                    required
                    placeholder="123"
                  />
                </div>
              </div>

              {cepAddress && (
                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                  <span>
                    {cepAddress.logradouro && `${cepAddress.logradouro}, `}
                    {cepAddress.bairro && `${cepAddress.bairro} — `}
                    {cepAddress.cidade}/{cepAddress.uf}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {billingType === "PIX" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
            <p className="font-medium text-slate-800">Como funciona</p>
            <p>Após confirmar, você recebe o QR Code e o código copia-e-cola. Liberação automática em segundos.</p>
          </div>
        )}

        {billingType === "BOLETO" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
            <p className="font-medium text-slate-800">Como funciona</p>
            <p>Após confirmar, você recebe a linha digitável e o link do PDF. Liberação em 1 a 3 dias úteis.</p>
          </div>
        )}
      </section>

      {errorMessage && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{errorMessage}</div>
      )}

      <div className="space-y-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn("w-full h-12 text-sm font-semibold", "bg-brand hover:bg-brand/90 text-ink")}
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

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          Pagamento 100% seguro · Criptografia SSL
        </div>
      </div>
    </form>
  );
}
