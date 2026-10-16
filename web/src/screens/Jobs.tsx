import { useRecords, MoreRecords } from "../lib/records";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Check,
  Clock3,
  LoaderCircle,
  Search,
} from "lucide-react";
import { api, post, key, errorMessage } from "../lib/api";
import type { Order } from "../lib/types";
import { day, label, money } from "../lib/format";
import { describePrintSpec } from "../lib/print-spec";
import {
  Empty,
  ErrorNote,
  Loading,
  Modal,
  PageHeading,
  Tag,
  useToast,
} from "../components/ui";
const stages = [
  "proof_pending",
  "approved_for_print",
  "printing",
  "finishing",
  "ready",
  "delivered",
];

export function Jobs() {
  const query = useQueryClient();
  const notify = useToast();
  const [params] = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(params.get("open"));
  const [search, setSearch] = useState("");
  const [closed, setClosed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("receipt");
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [paymentKey, setPaymentKey] = useState(key);
  const orders = useRecords<Order>(
    "orders",
    search,
    closed ? "closed" : "active",
  );
  const detail = useQuery({
    queryKey: ["order", openId],
    queryFn: () => api<Order>("/orders/" + openId),
    enabled: !!openId,
  });
  async function refresh() {
    await detail.refetch();
    await query.invalidateQueries({ queryKey: ["orders"] });
    query.invalidateQueries({ queryKey: ["reports"] });
  }
  async function move(stage: string) {
    if (!detail.data) return;
    setBusy(true);
    setError("");
    try {
      await post("/orders/" + openId + "/transition", {
        stage,
        expected_revision: detail.data.revision,
        note,
      });
      setNote("");
      await refresh();
      notify("Job moved to " + label(stage).toLowerCase() + ".");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const items =
    orders.data?.items.filter((o) =>
      (o.number + " " + o.customer?.name + " " + o.customer?.business)
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageHeading
        title="From proof to pickup."
        description="A clear place for every job, with approval before the press starts."
      >
        <button className="button" onClick={() => setClosed(!closed)}>
          {closed ? "Show active board" : "Delivered & cancelled"}
        </button>
      </PageHeading>
      <MoreRecords list={orders} />
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search production jobs"
            placeholder="Find a job or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="quiet-label">
          Payment status stays separate from production.
        </span>
      </div>
      {orders.isPending ? (
        <Loading />
      ) : orders.isError ? (
        <ErrorNote message={orders.error.message} />
      ) : !items.length ? (
        <Empty
          title="Give good work a clear path."
          description="Record a customer’s quote acceptance to create a production job."
          action={
            <Link className="button" to="/quotes">
              Open quotations
            </Link>
          }
        />
      ) : closed ? (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items
                .filter((o) => ["delivered", "cancelled"].includes(o.stage))
                .map((o) => (
                  <tr key={o.id}>
                    <td>{o.number}</td>
                    <td>{o.customer?.name}</td>
                    <td>
                      <Tag>{label(o.stage)}</Tag>
                    </td>
                    <td>{money(o.balance)}</td>
                    <td>
                      <button
                        className="button small"
                        onClick={() => setOpenId(o.id)}
                      >
                        Open record
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="production-board">
          {stages.slice(0, 5).map((stage) => (
            <section className="production-column" key={stage}>
              <h2>
                {label(stage)}
                <span>{items.filter((o) => o.stage === stage).length}</span>
              </h2>
              {items
                .filter((o) => o.stage === stage)
                .map((o) => (
                  <button
                    className="production-card"
                    key={o.id}
                    onClick={() => {
                      setError("");
                      setOpenId(o.id);
                    }}
                  >
                    <span className="job-number">{o.number}</span>
                    <h3>{o.customer?.business || o.customer?.name}</h3>
                    <p>
                      {o.snapshot.lines
                        .map(
                          (l) => `${l.spec.quantity} ${l.title.toLowerCase()}`,
                        )
                        .join(", ")}
                    </p>
                    <div>
                      <Tag tone={o.balance > 0 ? "amber" : "green"}>
                        {o.balance > 0
                          ? money(o.balance) + " due"
                          : o.balance < 0
                            ? money(-o.balance) + " credit"
                            : "Paid"}
                      </Tag>
                    </div>
                    <footer>
                      <span>
                        <Clock3 size={12} /> {day(o.due_date)}
                      </span>
                      <ArrowRight size={14} />
                    </footer>
                  </button>
                ))}
              {!items.some((o) => o.stage === stage) && (
                <p className="column-empty">Nothing here yet.</p>
              )}
            </section>
          ))}
        </div>
      )}
      <Modal
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) {
            setOpenId(null);
            setError("");
            setNote("");
          }
        }}
        title={detail.data?.number || "Production job"}
        description="Production, approval, and payment history in one job jacket."
        wide
      >
        {detail.isPending ? (
          <Loading />
        ) : detail.isError ? (
          <ErrorNote message={detail.error.message} />
        ) : (
          detail.data && (
            <div className="job-detail-layout">
              <section>
                <div className="job-detail-heading">
                  <div>
                    <h3>{detail.data.customer?.name}</h3>
                    <p>{detail.data.customer?.business}</p>
                  </div>
                  <Tag
                    tone={detail.data.stage === "delivered" ? "green" : "amber"}
                  >
                    {label(detail.data.stage)}
                  </Tag>
                </div>
                <div className="spec-summary">
                  {detail.data.snapshot.lines.map((l, i) => (
                    <div key={i}>
                      <strong>
                        {l.spec.quantity} {l.title.toLowerCase()}
                      </strong>
                      <p>{describePrintSpec(l.spec)}</p>
                    </div>
                  ))}
                </div>
                <Link
                  className="text-button"
                  to={"/quotes?open=" + detail.data.quote_id}
                >
                  Open accepted quotation <ArrowRight size={14} />
                </Link>
                <div className="job-metrics">
                  <div>
                    <span>Order total</span>
                    <strong>{money(detail.data.total)}</strong>
                  </div>
                  <div>
                    <span>Net received</span>
                    <strong>{money(detail.data.received)}</strong>
                  </div>
                  <div>
                    <span>
                      {detail.data.balance < 0 ? "Customer credit" : "Balance"}
                    </span>
                    <strong>{money(Math.abs(detail.data.balance))}</strong>
                  </div>
                </div>
                <div className="section-heading">
                  <h4>Payment record</h4>
                  <button
                    className="button small"
                    onClick={() => {
                      setPaymentOpen(true);
                      setPaymentKey(key());
                      setAmount(
                        detail.data!.balance > 0
                          ? String(detail.data!.balance / 100)
                          : "",
                      );
                      setError("");
                    }}
                  >
                    <Banknote size={14} />
                    Record payment
                  </button>
                </div>
                {detail.data.payments?.length ? (
                  <div className="ledger-list">
                    {detail.data.payments.map((p) => (
                      <div key={p.id}>
                        <div>
                          <strong>{label(p.kind)}</strong>
                          <small>
                            {p.method} · {day(p.created_at)}
                            {p.reference ? " · " + p.reference : ""}
                          </small>
                          {p.note && <small>{p.note}</small>}
                        </div>
                        <b>{money(p.amount)}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="quiet-empty">
                    No money recorded as received yet.
                  </p>
                )}
                <div className="section-heading">
                  <h4>Activity</h4>
                </div>
                <div className="activity-list">
                  {detail.data.history?.map((e, i) => (
                    <div key={i}>
                      <Check size={12} />
                      <span>
                        {label(e.action)}
                        <small>{day(e.created_at)}</small>
                        {typeof e.detail.note === "string" && e.detail.note && (
                          <small>{e.detail.note}</small>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              <aside className="job-controls">
                <h4>Requested delivery</h4>
                <p>{day(detail.data.due_date)}</p>
                {!["delivered", "cancelled"].includes(detail.data.stage) && (
                  <>
                    <div className="control-divider" />
                    <h4>
                      {detail.data.stage === "proof_pending"
                        ? "Approve the artwork"
                        : "Move this job forward"}
                    </h4>
                    <p>
                      {detail.data.stage === "proof_pending"
                        ? "Record who checked the artwork with the customer."
                        : "Each stage stays in the job’s activity history."}
                    </p>
                    <label className="field">
                      {detail.data.stage === "proof_pending"
                        ? "Artwork approval note"
                        : "Production note (optional)"}
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={
                          detail.data.stage === "proof_pending"
                            ? "e.g. Customer approved final proof by phone"
                            : ""
                        }
                      />
                    </label>
                    {error && <ErrorNote message={error} />}
                    <button
                      className="button primary full"
                      disabled={busy}
                      onClick={() =>
                        move(stages[stages.indexOf(detail.data!.stage) + 1])
                      }
                    >
                      {busy ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <ArrowRight size={15} />
                      )}{" "}
                      {detail.data.stage === "proof_pending"
                        ? "Approve for print"
                        : detail.data.stage === "ready"
                          ? "Mark delivered"
                          : "Move to " +
                            label(
                              stages[stages.indexOf(detail.data.stage) + 1],
                            ).toLowerCase()}
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() => {
                        if (!note.trim()) {
                          setError(
                            "Add a cancellation reason in the note first.",
                          );
                          return;
                        }
                        void move("cancelled");
                      }}
                    >
                      Cancel job with reason
                    </button>
                  </>
                )}
                {detail.data.proof_note && (
                  <div className="proof-note">
                    <Tag tone="green">Artwork approved</Tag>
                    <p>{detail.data.proof_note}</p>
                  </div>
                )}
                <p className="form-help">
                  Delivering a job does not mark its balance paid. Payment
                  records do not move money.
                </p>
              </aside>
            </div>
          )
        )}
      </Modal>
      <Modal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        title="Record what changed hands."
        description="This updates the job ledger. It does not initiate a payment or refund."
      >
        <form
          className="stacked-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post("/orders/" + openId + "/payments", {
                kind,
                amount: Math.round(Number(amount) * 100),
                method,
                reference,
                note,
                idempotency_key: paymentKey,
              });
              await refresh();
              setPaymentOpen(false);
              notify("Payment record saved. No money was moved.");
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="field-pair">
            <label className="field">
              Record type
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="receipt">Money received</option>
                <option value="refund">Money refunded</option>
                <option value="reversal">Correction / reversal</option>
              </select>
            </label>
            <label className="field">
              Amount (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          </div>
          <div className="field-pair">
            <label className="field">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {["Cash", "UPI", "Bank transfer", "Card", "Other"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Reference
              <input
                maxLength={200}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional receipt reference"
              />
            </label>
          </div>
          <label className="field">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </label>
          {error && <ErrorNote message={error} />}
          <div className="dialog-actions">
            <button className="button primary" disabled={busy}>
              Save payment record
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
