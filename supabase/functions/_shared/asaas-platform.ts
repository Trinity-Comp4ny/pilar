/**
 * Cliente HTTP pro Asaas da plataforma Pilar (Labrynth).
 *
 * Diferente de asaas_config (B2B — cada empresa tem sua chave), este módulo
 * usa uma única chave global pra cobrar assinantes do próprio Pilar.
 *
 * Env vars obrigatórias:
 *   ASAAS_PLATFORM_API_KEY   chave da conta Labrynth
 *   ASAAS_PLATFORM_ENV       sandbox | producao
 *   ASAAS_PLATFORM_WEBHOOK_TOKEN  token compartilhado entre Asaas e a edge function
 */

const BASE_URLS = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  producao: "https://api.asaas.com/v3",
} as const;

export function getPlatformConfig() {
  const apiKey = Deno.env.get("ASAAS_PLATFORM_API_KEY");
  const env = (Deno.env.get("ASAAS_PLATFORM_ENV") ?? "sandbox") as keyof typeof BASE_URLS;

  if (!apiKey) {
    throw new Error("ASAAS_PLATFORM_API_KEY não configurada");
  }
  if (!(env in BASE_URLS)) {
    throw new Error(`ASAAS_PLATFORM_ENV inválido: ${env}`);
  }

  return { apiKey, env, baseUrl: BASE_URLS[env] };
}

type HeadersInitLocal = Record<string, string>;

async function asaasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = getPlatformConfig();

  const headers: HeadersInitLocal = {
    "Content-Type": "application/json",
    access_token: apiKey,
    ...((init.headers as HeadersInitLocal | undefined) ?? {}),
  };

  const resp = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await resp.text();
  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // mantém null
  }

  if (!resp.ok) {
    const errMsg =
      (json as { errors?: Array<{ description?: string }> })?.errors?.[0]?.description ?? `Asaas ${resp.status}`;
    throw new Error(`Asaas: ${errMsg}`);
  }

  return json as T;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
}

export async function findCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
  const digits = cpfCnpj.replace(/\D/g, "");
  if (!digits) return null;

  const resp = await asaasFetch<{ data: AsaasCustomer[] }>(`/customers?cpfCnpj=${digits}&limit=1`);
  return resp.data?.[0] ?? null;
}

export async function createCustomer(params: {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  externalReference?: string;
}): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.name,
      email: params.email,
      cpfCnpj: params.cpfCnpj.replace(/\D/g, ""),
      ...(params.phone && { phone: params.phone.replace(/\D/g, "") }),
      ...(params.externalReference && { externalReference: params.externalReference }),
      notificationDisabled: false,
    }),
  });
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
  nextDueDate: string;
  value: number;
  cycle: string;
  billingType: string;
}

export interface CreateSubscriptionParams {
  customer: string;
  billingType: "CREDIT_CARD" | "PIX" | "BOLETO" | "UNDEFINED";
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  nextDueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone?: string;
  };
  remoteIp?: string;
}

export async function createSubscription(params: CreateSubscriptionParams): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Payments (buscar 1ª cobrança de subscription)
// ---------------------------------------------------------------------------

export interface AsaasPayment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  identificationField?: string;
  nossoNumero?: string;
  subscription?: string;
  externalReference?: string;
}

export async function getSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const resp = await asaasFetch<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments?limit=1&sort=dueDate&order=asc`
  );
  return resp.data ?? [];
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export async function getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`);
}

export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return asaasFetch<AsaasPayment>(`/payments/${paymentId}`);
}

// ---------------------------------------------------------------------------
// Subscription management (update / cancel)
// ---------------------------------------------------------------------------

export interface UpdateSubscriptionParams {
  value?: number;
  cycle?: "MONTHLY" | "YEARLY";
  description?: string;
  updatePendingPayments?: boolean;
}

export async function updateSubscription(
  subscriptionId: string,
  params: UpdateSubscriptionParams
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(`/subscriptions/${subscriptionId}`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<{ deleted: boolean; id: string }> {
  return asaasFetch<{ deleted: boolean; id: string }>(`/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}
