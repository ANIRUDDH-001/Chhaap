import { useRecords, MoreRecords } from "../lib/records";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Check,
  Copy,
  FilePenLine,
  Printer,
  Search,
  X,
  LoaderCircle,
} from "lucide-react";
import { api, post, errorMessage } from "../lib/api";
import type { Quote } from "../lib/types";
import { money, day, label } from "../lib/format";
import { useSession } from "../lib/session";
import {
  Empty,
  ErrorNote,
  Loading,
  Modal,
  PageHeading,
  Tag,
  useToast,
} from "../components/ui";
import { QuotePaper } from "../components/QuotePaper";

export function Quotes() {
  const query = useQueryClient();
  const session = useSession();
  const navigate = useNavigate();
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(params.get("open"));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rows = useRecords<Quote>("quotes", search, filter);
  const selected = useQuery({
    queryKey: ["quote", openId],
    queryFn: () => api<Quote>("/quotes/" + openId),
    enabled: !!openId,
  });
  useEffect(() => {
    if (params.get("open")) setOpenId(params.get("open"));
  }, [params]);
  async function respond(response: string) {
    if (!selected.data) return;
    setBusy(true);
    setError("");
    try {
      await post("/quotes/" + openId + "/response", {
        response,
        expected_revision: selected.data.revision,
        note,
      });
      await selected.refetch();
      query.invalidateQueries({ queryKey: ["quotes"] });
      query.invalidateQueries({ queryKey: ["orders"] });
      query.invalidateQueries({ queryKey: ["reports"] });
      notify(
        response === "accepted"
          ? "Acceptance recorded. The job is on your production board."
          : "Customer response recorded.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const items =
    rows.data?.items.filter(
      (q) =>
        (filter === "all" || q.status === filter) &&
        (q.number + " " + q.customer?.name + " " + q.customer?.business)
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageHeading
        title="Good work, clearly quoted."
        description="Reviewed specifications. Reproducible prices. Every version accounted for."
      >
        <Link className="button primary" to="/requests">
          Open quote desk
        </Link>
      </PageHeading>
      <MoreRecords list={rows} />
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="Search quotes or customers"
            aria-label="Search quotations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Quote status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            "all",
            "issued",
            "accepted",
            "declined",
            "expired",
            "superseded",
            "cancelled",
          ].map((s) => (
            <option value={s} key={s}>
              {s === "all" ? "All statuses" : label(s)}
            </option>
          ))}
        </select>
      </div>
      {rows.isPending ? (
        <Loading />
      ) : rows.isError ? (
        <ErrorNote message={rows.error.message} />
      ) : items.length ? (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead>
              <tr>
                <th>Quotation</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Valid until</th>
                <th className="number">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id}>
                  <td>
                    <strong>{q.number}</strong>
                    <small>
                      Version {q.version} · {q.snapshot.lines.length} item
                      {q.snapshot.lines.length > 1 ? "s" : ""}
                    </small>
                  </td>
                  <td>
                    {q.customer?.name}
                    <small>{q.customer?.business}</small>
                  </td>
                  <td>
                    <Tag
                      tone={
                        q.status === "accepted"
                          ? "green"
                          : q.status === "issued"
                            ? "amber"
                            : "neutral"
                      }
                    >
                      {label(q.status)}
                    </Tag>
                  </td>
                  <td>{day(q.expires_at)}</td>
                  <td className="number strong">{money(q.snapshot.total)}</td>
                  <td>
                    <button
                      className="button small"
                      onClick={() => {
                        setError("");
                        setOpenId(q.id);
                      }}
                    >
                      View quote
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={
            search || filter !== "all"
              ? "No quotes match that view."
              : "Make your first impression."
          }
          description="A reviewed request becomes a fixed, customer-ready quotation here."
          action={
            <Link className="button" to="/requests">
              Review a request
            </Link>
          }
        />
      )}
      <Modal
        open={!!openId}
        onOpenChange={(value) => {
          if (!value) {
            setOpenId(null);
            setParams({});
            setError("");
          }
        }}
        title={
          selected.data
            ? selected.data.number + " · version " + selected.data.version
            : "Quotation"
        }
        description="This saved specification and price stay fixed when your rates change."
        wide
      >
        {selected.isPending ? (
          <Loading />
        ) : selected.isError ? (
          <ErrorNote message={selected.error.message} />
        ) : (
          selected.data && (
            <div className="quote-dialog-layout">
              <div className="print-area">
                <QuotePaper
                  snapshot={selected.data.snapshot}
                  shopName={session.shop.name}
                  customer={selected.data.customer}
                  quote={selected.data}
                  deliveryDate={selected.data.delivery_date}
                />
              </div>
              <aside className="quote-controls">
                <Tag
                  tone={selected.data.status === "accepted" ? "green" : "amber"}
                >
                  {label(selected.data.status)}
                </Tag>
                <h3>A clear record, start to finish.</h3>
                <p>
                  Issued {day(selected.data.created_at)}.<br />
                  Valid until {day(selected.data.expires_at)}.
                </p>
                <button className="button full" onClick={() => window.print()}>
                  <Printer size={16} />
                  Print / save PDF
                </button>
                <button
                  className="button full"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${session.shop.name}\nQuotation ${selected.data!.number} v${selected.data!.version}\n${selected.data!.snapshot.lines.map((l) => `${l.spec.quantity} ${l.title}`).join("\n")}\nTotal: ${money(selected.data!.snapshot.total)}\nRequested deposit: ${money(selected.data!.snapshot.deposit)}\nDelivery: ${day(selected.data!.delivery_date)}\nValid until: ${day(selected.data!.expires_at)}\n${selected.data!.terms}`,
                      );
                      notify("Quotation copied. Nothing was sent.");
                    } catch {
                      notify("Clipboard unavailable. Use the print view.");
                    }
                  }}
                >
                  <Copy size={16} />
                  Copy quotation
                </button>
                {selected.data.status === "issued" && (
                  <>
                    <div className="control-divider" />
                    <h4>Record the customer’s response</h4>
                    <p>
                      This records an off-platform response. It does not contact
                      the customer.
                    </p>
                    <label className="field">
                      Confirmation note
                      <textarea
                        rows={3}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g. Riya confirmed by phone"
                      />
                    </label>
                    {error && <ErrorNote message={error} />}
                    <button
                      className="button primary full"
                      disabled={busy}
                      onClick={() => respond("accepted")}
                    >
                      {busy ? (
                        <LoaderCircle size={15} className="spin" />
                      ) : (
                        <Check size={15} />
                      )}
                      Record acceptance
                    </button>
                    <button
                      className="button full"
                      disabled={busy}
                      onClick={() => respond("declined")}
                    >
                      <X size={15} />
                      Record decline
                    </button>
                    <button
                      className="text-button"
                      onClick={async () => {
                        setError("");
                        try {
                          const res = await post<{
                            request_id: string;
                            revises_quote_id: string;
                          }>("/quotes/" + openId + "/revise", {
                            expected_revision: selected.data!.revision,
                          });
                          navigate(
                            "/requests/" +
                              res.request_id +
                              "?revises=" +
                              res.revises_quote_id,
                          );
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                      }}
                    >
                      <FilePenLine size={14} />
                      Prepare a revised quote
                    </button>
                  </>
                )}
                {selected.data.order_id && (
                  <Link
                    className="button primary full"
                    to={"/jobs?open=" + selected.data.order_id}
                  >
                    Open production job
                  </Link>
                )}
                {selected.data.status === "accepted" && (
                  <p>
                    Accepted quotes stay fixed. Additional work needs its own
                    quotation.
                  </p>
                )}
              </aside>
            </div>
          )
        )}
      </Modal>
    </>
  );
}
