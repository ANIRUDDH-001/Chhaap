import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Download,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { api, post, patch, errorMessage } from "../lib/api";
import type {
  RateConfig,
  Rates as RateData,
  Reports as ReportData,
  Snapshot,
} from "../lib/types";
import { blankLine } from "../lib/types";
import { RateDetails } from "../components/RateDetails";
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

export function Rates() {
  const query = useQueryClient();
  const notify = useToast();
  const rates = useQuery({
    queryKey: ["rates"],
    queryFn: () => api<RateData>("/rates"),
  });
  const [draft, setDraft] = useState<RateConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [simulation, setSimulation] = useState<Snapshot | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  useEffect(() => {
    if (rates.data && !dirty) setDraft(structuredClone(rates.data.config));
  }, [rates.data, dirty]);
  function update(recipe: (config: RateConfig) => void) {
    setDraft((current) => {
      const next = structuredClone(current!);
      recipe(next);
      return next;
    });
    setDirty(true);
    setSimulation(null);
  }
  if (rates.isPending || !draft) return <Loading />;
  if (rates.isError) return <ErrorNote message={rates.error.message} />;
  return (
    <>
      <PageHeading
        title="Your rates. In black and white."
        description="A considered price for every piece. The AI never edits this page."
      >
        <Tag tone="green">Published v{rates.data?.number}</Tag>
        <button
          className="button primary"
          disabled={!dirty}
          onClick={() => setPublishOpen(true)}
        >
          <Save size={15} />
          Publish new version
        </button>
      </PageHeading>
      {error && <ErrorNote message={error} />}
      <div className="notice">
        <ShieldCheck size={18} />
        <p>
          Editing creates a new rate-card version. Existing quotations preserve
          their original prices.{" "}
          {dirty ? (
            <b>You have unpublished changes.</b>
          ) : (
            <span>These are your currently published rates.</span>
          )}
        </p>
      </div>
      <div className="rate-layout">
        <div>
          <section className="settings-panel">
            <div className="section-heading">
              <h2>Visiting cards</h2>
              <span className="quiet-label">
                Base stock · double-sided colour
              </span>
            </div>
            <div className="record-table-wrap borderless">
              <table className="record-table rates-table">
                <thead>
                  <tr>
                    <th>Quantity from</th>
                    <th>Through</th>
                    <th>Price / piece (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.cards.tiers.map((tier, i) => (
                    <tr key={i}>
                      <td>{tier[0].toLocaleString("en-IN")}</td>
                      <td>
                        {draft.cards.tiers[i + 1]
                          ? draft.cards.tiers[i + 1][0] - 1
                          : "and above"}
                      </td>
                      <td>
                        <input
                          aria-label={"Cards price from " + tier[0]}
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier[1] / 100}
                          onChange={(e) =>
                            update((d) => {
                              d.cards.tiers[i][1] = Math.round(
                                Number(e.target.value) * 100,
                              );
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="form-help">
              The selected tier applies to every piece in that line.
            </p>
          </section>
          <section className="settings-panel">
            <h2>Flyers & banners</h2>
            <div className="field-pair">
              <label className="field">
                Flyers, A5 base (₹ / piece)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.flyers.tiers[0][1] / 100}
                  onChange={(e) =>
                    update((d) => {
                      d.flyers.tiers[0][1] = Math.round(
                        Number(e.target.value) * 100,
                      );
                    })
                  }
                />
              </label>
              <label className="field">
                Banner printing (₹ / sq ft)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.banners.per_sqft / 100}
                  onChange={(e) =>
                    update((d) => {
                      d.banners.per_sqft = Math.round(
                        Number(e.target.value) * 100,
                      );
                    })
                  }
                />
              </label>
            </div>
            <div className="compact-rates">
              {draft.flyers.tiers.map((t, index) => (
                <label className="field" key={t[0]}>
                  {t[0]}+ flyers (₹ / piece)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={t[1] / 100}
                    onChange={(e) =>
                      update((config) => {
                        config.flyers.tiers[index][1] = Math.round(
                          Number(e.target.value) * 100,
                        );
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </section>
          <section className="settings-panel">
            <h2>Finishing & shop charges</h2>
            <div className="field-pair">
              <label className="field">
                Matte finishing (₹ / piece)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.finishing.matte / 100}
                  onChange={(e) =>
                    update((d) => {
                      d.finishing.matte = Math.round(
                        Number(e.target.value) * 100,
                      );
                    })
                  }
                />
              </label>
              <label className="field">
                Gloss finishing (₹ / piece)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.finishing.gloss / 100}
                  onChange={(e) =>
                    update((d) => {
                      d.finishing.gloss = Math.round(
                        Number(e.target.value) * 100,
                      );
                    })
                  }
                />
              </label>
              <label className="field">
                Setup per quotation (₹)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.setup / 100}
                  onChange={(e) =>
                    update((d) => {
                      d.setup = Math.round(Number(e.target.value) * 100);
                    })
                  }
                />
              </label>
              <label className="field">
                Premium 400 GSM uplift (₹ / piece)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.cards.papers["400"] / 100}
                  onChange={(e) =>
                    update((d) => {
                      d.cards.papers["400"] = Math.round(
                        Number(e.target.value) * 100,
                      );
                    })
                  }
                />
              </label>
              <label className="field">
                Shop-configured tax (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={draft.tax_percent}
                  onChange={(e) =>
                    update((d) => {
                      d.tax_percent = Number(e.target.value);
                    })
                  }
                />
              </label>
              <label className="field">
                Requested deposit (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.deposit_percent}
                  onChange={(e) =>
                    update((d) => {
                      d.deposit_percent = Number(e.target.value);
                    })
                  }
                />
              </label>
            </div>
            <p className="form-help">
              Sample tax starts off. Configure your own rate when appropriate;
              Chhaap creates quotations.
            </p>
          </section>
          <RateDetails draft={draft} update={update} />
        </div>
        <aside>
          <section className="settings-panel rate-preview">
            <span className="small-heading">Check before publishing</span>
            <h2>What does the next job cost?</h2>
            <p>
              500 standard cards, 350 GSM, matte finish, colour on both sides.
            </p>
            <button
              className="button full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setSimulation(
                    await post<Snapshot>("/rates/preview", {
                      config: draft,
                      lines: [
                        { ...blankLine(), paper: "350", confirmed: true },
                      ],
                    }),
                  );
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <Sparkles size={15} />
              )}
              Calculate with these rates
            </button>
            {simulation && (
              <div className="rate-result">
                <span>Total quotation</span>
                <strong>{money(simulation.total)}</strong>
                <small>Requested deposit {money(simulation.deposit)}</small>
              </div>
            )}
            <p className="form-help">
              Calculated by the same server rules used for issued quotes.
            </p>
          </section>
          <section className="settings-panel">
            <h2>Published versions</h2>
            <div className="version-history">
              {rates.data?.history?.slice(0, 8).map((h) => (
                <div key={h.number}>
                  <span>
                    <Check size={13} />
                    Version {h.number}
                  </span>
                  <small>{day(h.created_at)}</small>
                </div>
              ))}
            </div>
          </section>
          {dirty && (
            <button
              className="button full"
              onClick={() => {
                setDirty(false);
                setDraft(structuredClone(rates.data!.config));
                setSimulation(null);
              }}
            >
              <RotateCcw size={14} />
              Discard unpublished edits
            </button>
          )}
        </aside>
      </div>
      <Modal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="A fresh rate card."
        description="New drafts use the published version. Issued quotations keep their original prices."
      >
        {error && <ErrorNote message={error} />}
        <p className="form-help">
          You’re publishing version {(rates.data?.number || 0) + 1}. Review the
          sample calculation before continuing.
        </p>
        <div className="dialog-actions">
          <button className="button" onClick={() => setPublishOpen(false)}>
            Keep editing
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await post("/rates/publish", {
                  expected_version: rates.data!.number,
                  config: draft,
                });
                setDirty(false);
                await query.invalidateQueries({ queryKey: ["rates"] });
                query.invalidateQueries({ queryKey: ["price"] });
                setPublishOpen(false);
                notify(
                  "New rate card published. Existing quote prices are unchanged.",
                );
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Publish rates
          </button>
        </div>
      </Modal>
    </>
  );
}

export function Reports() {
  const report = useQuery({
    queryKey: ["reports"],
    queryFn: () => api<ReportData>("/reports"),
  });
  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorNote message={report.error.message} />;
  const r = report.data;
  const max = Math.max(1, ...Object.values(r.stages));
  return (
    <>
      <PageHeading
        title="Know what’s moving."
        description="Clear measures from saved records, with no guesswork about what they mean."
      >
        <Tag>All saved records</Tag>
      </PageHeading>
      <div className="report-grid">
        {[
          {
            name: "Issued quotation value",
            value: r.issued_quote_value,
            note: "Potential work. This is not money received.",
          },
          {
            name: "Accepted order value",
            value: r.accepted_order_value,
            note: "Accepted work, excluding cancelled jobs.",
          },
          {
            name: "Net recorded receipts",
            value: r.received,
            note: "Receipts less refunds and reversals.",
          },
          {
            name: "Outstanding balance",
            value: r.outstanding,
            note: "Unpaid amounts on non-cancelled orders.",
          },
        ].map((s, i) => (
          <section className={"report-metric metric-" + i} key={s.name}>
            <span>{s.name}</span>
            <strong>{money(s.value)}</strong>
            <p>{s.note}</p>
          </section>
        ))}
      </div>
      <div className="report-lower">
        <section className="settings-panel">
          <h2>On the production floor</h2>
          <p>Jobs by their current stage.</p>
          {Object.keys(r.stages).length ? (
            <div className="production-bars">
              {Object.entries(r.stages).map(([stage, count]) => (
                <div key={stage}>
                  <span>{label(stage)}</span>
                  <div className="bar-track">
                    <div style={{ width: (count / max) * 100 + "%" }} />
                  </div>
                  <b>{count}</b>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="No jobs on the board yet."
              description="Accepted quotes create the production record."
            />
          )}
        </section>
        <section className="settings-panel">
          <h2>A record of the counter</h2>
          <div className="definition-row">
            <span>Requests</span>
            <b>{r.requests}</b>
          </div>
          <div className="definition-row">
            <span>Issued quotes</span>
            <b>{r.issued_quotes}</b>
          </div>
          <div className="definition-row">
            <span>Production jobs</span>
            <b>{r.orders}</b>
          </div>
          <div className="definition-row">
            <span>Customers</span>
            <b>{r.customers}</b>
          </div>
          <p className="form-help">
            No estimates of time saved, growth, or AI accuracy are inferred from
            these counts.
          </p>
        </section>
      </div>
    </>
  );
}

export function Settings({
  theme,
  setTheme,
}: {
  theme: string;
  setTheme: (theme: string) => void;
}) {
  const session = useSession();
  const notify = useToast();
  const query = useQueryClient();
  const [name, setName] = useState(session.shop.name);
  const [days, setDays] = useState(session.shop.settings.quote_validity_days);
  const [retention, setRetention] = useState(
    session.shop.settings.retention_days,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [owner, setOwner] = useState("");
  const [shop, setShop] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const model = useQuery({
    queryKey: ["model"],
    queryFn: () =>
      api<{ available: boolean; model: string; location: string }>(
        "/inference/status",
      ),
  });
  return (
    <>
      <PageHeading
        title="Make the counter yours."
        description="Your shop identity, working preferences, and a clear view of where data goes."
      />
      <div className="settings-grid">
        <section className="settings-panel">
          <h2>
            <Palette size={17} />
            Appearance
          </h2>
          <label className="setting-row">
            Workspace theme
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Paper / light</option>
              <option value="dark">After hours / dark</option>
            </select>
          </label>
          <label className="setting-row">
            Interface language<Tag>English</Tag>
          </label>
          <p>
            Customer requests and AI clarification support English, Hindi and
            Hinglish. The interface currently uses English.
          </p>
        </section>
        <section className="settings-panel">
          <h2>
            <Sparkles size={17} />
            Local AI
          </h2>
          <Tag tone={model.data?.available ? "green" : "amber"}>
            {model.data?.available ? "Model available" : "Model offline"}
          </Tag>
          <div className="definition-row">
            <span>Model</span>
            <b>{model.data?.model || "Checking…"}</b>
          </div>
          <p>
            Requests are processed by your configured local model server. There
            is no automatic hosted fallback. Manual quoting stays available when
            it is offline.
          </p>
        </section>
        <section className="settings-panel">
          <h2>
            <Save size={17} />
            Shop defaults
          </h2>
          <form
            className="stacked-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await patch("/settings", {
                  name,
                  quote_validity_days: days,
                  retention_days: retention,
                });
                query.invalidateQueries({ queryKey: ["session"] });
                notify("Shop defaults saved. Issued quote terms stay fixed.");
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Shop name
              <input
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="field-pair">
              <label className="field">
                Quote validity (days)
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Screenshot retention (days)
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={retention}
                  onChange={(e) => setRetention(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="definition-row">
              <span>Currency / timezone</span>
              <b>INR / Asia/Kolkata</b>
            </div>
            {error && <ErrorNote message={error} />}
            <button className="button" disabled={busy}>
              Save shop defaults
            </button>
          </form>
        </section>
        <section className="settings-panel">
          <h2>
            <ShieldCheck size={17} />
            Privacy & records
          </h2>
          <p>
            Screenshots are stored privately for this shop. Source text is sent
            only to the local model when you choose to extract a request. Logs
            omit customer conversations.
          </p>
          <p>
            {session.shop.mode === "sample"
              ? "This workspace uses fictional identities and sample rates. Upload test data only."
              : "This is your private workspace. Access requires the account session."}
          </p>
          <button
            className="button"
            onClick={async () => {
              try {
                const data = await api<unknown>("/export");
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "chhaap-shop-export.json";
                a.click();
                URL.revokeObjectURL(url);
                notify(
                  "Shop records exported. Screenshot files are not included.",
                );
              } catch (e) {
                notify(errorMessage(e));
              }
            }}
          >
            <Download size={15} />
            Export shop records
          </button>
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await post<{ removed_sources: number }>(
                  "/settings/cleanup",
                );
                notify(
                  `Removed ${result.removed_sources} expired source messages and screenshots. Business records are kept.`,
                );
              } catch (e) {
                notify(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Clean up expired sources
          </button>
        </section>
        <section className="settings-panel">
          <h2>
            <UserRound size={17} />
            Account & workspace
          </h2>
          <Tag tone={session.shop.mode === "sample" ? "amber" : "green"}>
            {session.shop.mode === "sample"
              ? "Fictional sample shop"
              : "Private owner account"}
          </Tag>
          <p>
            {session.shop.mode === "sample"
              ? "Try the complete workflow here. A private shop starts with a clean customer and job list."
              : "You are signed in as " +
                session.user.name +
                ". Your shop data is stored separately from other workspaces."}
          </p>
          <div className="button-row">
            {session.shop.mode === "private" && (
              <button
                className="button"
                onClick={async () => {
                  await post("/auth/logout");
                  sessionStorage.clear();
                  window.location.assign("/");
                }}
              >
                Sign out
              </button>
            )}
            <button
              className="button"
              onClick={() => {
                setAuthMode("register");
                setAuthOpen(true);
                setError("");
              }}
            >
              <LockKeyhole size={15} />
              Create private shop
            </button>
            <button
              className="button"
              onClick={() => {
                setAuthMode("login");
                setAuthOpen(true);
                setError("");
              }}
            >
              Sign in
            </button>
          </div>
          <button className="text-button" onClick={() => setResetOpen(true)}>
            <RotateCcw size={14} />
            Open a fresh sample shop
          </button>
        </section>
        <section className="settings-panel">
          <h2>
            <ExternalLink size={17} />
            Built in the open
          </h2>
          <p>
            Chhaap uses open-weight AI for interpretation and deterministic
            pricing for business decisions. Model output always needs human
            review.
          </p>
          <a
            className="text-button"
            href="https://github.com/ANIRUDDH-001/Chhaap"
            target="_blank"
            rel="noreferrer"
          >
            View source and documentation
            <ExternalLink size={14} />
          </a>
          <p className="form-help">
            Messaging integration, inventory, branches and subscription billing
            are future releases.
          </p>
        </section>
      </div>
      <Modal
        open={authOpen}
        onOpenChange={setAuthOpen}
        title={
          authMode === "register"
            ? "A private counter, just for your shop."
            : "Welcome back to the counter."
        }
        description={
          authMode === "register"
            ? "Creates a separate owner account and a clean workspace. Your sample shop is not converted."
            : "Sign in to return to your saved private workspace."
        }
      >
        <form
          className="stacked-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await post(
                "/auth/" + authMode,
                authMode === "register"
                  ? { email, password, name: owner, shop_name: shop }
                  : { email, password },
              );
              window.location.assign("/");
            } catch (e) {
              setError(errorMessage(e));
              setBusy(false);
            }
          }}
        >
          {authMode === "register" && (
            <div className="field-pair">
              <label className="field">
                Owner name
                <input
                  required
                  maxLength={100}
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                />
              </label>
              <label className="field">
                Shop name
                <input
                  required
                  maxLength={150}
                  value={shop}
                  onChange={(e) => setShop(e.target.value)}
                />
              </label>
            </div>
          )}
          <label className="field">
            Email
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              required
              minLength={authMode === "register" ? 12 : 1}
              maxLength={200}
              autoComplete={
                authMode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {authMode === "register" && (
              <span className="field-help">At least 12 characters.</span>
            )}
          </label>
          {error && <ErrorNote message={error} />}
          <div className="dialog-actions">
            <button className="button primary" disabled={busy}>
              {authMode === "register" ? "Create private shop" : "Sign in"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Start with a clean sample."
        description="Creates a separate fictional shop. Your current records stay in their existing workspace."
      >
        <p className="form-help">
          If you are in a private shop, you can return by signing in. An
          anonymous sample can’t be recovered after leaving it.
        </p>
        <div className="dialog-actions">
          <button className="button" onClick={() => setResetOpen(false)}>
            Stay here
          </button>
          <button
            className="button primary"
            onClick={async () => {
              await post("/session/demo");
              window.location.assign("/");
            }}
          >
            Open fresh sample
          </button>
        </div>
      </Modal>
    </>
  );
}
