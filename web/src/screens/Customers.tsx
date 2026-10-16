import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Plus, RotateCcw, Search } from "lucide-react";
import { api, post, errorMessage } from "../lib/api";
import type { Customer, Quote, Order, RequestRecord } from "../lib/types";
import { initials, money, day, label } from "../lib/format";
import {
  Empty,
  ErrorNote,
  Loading,
  Modal,
  PageHeading,
  Tag,
  useToast,
} from "../components/ui";

type CustomerDetail = Customer & { quotes: Quote[]; orders: Order[] };
export function Customers() {
  const navigate = useNavigate();
  const query = useQueryClient();
  const notify = useToast();
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<{ items: Customer[] }>("/customers"),
  });
  const detail = useQuery({
    queryKey: ["customer", openId],
    queryFn: () => api<CustomerDetail>("/customers/" + openId),
    enabled: !!openId,
  });
  const filtered =
    customers.data?.items.filter((c) =>
      (c.name + " " + c.business + " " + c.phone)
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <>
      <PageHeading
        title="Familiar faces. Fewer questions."
        description="A useful history, with the right details kept close."
      >
        <button className="button primary" onClick={() => setNewOpen(true)}>
          <Plus size={16} />
          Add customer
        </button>
      </PageHeading>
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search customers"
            placeholder="Name, business, or phone"
          />
        </div>
        <Tag>{customers.data?.items.length || 0} customers</Tag>
      </div>
      {customers.isPending ? (
        <Loading />
      ) : customers.isError ? (
        <ErrorNote message={customers.error.message} />
      ) : filtered.length ? (
        <div className="customer-grid">
          {filtered.map((c, i) => (
            <article className="customer-card" key={c.id}>
              <span className={"avatar customer-avatar tone-" + (i % 3)}>
                {initials(c.name)}
              </span>
              <h2>{c.name}</h2>
              <p>{c.business || "Individual customer"}</p>
              <div className="customer-contact">
                {c.phone || c.email || "Contact details not added"}
              </div>
              <button className="button full" onClick={() => setOpenId(c.id)}>
                Open customer history
                <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Make room for a familiar face."
          description={
            search
              ? "No customers match your search."
              : "Add a customer directly or create one with a request."
          }
          action={
            <button className="button" onClick={() => setNewOpen(true)}>
              Add customer
            </button>
          }
        />
      )}
      <Modal
        open={!!openId}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
        title={detail.data?.name || "Customer history"}
        description={detail.data?.business || "Saved records from your shop."}
        wide
      >
        {detail.isPending ? (
          <Loading />
        ) : detail.isError ? (
          <ErrorNote message={detail.error.message} />
        ) : (
          detail.data && (
            <>
              <div className="customer-detail-toolbar">
                <p>
                  {detail.data.phone || "No phone added"}{" "}
                  {detail.data.email ? " · " + detail.data.email : ""}
                </p>
                <button
                  className="button primary"
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const request = await post<RequestRecord>(
                        "/customers/" + openId + "/repeat",
                      );
                      query.invalidateQueries({ queryKey: ["requests"] });
                      navigate("/requests/" + request.id);
                      notify(
                        "New request created. Recheck specifications, current rates and delivery.",
                      );
                    } catch (e) {
                      setError(errorMessage(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  disabled={busy}
                >
                  <RotateCcw size={15} />
                  Start repeat order
                </button>
              </div>
              {error && <ErrorNote message={error} />}
              <h3 className="subheading">Quotations</h3>
              {detail.data.quotes.length ? (
                <div className="record-table-wrap">
                  <table className="record-table">
                    <thead>
                      <tr>
                        <th>Quote</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.quotes.map((q) => (
                        <tr key={q.id}>
                          <td>
                            <Link to={"/quotes?open=" + q.id}>
                              {q.number} v{q.version}
                            </Link>
                          </td>
                          <td>{day(q.created_at)}</td>
                          <td>
                            <Tag>{label(q.status)}</Tag>
                          </td>
                          <td>{money(q.snapshot.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="quiet-empty">
                  No quotations for this customer yet.
                </p>
              )}
              <h3 className="subheading">Production jobs</h3>
              {detail.data.orders.map((o) => (
                <Link
                  className="history-link"
                  key={o.id}
                  to={"/jobs?open=" + o.id}
                >
                  <span>{o.number}</span>
                  <Tag>{label(o.stage)}</Tag>
                  <span>{money(o.balance)} balance</span>
                  <ArrowRight size={14} />
                </Link>
              ))}
              {!detail.data.orders.length && (
                <p className="quiet-empty">
                  Accepted quotes will create the production history.
                </p>
              )}
            </>
          )
        )}
      </Modal>
      <Modal
        open={newOpen}
        onOpenChange={setNewOpen}
        title="A new face at the counter."
        description="Keep only the contact details you need for this shop."
      >
        <form
          className="stacked-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post("/customers", { name, business, phone, email });
              await query.invalidateQueries({ queryKey: ["customers"] });
              setNewOpen(false);
              setName("");
              setBusiness("");
              setPhone("");
              setEmail("");
              notify("Customer added to your shop.");
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            Customer name
            <input
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            Business
            <input
              maxLength={200}
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
            />
          </label>
          <div className="field-pair">
            <label className="field">
              Phone <span className="optional">optional</span>
              <input
                type="tel"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="field">
              Email <span className="optional">optional</span>
              <input
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          </div>
          {error && <ErrorNote message={error} />}
          <div className="dialog-actions">
            <button className="button primary" disabled={busy}>
              Save customer
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
