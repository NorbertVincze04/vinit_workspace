/**
 * Phase 4, module 4: the seams for outside services. Credentials come ONLY from environment
 * variables (api/.env or the repo-root .env for Docker), never from the database, and are never sent
 * to the browser: the status endpoint reports which variable names are set, not their values.
 *
 * Built now: the uptime checker (plain HTTP requests from this PC).
 * Stubs, to be written when the business needs them: SmartBill / Oblio invoices, UptimeRobot, the
 * multi-tenant booking platform. Each stub has its interface, so the rest of the app won't change.
 */
import { HttpError } from '../http/errors.js';

const env = (name: string): string => (process.env[name] ?? '').trim();
const missing = (names: readonly string[]): string[] => names.filter((n) => !env(n));

export type IntegrationState = 'built_in' | 'not_configured' | 'configured_not_built';

export interface IntegrationStatus {
  id: string;
  name: string;
  purpose: string;
  state: IntegrationState;
  /** Environment variables it reads (names only). */
  envVars: readonly string[];
  /** The ones not set yet. */
  missing: string[];
  note: string;
}

const notBuilt = (name: string): HttpError =>
  new HttpError(501, 'not_implemented', `The ${name} integration is configured but not built yet. Issue the invoice in ${name} by hand for now.`);

// ---------------------------------------------------------------------------------------------
// Invoices (e-Factura through SmartBill or Oblio)

export interface InvoiceRequest {
  paymentId: string;
  clientName: string;
  clientAddress: string;
  salonName: string;
  amountBani: number;
  issuedOn: string;
  description: string;
}

export interface InvoiceResult {
  series: string;
  number: string;
  /** Link to the PDF in the provider, when it gives one. */
  url?: string;
}

export interface InvoiceProvider {
  readonly id: 'smartbill' | 'oblio';
  readonly name: string;
  readonly envVars: readonly string[];
  createInvoice(request: InvoiceRequest): Promise<InvoiceResult>;
}

const smartbill: InvoiceProvider = {
  id: 'smartbill',
  name: 'SmartBill',
  envVars: ['SMARTBILL_EMAIL', 'SMARTBILL_TOKEN', 'SMARTBILL_CIF', 'SMARTBILL_SERIES'],
  // POST https://ws.smartbill.ro/SBORO/api/invoice (basic auth email:token) — not built yet.
  createInvoice: async () => {
    throw notBuilt('SmartBill');
  },
};

const oblio: InvoiceProvider = {
  id: 'oblio',
  name: 'Oblio',
  envVars: ['OBLIO_EMAIL', 'OBLIO_SECRET', 'OBLIO_CIF', 'OBLIO_SERIES'],
  // OAuth token from https://www.oblio.eu/api/authorize/token, then POST /api/docs/invoice — not built yet.
  createInvoice: async () => {
    throw notBuilt('Oblio');
  },
};

const INVOICE_PROVIDERS = { smartbill, oblio } as const;

/** The provider picked with INVOICE_PROVIDER, when all its variables are set. */
export function invoiceProvider(): InvoiceProvider | null {
  const p = INVOICE_PROVIDERS[env('INVOICE_PROVIDER').toLowerCase() as keyof typeof INVOICE_PROVIDERS];
  return p && !missing(p.envVars).length ? p : null;
}

// ---------------------------------------------------------------------------------------------
// Uptime

export interface UptimeResult {
  url: string;
  ok: boolean;
  /** HTTP status, null when there was no answer. */
  status: number | null;
  ms: number;
  error?: string;
}

const REASONS: Record<string, string> = {
  ENOTFOUND: 'Domain not found (DNS)',
  EAI_AGAIN: 'DNS did not answer',
  ECONNREFUSED: 'Connection refused',
  ECONNRESET: 'Connection dropped',
  CERT_HAS_EXPIRED: 'SSL certificate expired',
  ERR_TLS_CERT_ALTNAME_INVALID: 'SSL certificate is for another domain',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'Self-signed SSL certificate',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'SSL certificate not trusted',
};

