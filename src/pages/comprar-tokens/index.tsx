import { useCallback, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, QrCode, FileText, Loader2, Lock, Eye, EyeOff, MapPin, Mail } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import { lookupCEP } from "@/lib/brasilApi";
import { CheckoutShell } from "@/pages/checkout/components/CheckoutShell";
import { PixPayment } from "@/pages/checkout/components/PixPayment";
import { BoletoPayment } from "@/pages/checkout/components/BoletoPayment";
import {
  useTokenPackCreate,
  type TokenPackBillingType,
  type TokenPackCreateResponse,
  type TokenPackTierId,
} from "@/components/settings/useTokenPackCreate";
import { useTokenPackStatus } from "@/components/settings/useTokenPackStatus";

// Espelha o catálogo do backend (pilar-token-pack-create) só pra exibição — o preço
// que vale de verdade é sempre resolvido no servidor a partir do tier_id (SPEC 080).
const TIER_CATALOG: Record<TokenPackTierId, { tokens: number; valorCentavos: number; label: string }> = {
  starter: { tokens: 500_000, valorCentavos: 4900, label: "500 mil tokens" },
  cresce: { tokens: 1_500_000, valorCentavos: 12900, label: "1,5 milhão de tokens" },
  escala: { tokens: 3_000_000, valorCentavos: 22800, label: "3 milhões de tokens" },
  maximo: { tokens: 6_000_000, valorCentavos: 39900, label: "6 milhões de tokens" },
};

const TIER_ORDER: TokenPackTierId[] = ["starter", "cresce", "escala", "maximo"];
const BASE_RATE = TIER_CATALOG.starter.valorCentavos / TIER_CATALOG.starter.tokens;

