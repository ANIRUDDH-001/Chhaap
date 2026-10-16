import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Plus,
  FileCheck2,
  Clock3,
  Coins,
  Inbox,
} from "lucide-react";
import { api } from "../lib/api";
import type { Reports, RequestRecord, Order } from "../lib/types";
import { day, money, initials, label } from "../lib/format";
import { useSession } from "../lib/session";
import { Empty, ErrorNote, Loading, PageHeading, Tag } from "../components/ui";

export function Today({ onNew }: { onNew: () => void }) {
  const session = useSession();
  const report = useQuery({
    queryKey: ["reports"],
    queryFn: () => api<Reports>("/reports"),
  });
  const requests = useQuery({
    queryKey: ["requests"],
    queryFn: () => api<{ items: RequestRecord[] }>("/requests"),
  });
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<{ items: Order[] }>("/orders"),
  });
  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorNote message={report.error.message} />;
  const r = report.data;
  const pending =
    requests.data?.items.filter((r) => r.status !== "ready") || [];
  return (
    <>
      <PageHeading
        title="A good day starts here."
        description={day(new Date().toISOString()) + " · " + session.shop.name}
      >
        <button className="button primary" onClick={onNew}>
          <Plus size={16} />
          New request
        </button>
      </PageHeading>
      <div className="today-grid">
        <section className="today-intro">
          <div className="press-motif" aria-hidden>
            <span>
              made to
              <br />
              make an
              <br />
              impression.
            </span>
            <i />
            <i />
            <i />
          </div>
          <Tag>
            {session.shop.mode === "sample"
              ? "Your sample counter"
              : "Your print counter"}
          </Tag>
          <h2>
            Less back-and-forth.
            <br />
            More good printing.
          </h2>
          <p>
            {pending.length
              ? `${pending.length} request${pending.length > 1 ? "s need" : " needs"} your eye. Start with the details that still need a little clarity.`
              : "The counter is clear. Bring in a new conversation when the next print job arrives."}
          </p>
          {requests.data?.items[0] ? (
            <Link
              className="button"
              to={"/requests/" + requests.data.items[0].id}
            >
              Open the quote desk
              <ArrowRight size={16} />
            </Link>
          ) : (
            <button className="button" onClick={onNew}>
              Create your first request
              <ArrowRight size={16} />
            </button>
          )}
        </section>
        <section className="counter-summary">
          <h2>At the counter</h2>
          <div>
            <Inbox size={18} />
            <span>Requests to review</span>
            <b>{pending.length}</b>
          </div>
          <div>
            <FileCheck2 size={18} />
            <span>Issued quotations</span>
            <b>{r.issued_quotes}</b>
          </div>
          <div>
            <Clock3 size={18} />
            <span>Active print jobs</span>
            <b>
              {orders.data?.items.filter(
                (o) => !["delivered", "cancelled"].includes(o.stage),
              ).length || 0}
            </b>
          </div>
          <div>
            <Coins size={18} />
            <span>Outstanding balance</span>
            <b>{money(r.outstanding)}</b>
          </div>
          <p>Live counts from your saved shop records.</p>
        </section>
      </div>
      <div className="section-heading">
        <h2>Your next few decisions</h2>
        <Link to="/requests" className="text-button">
          All requests
          <ArrowRight size={14} />
        </Link>
      </div>
      {requests.data?.items.length ? (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Request</th>
                <th>Needs attention</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.data.items.slice(0, 5).map((req) => (
                <tr key={req.id}>
                  <td>
                    <div className="table-person">
                      <span className="avatar lilac">
                        {initials(req.customer?.name || "Customer")}
                      </span>
                      <div>
                        <strong>{req.customer?.name}</strong>
                        <small>{req.customer?.business}</small>
                      </div>
                    </div>
                  </td>
                  <td>{req.title}</td>
                  <td>
                    <Tag tone={req.status === "ready" ? "green" : "amber"}>
                      {req.status === "ready"
                        ? "Ready for a quote"
                        : "Review specifications"}
                    </Tag>
                  </td>
                  <td>
                    <Link className="button small" to={"/requests/" + req.id}>
                      Review
                      <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="A clean sheet."
          description="Create a request to start a conversation-to-quote workflow."
          action={
            <button className="button" onClick={onNew}>
              New request
            </button>
          }
        />
      )}
      <div className="section-heading">
        <h2>On the press</h2>
        <Link to="/jobs" className="text-button">
          Production board
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="job-strip">
        {orders.data?.items
          .filter((o) => !["delivered", "cancelled"].includes(o.stage))
          .slice(0, 3)
          .map((o) => (
            <Link
              className="job-strip-item"
              to={"/jobs?open=" + o.id}
              key={o.id}
            >
              <Tag tone={o.stage === "ready" ? "green" : "neutral"}>
                {label(o.stage)}
              </Tag>
              <h3>{o.customer?.business || o.customer?.name}</h3>
              <p>
                {o.snapshot.lines
                  .map((l) => `${l.spec.quantity} ${l.title.toLowerCase()}`)
                  .join(", ")}
              </p>
              <span>
                Due {day(o.due_date)}
                <ArrowRight size={15} />
              </span>
            </Link>
          )) || null}
        {!orders.data?.items.some(
          (o) => !["delivered", "cancelled"].includes(o.stage),
        ) && (
          <p className="quiet-empty">
            Accepted quotations appear here as production jobs.
          </p>
        )}
      </div>
    </>
  );
}

export function RequestList({ onNew }: { onNew: () => void }) {
  const requests = useQuery({
    queryKey: ["requests"],
    queryFn: () => api<{ items: RequestRecord[] }>("/requests"),
  });
  return (
    <>
      <PageHeading
        title="Every conversation has a place."
        description="Open a request, clarify the details, and prepare the next good print job."
      >
        <button className="button primary" onClick={onNew}>
          <Plus size={16} />
          New request
        </button>
      </PageHeading>
      {requests.isPending ? (
        <Loading />
      ) : requests.isError ? (
        <ErrorNote message={requests.error.message} />
      ) : requests.data.items.length ? (
        <div className="record-table-wrap">
          <table className="record-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Request</th>
                <th>Status</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.data.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.customer?.name}</strong>
                    <small>{r.customer?.business}</small>
                  </td>
                  <td>{r.title}</td>
                  <td>
                    <Tag tone={r.status === "ready" ? "green" : "amber"}>
                      {label(r.status)}
                    </Tag>
                  </td>
                  <td>{day(r.created_at)}</td>
                  <td>
                    <Link className="button small" to={"/requests/" + r.id}>
                      Open request
                      <ArrowRight size={13} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Ready for the next conversation."
          description="Paste a customer message or create a request for a screenshot."
          action={
            <button className="button" onClick={onNew}>
              New request
            </button>
          }
        />
      )}
    </>
  );
}