/** One GET (redirects followed). Up = an answer below 400 within the timeout. */
export async function checkSite(url: string, timeoutMs = 8000): Promise<UptimeResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'VINIT-Workspace-uptime/1.0' } });
    await res.body?.cancel();
    return { url, ok: res.status < 400, status: res.status, ms: Date.now() - started };
  } catch (error) {
    const e = error as Error & { cause?: { code?: string } };
    const reason = e.name === 'TimeoutError' ? `No answer in ${Math.round(timeoutMs / 1000)}s` : (REASONS[e.cause?.code ?? ''] ?? e.cause?.code ?? e.message);
    return { url, ok: false, status: null, ms: Date.now() - started, error: reason };
  }
}

/** Runs the checks a few at a time. */
export async function checkSites(urls: readonly string[], concurrency = 5): Promise<UptimeResult[]> {
  const out: UptimeResult[] = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const i = next++;
      out[i] = await checkSite(urls[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}

// ---------------------------------------------------------------------------------------------
// The booking platform (the multi-tenant app the salons use)

export interface TenantPlatformProvider {
  /** Tenants that exist on the platform, to compare with the salons here. */
  listTenants(): Promise<{ slug: string; domain: string | null; active: boolean }[]>;
  /** Sends a salon's JSON config (services, hours, branding) to its tenant. */
  pushConfig(tenantSlug: string, config: unknown): Promise<void>;
}

const TENANT_VARS = ['TENANT_PLATFORM_URL', 'TENANT_PLATFORM_TOKEN'] as const;

export const tenantPlatform: TenantPlatformProvider = {
  listTenants: async () => {
    throw new HttpError(501, 'not_implemented', 'The booking platform link is not built yet.');
  },
  pushConfig: async () => {
    throw new HttpError(501, 'not_implemented', 'The booking platform link is not built yet.');
  },
};

// ---------------------------------------------------------------------------------------------

function stubState(vars: readonly string[]): Pick<IntegrationStatus, 'state' | 'missing'> {
  const m = missing(vars);
  return { state: m.length ? 'not_configured' : 'configured_not_built', missing: m };
}

/** What is connected, for the Infra page. Names of variables only, never their values. */
export function integrationsStatus(): IntegrationStatus[] {
  const chosen = env('INVOICE_PROVIDER').toLowerCase();
  const invoices = Object.values(INVOICE_PROVIDERS).map((p): IntegrationStatus => {
    const vars = ['INVOICE_PROVIDER', ...p.envVars];
    const m = missing(p.envVars);
    const selected = chosen === p.id;
    return {
      id: p.id,
      name: p.name,
      purpose: 'Invoices (e-Factura) when a payment is marked paid',
      state: selected && !m.length ? 'configured_not_built' : 'not_configured',
      envVars: vars,
      missing: selected ? m : ['INVOICE_PROVIDER', ...m],
      note: selected
        ? m.length
          ? `Selected, but ${m.join(', ')} ${m.length === 1 ? 'is' : 'are'} missing.`
          : 'Credentials set. Sending invoices is not built yet: issue them by hand.'
        : `Set INVOICE_PROVIDER=${p.id} to use it. Only one invoice provider is used at a time.`,
    };
  });
  return [
    ...invoices,
    {
      id: 'uptime',
      name: 'Uptime checker',
      purpose: 'Is every live salon site answering?',
      state: 'built_in',
      envVars: [],
      missing: [],
      note: 'Built in: checks the primary domain of trial and active salons from this PC when you press the button.',
    },
    {
      id: 'uptimerobot',
      name: 'UptimeRobot',
      purpose: 'Checks every 5 minutes from outside, with alerts',
      ...stubState(['UPTIMEROBOT_API_KEY']),
      envVars: ['UPTIMEROBOT_API_KEY'],
      note: 'Not built yet. Its free plan can watch the sites directly in the meantime.',
    },
    {
      id: 'tenant-platform',
      name: 'Booking platform',
      purpose: 'Compare salons with tenants, push the JSON config',
      ...stubState(TENANT_VARS),
      envVars: TENANT_VARS,
      note: 'Not built yet: the platform has no admin API so far.',
    },
  ];
}