function descontoPct(tierId: TokenPackTierId): number {
  const tier = TIER_CATALOG[tierId];
  const taxa = tier.valorCentavos / tier.tokens;
  return Math.round((1 - taxa / BASE_RATE) * 100);
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function validCnpj(value: string): boolean {
  const d = onlyDigits(value);
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
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const sum = (digits: string, mult: number) => digits.split("").reduce((s, n, i) => s + parseInt(n) * (mult - i), 0);
  const r1 = sum(d.slice(0, 9), 10) % 11;
  const r2 = sum(d.slice(0, 10), 11) % 11;
  return parseInt(d[9]) === (r1 < 2 ? 0 : 11 - r1) && parseInt(d[10]) === (r2 < 2 ? 0 : 11 - r2);
}

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

function detectCardBrand(number: string): "visa" | "mastercard" | "amex" | "elo" | null {
  const n = onlyDigits(number);
  if (/^4/.test(n)) return "visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5090|6277|6362|6363|650[0-3]|6504|6505|6516|6550)/.test(n)) return "elo";
  return null;
}

function formatCardNumber(value: string): string {
  return onlyDigits(value)
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function formatExpiry(value: string): string {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function formatCEP(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
}

const PAYMENT_METHODS: { value: TokenPackBillingType; label: string; icon: React.ReactNode }[] = [
  { value: "CREDIT_CARD", label: "Cartão", icon: <CreditCard className="w-4 h-4" /> },
  { value: "PIX", label: "Pix", icon: <QrCode className="w-4 h-4" /> },
  { value: "BOLETO", label: "Boleto", icon: <FileText className="w-4 h-4" /> },
];

export default function ComprarTokens() {
  usePageTitle("Comprar tokens");
  const navigate = useNavigate();
  const { profile, isAuthenticated, loading } = useAuth();
  const queryClient = useQueryClient();
  const createPack = useTokenPackCreate();

  const [tierId, setTierId] = useState<TokenPackTierId>("cresce");
  const [billingType, setBillingType] = useState<TokenPackBillingType>("CREDIT_CARD");
  const [result, setResult] = useState<TokenPackCreateResponse | null>(null);

  const [ccHolder, setCcHolder] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExpiry, setCcExpiry] = useState("");
  const [ccCcv, setCcCcv] = useState("");
  const [showCcv, setShowCcv] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState(profile?.empresas?.cnpj ?? "");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("");
  const [cepAddress, setCepAddress] = useState<{
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
  } | null>(null);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const cepLookupRef = useRef<string | null>(null);

  const cardBrand = detectCardBrand(ccNumber);
  const status = useTokenPackStatus(result?.purchase_id ?? null);
  const paid = result?.payment_status === "paid" || status.data?.status === "paid";
  const tier = TIER_CATALOG[tierId];

  const fetchCep = useCallback(async (cep: string) => {
    const digits = onlyDigits(cep);
    // Sem esta guarda, cada correção de dígito que ainda somava 8 (ex.: apagar e
    // redigitar) disparava uma busca nova em paralelo à anterior; respostas fora de
    // ordem faziam o spinner e o endereço "piscarem" entre dois resultados.
    if (digits.length !== 8 || digits === cepLookupRef.current) return;
    cepLookupRef.current = digits;
    setIsFetchingCep(true);
    try {
      const end = await lookupCEP(digits);
      if (cepLookupRef.current !== digits) return;
      if (!end) {
        toast.error("CEP não encontrado");
        return;
      }
      setCepAddress({ logradouro: end.street, bairro: end.neighborhood, cidade: end.city, uf: end.state });
    } finally {
      if (cepLookupRef.current === digits) setIsFetchingCep(false);
    }
  }, []);

  // Rota fora do grupo PrivateRoute de propósito (checkout full-bleed, sem sidebar —
  // ver App.tsx), então a guarda de autenticação é própria, mesmo padrão de /profile-setup.
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-disabled" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (billingType === "CREDIT_CARD") {
      const digits = onlyDigits(cpfCnpj);
      const cpfCnpjValid = digits.length === 11 ? validCpf(digits) : digits.length === 14 ? validCnpj(digits) : false;
      if (!cpfCnpjValid) {
        toast.error("CPF/CNPJ inválido", { description: "Verifique o número informado." });
        return;
      }

      const expiryDigits = onlyDigits(ccExpiry);
      const cardDigits = onlyDigits(ccNumber);
      const expMonth = parseInt(expiryDigits.slice(0, 2), 10);
      const expYear = 2000 + parseInt(expiryDigits.slice(2, 4), 10);

      if (cardDigits.length < 13 || cardDigits.length > 19 || !luhnValid(cardDigits)) {
        toast.error("Número do cartão inválido", { description: "Verifique os dígitos." });
        return;
      }
      if (!(expMonth >= 1 && expMonth <= 12) || expiryDigits.length < 4) {
        toast.error("Validade inválida", { description: "Use o formato MM/AA." });
        return;
      }
      const lastValidDay = new Date(expYear, expMonth, 0, 23, 59, 59);
      if (lastValidDay < new Date()) {
        toast.error("Cartão vencido", { description: "A validade informada já passou." });
        return;
      }

      createPack.mutate(
        {
          tier_id: tierId,
          billing_type: billingType,
          credit_card: {
            holderName: ccHolder.trim(),
            number: cardDigits,
            expiryMonth: expiryDigits.slice(0, 2),
            expiryYear: `20${expiryDigits.slice(2, 4)}`,
            ccv: ccCcv.trim(),
          },
          credit_card_holder_info: {
            name: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
            email: profile?.email ?? "",
            cpfCnpj: digits,
            postalCode: onlyDigits(holderPostalCode),
            addressNumber: holderAddressNumber.trim(),
          },
        },
        { onSuccess: (data) => setResult(data) }
      );
      return;
    }

    createPack.mutate({ tier_id: tierId, billing_type: billingType }, { onSuccess: (data) => setResult(data) });
  };

  return (
    <CheckoutShell backTo="/inicio" logoTo="/inicio" badgeLabel="Compra segura">
      <div className={cn("grid gap-8 items-start", result ? "max-w-md mx-auto" : "lg:grid-cols-[1fr_360px]")}>
        <section className="bg-white rounded-2xl border border-paper-border p-8 shadow-sm">
          {paid && result ? (
            <div className="text-center space-y-6 py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 text-positive-strong">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-medium text-ink">Tokens creditados</h2>
                <p className="text-ink-muted mt-2">
                  {formatNumber(result.tokens)} tokens já estão disponíveis no seu saldo.
                </p>
              </div>
              <Button
                variant="brand"
                className="rounded-full"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["uso-empresa", profile?.empresa_id] });
                  navigate("/inicio");
                }}
              >
                Voltar ao Pilar
              </Button>
            </div>
          ) : result ? (
            result.billing_type === "PIX" && result.metadata.pix ? (
              <PixPayment
                encodedImage={result.metadata.pix.encoded_image}
                payload={result.metadata.pix.payload}
                expirationDate={result.metadata.pix.expiration_date}
                value={result.value}
                isPolling={status.isFetching || !status.data}
              />
            ) : result.billing_type === "BOLETO" && result.metadata.boleto ? (
              <BoletoPayment
                bankSlipUrl={result.metadata.boleto.bank_slip_url}
                identificationField={result.metadata.boleto.identification_field}
                value={result.value}
                isPolling={status.isFetching || !status.data}
              />
            ) : (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-ink-disabled" />
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <section className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-ink">Pagamento</h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {formatCurrency(tier.valorCentavos / 100, { decimals: 2 })} — {tier.label}
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
                          : "border-border text-ink-muted hover:border-border hover:bg-muted"
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
                          <span className="text-[11px] font-medium text-ink-disabled uppercase tracking-wider">
                            {cardBrand}
                          </span>
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
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-disabled hover:text-ink-muted transition-colors"
                            tabIndex={-1}
                            aria-label={showCcv ? "Ocultar CVV" : "Mostrar CVV"}
                          >
                            {showCcv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cpfCnpj">CPF ou CNPJ do titular</Label>
                      <Input
                        id="cpfCnpj"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        required
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div className="pt-1 border-t border-border">
                      <p className="text-xs text-ink-muted mb-3">Endereço de cobrança do titular</p>
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
                              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-ink-disabled" />
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
                        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-muted border border-border rounded-lg text-xs text-ink-muted">
                          <MapPin className="w-3.5 h-3.5 text-foreground shrink-0 mt-0.5" />
                          <span>
                            {cepAddress.logradouro && `${cepAddress.logradouro}, `}
                            {cepAddress.bairro && `${cepAddress.bairro}, `}
                            {cepAddress.cidade}/{cepAddress.uf}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {billingType === "PIX" && (
                  <div className="rounded-xl border border-border bg-muted p-4 text-sm text-ink-muted space-y-1">
                    <p className="font-medium text-ink">Como funciona</p>
                    <p>
                      Após confirmar, você recebe o QR Code e o código copia-e-cola. Liberação automática em segundos.
                    </p>
                  </div>
                )}

                {billingType === "BOLETO" && (
                  <div className="rounded-xl border border-border bg-muted p-4 text-sm text-ink-muted space-y-1">
                    <p className="font-medium text-ink">Como funciona</p>
                    <p>Após confirmar, você recebe a linha digitável e o link do PDF. Liberação em 1 a 3 dias úteis.</p>
                  </div>
                )}
              </section>

              {createPack.isError && (
                <div className="text-sm text-danger-strong bg-danger-soft border border-danger-mid-border rounded-lg p-3">
                  {(createPack.error as Error).message}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  type="submit"
                  variant="brand"
                  disabled={createPack.isPending}
                  className="w-full h-12 text-sm font-semibold"
                >
                  {createPack.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" /> Pagar{" "}
                      {formatCurrency(tier.valorCentavos / 100, { decimals: 2 })}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </section>

        {!result && (
          <aside className="sticky top-[73px] space-y-4">
            <div className="bg-white rounded-2xl border border-paper-border p-6 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-ink-disabled mb-4">Escolha o pacote</p>

              <div className="space-y-2.5">
                {TIER_ORDER.map((id) => {
                  const t = TIER_CATALOG[id];
                  const desconto = descontoPct(id);
                  const selected = tierId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTierId(id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-colors",
                        selected ? "border-brand bg-brand/5" : "border-border hover:bg-muted"
                      )}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">{t.label}</p>
                        {desconto > 0 && <p className="text-xs text-positive-strong">{desconto}% de desconto</p>}
                      </div>
                      <p className="text-sm font-semibold text-ink whitespace-nowrap">
                        {formatCurrency(t.valorCentavos / 100, { decimals: 2 })}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-border flex justify-between items-baseline">
                <span className="text-xs uppercase tracking-wider text-ink-muted">Total</span>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-ink">
                    {formatCurrency(tier.valorCentavos / 100, { decimals: 2 })}
                  </p>
                  <p className="text-[11px] text-ink-disabled">pagamento único</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-paper-border p-4 space-y-2.5">
              {[
                { icon: Lock, text: "Pagamento 100% seguro, criptografia SSL" },
                { icon: CheckCircle2, text: "Sem expiração no ciclo mensal" },
                { icon: Mail, text: "Recibo enviado por email" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-ink-muted">
                  <Icon className="w-3.5 h-3.5 text-foreground flex-shrink-0" />
                  {text}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </CheckoutShell>
  );
}
