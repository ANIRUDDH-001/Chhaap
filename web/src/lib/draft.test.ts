import { describe, it, expect } from "vitest";
import { issueBlockers, reconcileSavedDraft, pendingDraft } from "./draft";
import { blankLine } from "./types";

describe("issuing a reviewed draft", () => {
  const line = {
    product: "cards",
    quantity: 500,
    paper: "350",
    confirmed: true,
    size: "standard",
    sides: "double",
    colour: "colour",
    finish: "matte",
    unit: "ft",
  };
  it("requires a real quantity, supported paper, date and review", () => {
    expect(
      issueBlockers({
        lines: [{ ...line, quantity: null, paper: null, confirmed: false }],
        delivery_date: null,
        delivery_confirmed: false,
      }),
    ).toContain("Enter a whole quantity for item 1.");
    expect(
      issueBlockers({
        lines: [line],
        delivery_date: "2026-10-19",
        delivery_confirmed: false,
      }),
    ).toContain("Confirm the delivery date with the customer.");
    expect(
      issueBlockers({
        lines: [line],
        delivery_date: "2026-10-19",
        delivery_confirmed: true,
      }),
    ).toEqual([]);
  });
  it("does not allow a custom price with no owner reason", () => {
    expect(
      issueBlockers({
        lines: [
          {
            ...line,
            product: "manual",
            manual_price: 120000,
            manual_reason: "",
          },
        ],
        delivery_date: "2026-10-19",
        delivery_confirmed: true,
      }),
    ).toContain("Add an owner price and reason for item 1.");
  });
});

it("preserves typing that happens while an earlier autosave is in flight", () => {
  const sent = { revision: 4, quantity: 500 };
  const latest = { revision: 4, quantity: 1000 };
  const saved = { revision: 5, quantity: 500 };
  const result = reconcileSavedDraft(latest, sent, saved);
  expect(result.draft).toEqual({ revision: 5, quantity: 1000 });
  expect(result.dirty).toBe(true);
});

it("keeps editable draft fields for navigation recovery without caching raw conversations", () => {
  const draft = {
    revision: 4,
    title: "Cards",
    lines: [blankLine()],
    adjustments: {},
    delivery_date: null,
    delivery_confirmed: false,
    notes: "Owner note",
    sources: [{ text: "PRIVATE MESSAGE" }],
    extraction: { reply: "PRIVATE OUTPUT" },
  };
  const recovered = pendingDraft(draft);
  expect(recovered.lines).toEqual(draft.lines);
  expect(recovered.revision).toBe(4);
  expect(JSON.stringify(recovered)).not.toContain("PRIVATE");
});
