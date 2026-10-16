export type LineSpec = {
  product: string;
  description?: string;
  quantity: number | null;
  paper: string | null;
  size: string;
  sides: string;
  colour: string;
  finish: string;
  width?: number | null;
  height?: number | null;
  unit: string;
  confirmed: boolean;
  manual_price?: number | null;
  manual_reason?: string;
};
export type Customer = {
  id: string;
  name: string;
  business: string;
  phone: string;
  email: string;
};
export type Source = {
  id: string;
  kind: "text" | "image";
  text: string;
  sender: string;
  position: number;
  url: string | null;
};
export type Evidence = {
  field: string;
  value: string;
  source_id: string;
  quote: string;
  line: number;
  verified: boolean;
  source_kind: string;
};
export type Extraction = {
  lines: LineSpec[];
  evidence: Evidence[];
  missing: string[];
  conflicts: string[];
  reply: string;
  language: string;
  delivery_text?: string;
  transcription?: string;
  model?: string;
  duration_seconds?: number;
};
export type RequestRecord = {
  id: string;
  title: string;
  revision: number;
  customer: Customer | null;
  status: string;
  lines: LineSpec[];
  adjustments: QuoteAdjustments;
  delivery_date: string | null;
  delivery_confirmed: boolean;
  notes: string;
  created_at: string;
  sources: Source[];
  extraction: Extraction | null;
  job: { id: string; status: string; error: string | null } | null;
};
export type Component = { label: string; amount: number; detail?: string };
export type Snapshot = {
  shop_name?: string;
  customer?: Customer;
  currency: string;
  rate_version: string;
  lines: {
    spec: LineSpec;
    title: string;
    components: Component[];
    total: number;
  }[];
  components: Component[];
  subtotal: number;
  total: number;
  deposit: number;
  ready: boolean;
  warnings: string[];
};
export type QuoteAdjustments = {
  rush?: number;
  delivery?: number;
  design?: number;
  discount?: number;
  reason?: string;
  tax_percent?: string | null;
  deposit_percent?: string | null;
};
export type Quote = {
  id: string;
  request_id: string;
  number: string;
  version: number;
  revision: number;
  status: string;
  snapshot: Snapshot;
  customer: Customer | null;
  delivery_date: string | null;
  created_at: string;
  expires_at: string;
  terms: string;
  order_id: string | null;
};
export type Payment = {
  id: string;
  kind: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  created_at: string;
};
export type Order = {
  id: string;
  number: string;
  revision: number;
  stage: string;
  customer: Customer | null;
  due_date: string | null;
  total: number;
  received: number;
  balance: number;
  snapshot: Snapshot;
  proof_note: string;
  quote_id: string;
  created_at: string;
  payments?: Payment[];
  history?: {
    action: string;
    detail: Record<string, unknown>;
    created_at: string;
  }[];
};
export type SessionInfo = {
  shop: {
    id: string;
    name: string;
    mode: string;
    settings: {
      timezone: string;
      currency: string;
      quote_validity_days: number;
      retention_days: number;
    };
  };
  user: { name: string; role: string };
};
export type RateConfig = {
  version: string;
  setup: number;
  tax_percent: number;
  deposit_percent: number;
  cards: {
    title: string;
    tiers: number[][];
    papers: Record<string, number>;
    minimum: number;
  };
  flyers: {
    title: string;
    tiers: number[][];
    papers: Record<string, number>;
    minimum: number;
    sizes: Record<string, string>;
  };
  banners: { title: string; per_sqft: number; minimum: number };
  finishing: Record<string, number>;
  print_multipliers: Record<string, string>;
};
export type Rates = {
  number: number;
  config: RateConfig;
  history?: { number: number; created_at: string }[];
};
export type Reports = {
  issued_quote_value: number;
  issued_quotes: number;
  accepted_order_value: number;
  received: number;
  outstanding: number;
  stages: Record<string, number>;
  requests: number;
  customers: number;
  orders: number;
};
export const blankLine = (): LineSpec => ({
  product: "cards",
  quantity: 500,
  paper: null,
  size: "standard",
  sides: "double",
  colour: "colour",
  finish: "matte",
  unit: "ft",
  confirmed: false,
});
