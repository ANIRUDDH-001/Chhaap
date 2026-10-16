import type { LineSpec } from "./types";
import { day, money } from "./format";

export function describePrintSpec(spec: LineSpec) {
  if (spec.product === "banners")
    return `${spec.width ?? "?"} × ${spec.height ?? "?"} ${spec.unit} each`;
  if (spec.product === "manual")
    return [spec.description, spec.manual_reason].filter(Boolean).join(" · ");
  return [
    spec.size === "standard" ? "89 × 51 mm" : spec.size,
    spec.paper ? spec.paper + " GSM" : "Paper needs review",
    spec.sides === "double" ? "double-sided" : "single-sided",
    spec.colour === "mono" ? "black & white" : "full colour",
    spec.finish === "none" ? "no finishing" : spec.finish + " finish",
  ].join(" · ");
}

type CopyQuote = {
  number: string;
  version: number;
  snapshot: {
    shop_name?: string;
    customer?: { name: string; business: string };
    lines: { title: string; spec: LineSpec }[];
    total: number;
    deposit: number;
  };
  delivery_date: string | null;
  expires_at: string;
  terms: string;
};
export function quotationText(quote: CopyQuote, fallbackShop: string) {
  const customer = quote.snapshot.customer;
  return [
    `${quote.snapshot.shop_name || fallbackShop}`,
    `Quotation ${quote.number} v${quote.version}`,
    customer
      ? `Prepared for: ${customer.name}${customer.business ? " · " + customer.business : ""}`
      : "",
    ...quote.snapshot.lines.map(
      (line) =>
        `${line.spec.quantity} ${line.title}: ${describePrintSpec(line.spec)}`,
    ),
    `Total: ${money(quote.snapshot.total)}`,
    `Requested deposit: ${money(quote.snapshot.deposit)}`,
    `Delivery: ${day(quote.delivery_date)}`,
    `Valid until: ${day(quote.expires_at)}`,
    quote.terms,
  ]
    .filter(Boolean)
    .join("\n");
}
