import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Customer } from "../lib/types";
import { patch, post, errorMessage } from "../lib/api";
import { useRecords, MoreRecords } from "../lib/records";
import { Modal, ErrorNote, useToast } from "./ui";

export function CustomerActions({
  customer,
  onMerged,
}: {
  customer: Customer;
  onMerged: () => void;
}) {
  const query = useQueryClient();
  const notify = useToast();
  const [mode, setMode] = useState("");
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choices = useRecords<Customer>("customers", search);
  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (mode === "edit")
        await patch("/customers/" + customer.id, {
          name,
          business,
          phone,
          email,
          expected_revision: customer.revision,
        });
      else {
        if (!target) throw new Error("Choose the customer record to keep.");
        await post("/customers/merge", {
          source_id: customer.id,
          target_id: target.id,
        });
      }
      query.invalidateQueries({ queryKey: ["customers"] });
      query.invalidateQueries({ queryKey: ["customer"] });
      query.invalidateQueries({ queryKey: ["requests"] });
      query.invalidateQueries({ queryKey: ["quotes"] });
      query.invalidateQueries({ queryKey: ["orders"] });
      setMode("");
      notify(
        mode === "edit"
          ? "Customer details saved. Issued quotes keep their original details."
          : "Duplicate merged. Existing business records are kept.",
      );
      if (mode === "merge") onMerged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="button-row">
        <button
          className="button"
          onClick={() => {
            setName(customer.name);
            setBusiness(customer.business);
            setPhone(customer.phone);
            setEmail(customer.email);
            setError("");
            setMode("edit");
          }}
        >
          Edit customer
        </button>
        <button
          className="text-button"
          onClick={() => {
            setTarget(null);
            setError("");
            setMode("merge");
          }}
        >
          Merge duplicate
        </button>
      </div>
      <Modal
        open={!!mode}
        onOpenChange={(open) => {
          if (!open) setMode("");
        }}
        title={
          mode === "edit"
            ? "Keep the details current."
            : "Bring duplicate history together."
        }
        description={
          mode === "edit"
            ? "Issued quotations preserve their original recipient."
            : "Move this customer’s history into the record you choose to keep. This removes the duplicate contact record."
        }
      >
        {mode === "edit" ? (
          <form
            className="stacked-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
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
                Phone
                <input
                  type="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="field">
                Email
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
                Save customer details
              </button>
            </div>
          </form>
        ) : (
          <div className="stacked-form">
            <label className="field">
              Find the record to keep
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, business or phone"
              />
            </label>
            <div className="merge-choices">
              {choices.data?.items
                .filter((c) => c.id !== customer.id)
                .map((c) => (
                  <button
                    key={c.id}
                    className={
                      "button " + (target?.id === c.id ? "primary" : "")
                    }
                    onClick={() => setTarget(c)}
                  >
                    {c.name} {c.business && "· " + c.business}
                  </button>
                ))}
            </div>
            <MoreRecords list={choices} />
            {target && (
              <p>
                Merge <strong>{customer.name}</strong> into{" "}
                <strong>{target.name}</strong>. Quotes and payments keep their
                saved history.
              </p>
            )}
            {error && <ErrorNote message={error} />}
            <div className="dialog-actions">
              <button
                className="button primary"
                disabled={busy || !target}
                onClick={() => void submit()}
              >
                Confirm merge
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
