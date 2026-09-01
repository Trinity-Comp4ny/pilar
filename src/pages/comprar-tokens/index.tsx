import { useCallback, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, QrCode, FileText, Loader2, Lock, Eye, EyeOff, MapPin } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import { lookupCEP } from "@/lib/brasilApi";
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
  return onlyDigits(value).slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
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
  const navigate = useNavigate();
  const { profile } = useAuth();
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
  const [cepAddress, setCepAddress] = useState<{ logradouro: string; bairro: string; cidade: string; uf: string } | null>(
    null
  );
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const cardBrand = detectCardBrand(ccNumber);
  const status = useTokenPackStatus(result?.purchase_id ?? null);
  const paid = result?.payment_status === "paid" || status.data?.status === "paid";

  const fetchCep = useCallback(async (cep: string) => {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setIsFetchingCep(true);
    try {
      const end = await lookupCEP(digits);
      if (!end) {
        toast.error("CEP não encontrado");
        return;
      }
      setCepAddress({ logradouro: end.street, bairro: end.neighborhood, cidade: end.city, uf: end.state });
    } finally {
      setIsFetchingCep(false);
    }
  }, []);

  const voltar = () => navigate("/inicio");

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

  const tier = TIER_CATALOG[tierId];

  if (paid && result) {
    return (
      <PilarPage title="Comprar tokens" breadcrumbs={[{ label: "Início", to: "/inicio" }]}>
        <div className="max-w-md mx-auto text-center space-y-4 py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand/10 text-positive-strong">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Tokens creditados</h2>
            <p className="text-sm text-black/55 mt-1">{formatNumber(result.tokens)} tokens já estão no seu saldo.</p>
          </div>
          <Button
            variant="brand"
            className="rounded-full"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["uso-empresa", profile?.empresa_id] });
              voltar();
            }}
          >
            Voltar ao Pilar
          </Button>
        </div>
      </PilarPage>
    );
  }

  if (result) {
    return (
      <PilarPage title="Comprar tokens" breadcrumbs={[{ label: "Início", to: "/inicio" }]}>
        <div className="max-w-md mx-auto">
          {result.billing_type === "PIX" && result.metadata.pix ? (
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
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-black/30" />
            </div>
          )}
        </div>
      </PilarPage>
    );
  }

  return (
    <PilarPage title="Comprar tokens" breadcrumbs={[{ label: "Início", to: "/inicio" }]}>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <form onSubmit={handleSubmit} className="space-y-6 order-2 lg:order-1">
          <Card className="border border-black/5">
            <CardContent className="pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-ink">Forma de pagamento</h3>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBillingType(value)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-medium transition-all",
                      billingType === value
                        ? "border-brand bg-brand/5 text-ink shadow-sm"
                        : "border-black/10 text-black/55 hover:border-black/20"
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
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ccNumber" className="flex items-center justify-between">
                      Número do cartão
                      {cardBrand && (
                        <span className="text-[11px] font-medium text-black/40 uppercase tracking-wider">
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/35 hover:text-black/60 transition-colors"
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

                  <div className="pt-1 border-t border-black/5">
                    <p className="text-xs text-black/45 mb-3">Endereço de cobrança do titular</p>
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
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-black/35" />
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
                      <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-black/[0.02] border border-black/5 rounded-lg text-xs text-black/55">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
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
                <p className="text-sm text-black/55 bg-black/[0.02] border border-black/5 rounded-xl p-4">
                  Após confirmar, você recebe o QR Code e o código copia-e-cola. Liberação automática em segundos.
                </p>
              )}

              {billingType === "BOLETO" && (
                <p className="text-sm text-black/55 bg-black/[0.02] border border-black/5 rounded-xl p-4">
                  Após confirmar, você recebe a linha digitável e o link do PDF. Liberação em 1 a 3 dias úteis.
                </p>
              )}
            </CardContent>
          </Card>

          {createPack.isError && (
            <p className="text-sm text-danger-strong bg-danger-soft border border-danger-mid-border rounded-lg p-3">
              {(createPack.error as Error).message}
            </p>
          )}

          <Button type="submit" variant="brand" loading={createPack.isPending} className="w-full h-12">
            <Lock className="w-4 h-4 mr-2" /> Pagar {formatCurrency(tier.valorCentavos / 100, { decimals: 2 })}
          </Button>
        </form>

        <aside className="space-y-3 order-1 lg:order-2">
          <p className="text-sm font-medium text-ink px-1">Escolha o pacote</p>
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
                  "relative flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-brand bg-brand/5" : "border-black/10 hover:border-black/20"
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{t.label}</p>
                  {desconto > 0 && <p className="text-xs text-positive-strong">{desconto}% de desconto</p>}
                </div>
                <p className="text-base font-semibold text-ink">
                  {formatCurrency(t.valorCentavos / 100, { decimals: 2 })}
                </p>
              </button>
            );
          })}
          <p className="text-xs text-black/45 px-1">Sem expiração no ciclo. Não afeta os tokens do plano.</p>
        </aside>
      </div>
    </PilarPage>
  );
}
