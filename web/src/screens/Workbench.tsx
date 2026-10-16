import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  Copy,
  FileText,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  ScanText,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { api, post, patch, key, errorMessage } from "../lib/api";
import { issueBlockers, reconcileSavedDraft, pendingDraft } from "../lib/draft";
import { initials } from "../lib/format";
import { blankLine } from "../lib/types";
import type { RequestRecord, LineSpec, Snapshot, Quote } from "../lib/types";
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
import { QuoteAdjustments } from "../components/QuoteAdjustments";
import { SourceOrder } from "../components/SourceOrder";

export function Workbench({ onNew }: { onNew: () => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSession();
  const query = useQueryClient();
  const notify = useToast();
  const record = useQuery({
    queryKey: ["request", id],
    queryFn: () => api<RequestRecord>("/requests/" + id),
    refetchInterval: (q) =>
      q.state.data?.job &&
      ["queued", "running"].includes(q.state.data.job.status)
        ? 2000
        : false,
  });
  const [draft, setDraft] = useState<RequestRecord | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sourceTab, setSourceTab] = useState("messages");
  const [mobileStep, setMobileStep] = useState("request");
  const [appendOpen, setAppendOpen] = useState(false);
  const [appendText, setAppendText] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [savedLabel, setSavedLabel] = useState("Saved to your shop");
  const [highlight, setHighlight] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const issueKey = useRef(key());
  const initialized = useRef(false);
  const recoveryKey = `chhaap-draft:${session.shop.id}:${id}`;
  useEffect(() => {
    if (record.data && !dirty && !saving) {
      if (!initialized.current) {
        initialized.current = true;
        try {
          const cached = sessionStorage.getItem(recoveryKey);
          if (cached) {
            setDraft({ ...record.data, ...JSON.parse(cached) });
            setDirty(true);
            setSavedLabel("Recovered unsaved edits");
            return;
          }
        } catch {
          /* A restricted browser can still use server autosave. */
        }
      }
      setDraft(record.data);
    }
  }, [record.data, dirty, saving]);
  const current = draft;
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const saveInFlight = useRef(false);
  const preview = useQuery({
    queryKey: ["price", current?.lines, current?.adjustments],
    queryFn: () =>
      post<Snapshot>("/quotes/preview", {
        lines: current!.lines,
        adjustments: current!.adjustments,
      }),
    enabled:
      !!current &&
      current.lines.every(
        (l) => Number.isInteger(l.quantity) && Number(l.quantity) > 0,
      ),
    retry: false,
  });
  const model = useQuery({
    queryKey: ["model"],
    queryFn: () =>
      api<{ available: boolean; model: string }>("/inference/status"),
    staleTime: 60000,
  });
  function edit(change: Partial<RequestRecord>) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d, ...change };
      try {
        sessionStorage.setItem(recoveryKey, JSON.stringify(pendingDraft(next)));
      } catch {
        /* Autosave stays available. */
      }
      return next;
    });
    setDirty(true);
    setSavedLabel("Unsaved changes");
    setError("");
  }
  function editLine(index: number, change: Partial<LineSpec>) {
    if (current)
      edit({
        lines: current.lines.map((l, i) =>
          i === index
            ? { ...l, ...change, confirmed: change.confirmed ?? false }
            : l,
        ),
      });
  }
  async function save(): Promise<RequestRecord | null> {
    if (!current || saveInFlight.current) return null;
    if (!dirty) return current;
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await patch<RequestRecord>("/requests/" + id, {
        expected_revision: current.revision,
        title: current.title,
        lines: current.lines,
        delivery_date: current.delivery_date || null,
        delivery_confirmed: current.delivery_confirmed,
        notes: current.notes,
        adjustments: current.adjustments,
      });
      const result = reconcileSavedDraft(
        latestDraft.current || current,
        current,
        updated,
      );
      latestDraft.current = result.draft;
      setDraft(result.draft);
      setDirty(result.dirty);
      try {
        if (result.dirty)
          sessionStorage.setItem(
            recoveryKey,
            JSON.stringify(pendingDraft(result.draft)),
          );
        else sessionStorage.removeItem(recoveryKey);
      } catch {
        /* The saved server record is authoritative. */
      }
      setSavedLabel(
        result.dirty ? "New edits waiting to save" : "Saved to your shop",
      );
      query.setQueryData(["request", id], updated);
      query.invalidateQueries({ queryKey: ["requests"] });
      return result.dirty ? null : updated;
    } catch (e) {
      setError(errorMessage(e));
      setSavedLabel("Not saved — your edits are still here");
      return null;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!dirty || saving || !current || current.lines.some((l) => !l.quantity))
      return;
    const timer = setTimeout(() => {
      void save();
    }, 1400);
    return () => clearTimeout(timer);
  }, [draft, dirty, saving]); // A newer edit cancels the pending save.
  async function action(name: string, work: () => Promise<void>) {
    setBusy(name);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy("");
    }
  }
  async function extract() {
    await action("extract", async () => {
      const saved = await save();
      if (!saved) return;
      await post("/requests/" + id + "/extract", {
        expected_revision: saved.revision,
      });
      await record.refetch();
      notify("Queued for the local model. You can keep reviewing manually.");
    });
  }
  async function upload(file: File) {
    await action("upload", async () => {
      const saved = await save();
      if (!saved) return;
      const form = new FormData();
      form.append("file", file);
      const updated = await api<RequestRecord>(
        "/requests/" + id + "/attachments",
        { method: "POST", body: form },
      );
      setDraft(updated);
      setDirty(false);
      query.setQueryData(["request", id], updated);
      setSourceTab("screenshots");
      notify("Screenshot saved privately. Extract it or review it yourself.");
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied. No message was sent.");
    } catch {
      notify("Clipboard unavailable. Select and copy the text.");
    }
  }
  if (record.isPending || (!current && !record.isError))
    return <Loading text="Opening the job jacket…" />;
  if (record.isError)
    return (
      <ErrorNote
        message={record.error.message}
        retry={() => record.refetch()}
      />
    );
  if (!current)
    return (
      <Empty
        title="Request unavailable"
        description="Choose a request from your shop."
      />
    );
  const blockers = issueBlockers(current);
  const extraction = current.extraction;
  const job = record.data?.job;
  const processing = job && ["queued", "running"].includes(job.status);
  const reply =
    extraction?.reply ||
    "Please confirm the paper stock and the delivery date. We’ll share the final quotation once the job details are checked.";
  return (
    <>
      <PageHeading
        title="A little clarity. A better quote."
        description="Everything you need to turn a conversation into a print job."
      >
        <Link className="button ghost" to="/requests">
          <ArrowLeft size={15} />
          All requests
        </Link>
        <button className="button primary" onClick={onNew}>
          <Plus size={16} />
          New request
        </button>
      </PageHeading>
      {error && (
        <ErrorNote
          message={error}
          retry={() => {
            sessionStorage.removeItem(recoveryKey);
            setDirty(false);
            record.refetch();
          }}
        />
      )}
      <div className="workspace-header">
        <div className="customer-identity">
          <span className="avatar lilac">
            {initials(current.customer?.name || "Walk in")}
          </span>
          <strong>
            {current.customer?.name || "Walk-in customer"}
            <small>{current.customer?.business}</small>
          </strong>
          <Tag tone={blockers.length ? "amber" : "green"}>
            {blockers.length ? "Needs review" : "Ready to quote"}
          </Tag>
        </div>
        <div className="workflow-trail">
          <span>
            <Check size={12} />
            Request received
          </span>
          <b>Review details</b>
          <span>Issue quote</span>
        </div>
      </div>
      <div className="mobile-steps" aria-label="Workspace steps">
        {["request", "details", "quote"].map((s, i) => (
          <button
            key={s}
            className={mobileStep === s ? "selected" : ""}
            onClick={() => setMobileStep(s)}
          >
            <span>{i + 1}</span>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      <div className="workbench" data-mobile-step={mobileStep}>
        <section className="work-pane source-pane">
          <div className="pane-heading">
            <h2>The conversation</h2>
            <span>{current.sources.length} sources</span>
          </div>
          <div className="segmented">
            <button
              className={sourceTab === "messages" ? "selected" : ""}
              onClick={() => setSourceTab("messages")}
            >
              Messages
            </button>
            <button
              className={sourceTab === "screenshots" ? "selected" : ""}
              onClick={() => setSourceTab("screenshots")}
            >
              Screenshots{" "}
              <span>
                {current.sources.filter((s) => s.kind === "image").length || ""}
              </span>
            </button>
          </div>
          <div className="source-content">
            {sourceTab === "messages" ? (
              <>
                {current.sources.filter((s) => s.kind === "text").length ? (
                  <div className="chat-date">
                    Customer conversation ·{" "}
                    {session.shop.mode === "sample"
                      ? "fictional sample"
                      : "private"}
                  </div>
                ) : (
                  <p className="form-help">
                    No messages yet. Paste the customer’s request below.
                  </p>
                )}
                {current.sources
                  .filter((s) => s.kind === "text")
                  .map((s) => (
                    <div
                      className={
                        "chat-bubble " +
                        (s.sender === "Aman" ? "own " : "") +
                        (highlight === s.id ? "evidence-highlight" : "")
                      }
                      key={s.id}
                    >
                      <small>{s.sender}</small>
                      <p>{s.text}</p>
                    </div>
                  ))}
              </>
            ) : (
              <>
                {current.sources
                  .filter((s) => s.kind === "image")
                  .map((s) => (
                    <a
                      className="source-image"
                      href={s.url!}
                      target="_blank"
                      rel="noreferrer"
                      key={s.id}
                    >
                      <img
                        src={s.url!}
                        alt="Uploaded customer conversation screenshot"
                      />
                      <span>Open original for review</span>
                    </a>
                  ))}
                {!current.sources.some((s) => s.kind === "image") && (
                  <div className="screenshot-empty">
                    <ImagePlus size={30} />
                    <p>Add a chat screenshot</p>
                    <small>JPEG, PNG or WebP · up to 10 MB</small>
                    <button
                      className="button"
                      onClick={() => fileInput.current?.click()}
                    >
                      Choose screenshot
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="source-actions">
            <SourceOrder
              record={current}
              onSave={async (ids) => {
                const saved = await save();
                if (!saved)
                  throw new Error(
                    "Save the draft before changing source order.",
                  );
                const updated = await patch<RequestRecord>(
                  "/requests/" + id + "/source-order",
                  { expected_revision: saved.revision, source_ids: ids },
                );
                setDraft(updated);
                setDirty(false);
                query.setQueryData(["request", id], updated);
                notify("Source order saved. Review the specifications again.");
              }}
            />
            <button
              className="button small"
              onClick={() => setAppendOpen(true)}
            >
              <MessageSquareText size={14} />
              Add messages
            </button>
            <button
              className="button small"
              disabled={busy === "upload"}
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={14} />
              {busy === "upload" ? "Uploading…" : "Add image"}
            </button>
            <input
              className="sr-only"
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
              aria-label="Upload screenshot"
            />
          </div>
          <div className="source-privacy">
            <LockKeyhole size={13} />
            <span>
              {session.shop.mode === "sample"
                ? "Fictional sample. Upload only test screenshots here."
                : "Stored privately for your shop."}
            </span>
          </div>
          <div className="reply-box">
            <div className="reply-label">
              <span>
                <Sparkles size={13} />
                Clarification draft
              </span>
              <span>{extraction?.language || "English"}</span>
            </div>
            <textarea
              aria-label="Clarification draft"
              key={reply}
              defaultValue={reply}
              id="clarification-reply"
            />
            <div className="reply-bottom">
              <button
                className="button small ghost"
                onClick={() =>
                  copy(
                    (
                      document.getElementById(
                        "clarification-reply",
                      ) as HTMLTextAreaElement
                    ).value,
                  )
                }
              >
                <Copy size={13} />
                Copy reply
              </button>
            </div>
          </div>
          <button
            className="mobile-next button"
            onClick={() => setMobileStep("details")}
          >
            Review details
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="work-pane details-pane">
          <div className="pane-heading">
            <h2>The job, understood</h2>
            <Tag tone="green">
              {extraction ? "AI suggestions" : "Owner review"}
            </Tag>
          </div>
          <div className="extract-action">
            <button
              className="button extract-button"
              disabled={!!processing || !!busy}
              onClick={extract}
            >
              {processing ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ScanText size={16} />
              )}{" "}
              {processing
                ? job?.status === "queued"
                  ? "Waiting for local model…"
                  : "Reading the request…"
                : "Extract with local AI"}
            </button>
            <span>
              {model.data?.available
                ? model.data.model + " · local"
                : model.isPending
                  ? "Checking local model…"
                  : "Model offline · manual entry works"}
            </span>
          </div>
          {job?.status === "failed" && (
            <div className="warning-note">
              <TriangleAlert size={15} />
              <span>
                {job.error}
                <button className="text-button" onClick={extract}>
                  Retry extraction
                </button>
              </span>
            </div>
          )}
          {job?.status === "stale" && (
            <div className="warning-note">
              <RefreshCw size={15} />
              <span>
                The draft changed during extraction. Run it again for the latest
                version.
              </span>
            </div>
          )}
          {extraction && (
            <div className="extraction-review">
              <div>
                <strong>Suggestions ready for your review</strong>
                <small>
                  {extraction.model}{" "}
                  {extraction.duration_seconds
                    ? "· " + extraction.duration_seconds + " s"
                    : ""}
                </small>
              </div>
              <button
                className="button small"
                onClick={() => {
                  edit({
                    lines: extraction.lines.length
                      ? extraction.lines.map((l) => ({
                          ...blankLine(),
                          ...l,
                          confirmed: false,
                        }))
                      : current.lines,
                  });
                  notify(
                    "Suggestions applied. Check every field against the source.",
                  );
                }}
                disabled={!extraction.lines.length}
              >
                Apply suggestions
              </button>
              {[...extraction.conflicts, ...extraction.missing].length > 0 && (
                <ul>
                  {[...extraction.conflicts, ...extraction.missing]
                    .slice(0, 6)
                    .map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                </ul>
              )}
            </div>
          )}
          {current.lines.map((line, index) => (
            <section className="line-editor" key={index}>
              <div className="line-heading">
                <strong>
                  {index + 1}.{" "}
                  {line.product === "cards"
                    ? "Visiting cards"
                    : line.product === "flyers"
                      ? "Flyers"
                      : line.product === "banners"
                        ? "Banner"
                        : "Custom print job"}
                </strong>
                {current.lines.length > 1 && (
                  <button
                    className="icon-button small"
                    aria-label={"Remove item " + (index + 1)}
                    onClick={() =>
                      edit({
                        lines: current.lines.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="field-grid">
                <label className="field full">
                  Product
                  <select
                    value={line.product}
                    onChange={(e) =>
                      editLine(index, {
                        product: e.target.value,
                        paper: null,
                        size: e.target.value === "flyers" ? "A5" : "standard",
                        finish: e.target.value === "banners" ? "none" : "matte",
                      })
                    }
                  >
                    <option value="cards">Visiting cards</option>
                    <option value="flyers">Flyers</option>
                    <option value="banners">Banner</option>
                    <option value="manual">Custom job · owner price</option>
                  </select>
                </label>
                <label className="field">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={line.quantity ?? ""}
                    onChange={(e) =>
                      editLine(index, {
                        quantity: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </label>
                {["cards", "flyers"].includes(line.product) && (
                  <>
                    <label className="field">
                      Size
                      <select
                        value={line.size}
                        onChange={(e) =>
                          editLine(index, { size: e.target.value })
                        }
                      >
                        {(line.product === "cards"
                          ? ["standard"]
                          : ["A4", "A5", "A6"]
                        ).map((v) => (
                          <option value={v} key={v}>
                            {v === "standard" ? "89 × 51 mm" : v}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Print sides
                      <select
                        value={line.sides}
                        onChange={(e) =>
                          editLine(index, { sides: e.target.value })
                        }
                      >
                        <option value="double">Both sides</option>
                        <option value="single">One side</option>
                      </select>
                    </label>
                    <label className="field">
                      Colour
                      <select
                        value={line.colour}
                        onChange={(e) =>
                          editLine(index, { colour: e.target.value })
                        }
                      >
                        <option value="colour">Full colour</option>
                        <option value="mono">Black & white</option>
                      </select>
                    </label>
                    <label className="field full">
                      Paper stock{" "}
                      {!line.paper && <Tag tone="amber">Confirm</Tag>}
                      <select
                        value={line.paper || ""}
                        onChange={(e) =>
                          editLine(index, { paper: e.target.value || null })
                        }
                      >
                        <option value="">Select paper stock</option>
                        {(line.product === "cards"
                          ? ["350", "400"]
                          : ["130", "170"]
                        ).map((p) => (
                          <option value={p} key={p}>
                            {p} GSM {p === "400" ? "· premium" : ""}
                          </option>
                        ))}
                      </select>
                      {!line.paper && (
                        <span className="field-help">
                          Estimate uses the base stock until you confirm.
                        </span>
                      )}
                    </label>
                    <label className="field full">
                      Finishing
                      <select
                        value={line.finish}
                        onChange={(e) =>
                          editLine(index, { finish: e.target.value })
                        }
                      >
                        <option value="matte">Matte finish</option>
                        <option value="gloss">Gloss finish</option>
                        <option value="none">No finishing</option>
                      </select>
                    </label>
                  </>
                )}
                {line.product === "banners" && (
                  <>
                    <label className="field">
                      Dimension unit
                      <select
                        value={line.unit}
                        onChange={(e) =>
                          editLine(index, { unit: e.target.value })
                        }
                      >
                        {["ft", "in", "mm", "cm"].map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Width
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.width ?? ""}
                        onChange={(e) =>
                          editLine(index, {
                            width: Number(e.target.value) || null,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      Height
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={line.height ?? ""}
                        onChange={(e) =>
                          editLine(index, {
                            height: Number(e.target.value) || null,
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {line.product === "manual" && (
                  <>
                    <label className="field full">
                      Job description
                      <input
                        value={line.description || ""}
                        onChange={(e) =>
                          editLine(index, { description: e.target.value })
                        }
                      />
                    </label>
                    <label className="field full">
                      Owner price (₹ for the complete line)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          line.manual_price == null
                            ? ""
                            : line.manual_price / 100
                        }
                        onChange={(e) =>
                          editLine(index, {
                            manual_price: e.target.value
                              ? Math.round(Number(e.target.value) * 100)
                              : null,
                          })
                        }
                      />
                    </label>
                    <label className="field full">
                      Price reason
                      <input
                        value={line.manual_reason || ""}
                        onChange={(e) =>
                          editLine(index, { manual_reason: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              {extraction?.evidence.filter((e) => e.line === index).length ? (
                <div className="evidence-list">
                  {extraction.evidence
                    .filter((e) => e.line === index)
                    .slice(0, 5)
                    .map((e, i) => (
                      <button
                        key={i}
                        className="evidence-link"
                        onClick={() => {
                          setSourceTab(
                            e.source_kind === "image"
                              ? "screenshots"
                              : "messages",
                          );
                          setHighlight(e.source_id);
                          setMobileStep("request");
                          setTimeout(() => setHighlight(""), 3000);
                        }}
                      >
                        <Check size={11} />
                        {e.field}: “{e.quote}”{" "}
                        <span>
                          {e.verified ? "Source matched" : "Review original"}
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={line.confirmed}
                  onChange={(e) =>
                    editLine(index, { confirmed: e.target.checked })
                  }
                />
                <span>I’ve checked and confirmed these specifications.</span>
              </label>
            </section>
          ))}
          <button
            className="text-button add-item"
            onClick={() => edit({ lines: [...current.lines, blankLine()] })}
            disabled={current.lines.length >= 30}
          >
            <Plus size={14} />
            Add another item
          </button>
          <QuoteAdjustments
            value={current.adjustments || {}}
            onChange={(adjustments) => edit({ adjustments })}
          />
          <div className="delivery-section">
            <label className="field">
              Requested delivery date
              <input
                type="date"
                value={current.delivery_date || ""}
                onChange={(e) =>
                  edit({
                    delivery_date: e.target.value || null,
                    delivery_confirmed: false,
                  })
                }
              />
              {extraction?.delivery_text && (
                <span className="field-help">
                  Customer said “{extraction.delivery_text}” — confirm the
                  calendar date.
                </span>
              )}
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={current.delivery_confirmed}
                onChange={(e) => edit({ delivery_confirmed: e.target.checked })}
              />
              <span>The customer and I have confirmed this date.</span>
            </label>
          </div>
          <div className="save-state">
            <span>
              {saving ? (
                <LoaderCircle className="spin" size={13} />
              ) : dirty ? (
                <Save size={13} />
              ) : (
                <CheckCheck size={13} />
              )}{" "}
              {saving ? "Saving…" : savedLabel}
            </span>
            <button
              className="text-button"
              onClick={() => void save()}
              disabled={!dirty || saving}
            >
              Save now
            </button>
          </div>
          <button
            className="mobile-next button"
            onClick={() => setMobileStep("quote")}
          >
            Preview quotation
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="work-pane quote-pane">
          <div className="pane-heading">
            <h2>A quote worth sending</h2>
            <Tag tone={blockers.length ? "neutral" : "green"}>
              {blockers.length ? "Estimate" : "Reviewed draft"}
            </Tag>
          </div>
          {preview.isError && <ErrorNote message={preview.error.message} />}
          <QuotePaper
            snapshot={preview.data || null}
            shopName={session.shop.name}
            customer={current.customer}
            deliveryDate={
              current.delivery_confirmed ? current.delivery_date : null
            }
          />
          <div className="issue-action">
            <button
              className="button primary"
              disabled={
                !!blockers.length || !preview.data?.ready || !!busy || saving
              }
              onClick={() => setIssueOpen(true)}
            >
              <FileText size={16} />
              Review & issue quotation
              <ArrowRight size={16} />
            </button>
            <p>
              {blockers[0] ||
                "One last review before this price becomes an issued quote."}
            </p>
          </div>
          <div className="quote-reassurance">
            <LockKeyhole size={13} />
            <p>
              Calculated from your shop’s rate card.
              <br />
              AI never chooses the price.
            </p>
          </div>
        </section>
      </div>
      <div className="workspace-footnote">
        <span>
          <CheckCheck size={14} />
          AI suggests. You confirm. Your rates decide.
        </span>
        <span>Nothing is sent to the customer automatically.</span>
      </div>
      <Modal
        open={appendOpen}
        onOpenChange={setAppendOpen}
        title="Add the next part of the conversation."
        description="New messages reset confirmations so changed specifications get reviewed."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action("append", async () => {
              const saved = await save();
              if (!saved) return;
              const updated = await post<RequestRecord>(
                "/requests/" + id + "/sources",
                {
                  expected_revision: saved.revision,
                  text: appendText,
                  sender: current.customer?.name || "Customer",
                },
              );
              setDraft(updated);
              setDirty(false);
              query.setQueryData(["request", id], updated);
              setAppendOpen(false);
              setAppendText("");
              notify("Messages added. Recheck the job details before quoting.");
            });
          }}
        >
          <label className="field">
            New customer messages
            <textarea
              required
              rows={6}
              maxLength={20000}
              value={appendText}
              onChange={(e) => setAppendText(e.target.value)}
            />
          </label>
          <div className="dialog-actions">
            <button className="button primary" disabled={!!busy}>
              Save messages
            </button>
          </div>
        </form>
      </Modal>
      <Modal
        open={issueOpen}
        onOpenChange={setIssueOpen}
        title="Make it official."
        description="Issuing saves a fixed price and terms. You’ll share it with the customer yourself."
      >
        <div className="issue-summary">
          <span>{current.customer?.name}</span>
          <strong>
            {preview.data
              ? new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 2,
                }).format(preview.data.total / 100)
              : "—"}
          </strong>
          <p>
            {current.lines.length} item{current.lines.length > 1 ? "s" : ""} ·
            Rate card {preview.data?.rate_version}
          </p>
        </div>
        <p className="form-help">
          Customer acceptance is recorded separately. Later rate changes won’t
          alter this quotation.
        </p>
        {error && <ErrorNote message={error} />}
        <div className="dialog-actions">
          <button className="button" onClick={() => setIssueOpen(false)}>
            Keep reviewing
          </button>
          <button
            className="button primary"
            disabled={!!busy || saving}
            onClick={() =>
              void action("issue", async () => {
                const saved = await save();
                if (!saved) return;
                const quote = await post<Quote>("/quotes/issue", {
                  request_id: id,
                  expected_revision: saved.revision,
                  idempotency_key: issueKey.current,
                  revises_quote_id: params.get("revises") || null,
                });
                issueKey.current = key();
                setIssueOpen(false);
                query.invalidateQueries({ queryKey: ["quotes"] });
                query.invalidateQueries({ queryKey: ["reports"] });
                notify(quote.number + " issued. No message was sent.");
                navigate("/quotes?open=" + quote.id);
              })
            }
          >
            {busy === "issue" ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <FileText size={15} />
            )}
            Issue quotation
          </button>
        </div>
      </Modal>
    </>
  );
}
