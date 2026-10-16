import type { Snapshot, Customer, Quote } from "../lib/types";
import { money, day } from "../lib/format";

export function QuotePaper({
  snapshot,
  shopName,
  customer,
  quote,
  deliveryDate,
}: {
  snapshot: Snapshot | null;
  shopName: string;
  customer: Customer | null;
  quote?: Quote;
  deliveryDate?: string | null;
}) {
  const recipient = quote ? snapshot?.customer || customer : customer;
  return (
    <article className="quote-paper" aria-label="Quotation preview">
      <div className="paper-brand">
        {quote ? snapshot?.shop_name || shopName : shopName}
        <small>Thoughtful printing, around the corner.</small>
      </div>
      <div className="paper-heading">
        <div>
          <h3>Quotation</h3>
          <span>
            {quote
              ? `${quote.number} · v${quote.version}`
              : "Draft · not issued"}
          </span>
        </div>
        <span>
          {quote ? day(quote.created_at) : day(new Date().toISOString())}
        </span>
      </div>
      <div className="paper-recipient">
        Prepared for
        <strong>
          {recipient?.name || "Choose a customer"}
          {recipient?.business ? " · " + recipient.business : ""}
        </strong>
      </div>
      {snapshot ? (
        snapshot.lines.map((line, i) => (
          <section className="paper-item" key={i}>
            <h4>
              {line.spec.quantity?.toLocaleString("en-IN")}{" "}
              {line.title.toLowerCase()}
            </h4>
            <p>
              {line.spec.product === "banners"
                ? `${line.spec.width} × ${line.spec.height} ${line.spec.unit}`
                : [
                    line.spec.size === "standard"
                      ? "Standard size"
                      : line.spec.size,
                    line.spec.sides === "double"
                      ? "double-sided"
                      : "single-sided",
                    line.spec.colour,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
              <br />
              {line.spec.paper
                ? `${line.spec.paper} GSM`
                : "Paper needs review"}
              {line.spec.finish !== "none"
                ? " · " + line.spec.finish + " finish"
                : ""}
            </p>
            {line.components.map((c, j) => (
              <div className="paper-price-row" key={j}>
                <span>
                  {c.label}
                  {c.detail && <small>{c.detail}</small>}
                </span>
                <b>{money(c.amount, true)}</b>
              </div>
            ))}
          </section>
        ))
      ) : (
        <p className="paper-awaiting">
          Enter the job details to see an estimate.
        </p>
      )}
      {snapshot && (
        <>
          {snapshot.components
            .filter((c) => c.amount !== 0)
            .map((c, i) => (
              <div className="paper-price-row order-charge" key={i}>
                <span>{c.label}</span>
                <b>{money(c.amount, true)}</b>
              </div>
            ))}
          <div className="paper-total">
            <span>{quote ? "Total" : "Total estimate"}</span>
            <strong>{money(snapshot.total)}</strong>
          </div>
          <div className="paper-deposit">
            <span>Requested deposit</span>
            <b>{money(snapshot.deposit)}</b>
          </div>
        </>
      )}
      <div className="paper-terms">
        <p>
          {quote
            ? "Valid until " + day(quote.expires_at)
            : "Validity begins when the quote is issued."}
        </p>
        <p>
          {deliveryDate
            ? "Requested delivery: " + day(deliveryDate)
            : "Delivery date needs confirmation."}
        </p>
        <p>{quote?.terms || "Artwork approval required before printing."}</p>
        <p>
          Rate card {snapshot?.rate_version || "—"} ·{" "}
          {snapshot?.components.some((c) => c.label.startsWith("Tax"))
            ? "Shop-configured tax"
            : "Tax not configured"}
        </p>
      </div>
    </article>
  );
}
