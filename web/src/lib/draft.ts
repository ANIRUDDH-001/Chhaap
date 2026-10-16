type ReviewDraft = {
  lines: {
    product: string;
    quantity: number | null;
    paper?: string | null;
    confirmed?: boolean;
    manual_price?: number | null;
    manual_reason?: string;
    width?: number | null;
    height?: number | null;
  }[];
  delivery_date: string | null;
  delivery_confirmed: boolean;
};
type EditableDraft = ReviewDraft & {
  revision: number;
  title: string;
  notes: string;
  adjustments: object;
};
export function pendingDraft(draft: EditableDraft) {
  const {
    revision,
    title,
    notes,
    adjustments,
    lines,
    delivery_date,
    delivery_confirmed,
  } = draft;
  return {
    revision,
    title,
    notes,
    adjustments,
    lines,
    delivery_date,
    delivery_confirmed,
  };
}
export function reconcileSavedDraft<T extends { revision: number }>(
  current: T,
  sent: T,
  saved: T,
): { draft: T; dirty: boolean } {
  return current === sent
    ? { draft: saved, dirty: false }
    : { draft: { ...current, revision: saved.revision }, dirty: true };
}
export function issueBlockers(draft: ReviewDraft) {
  const issues: string[] = [];
  if (!draft.lines.length) issues.push("Add at least one print job.");
  draft.lines.forEach((line, i) => {
    if (!Number.isInteger(line.quantity) || !line.quantity || line.quantity < 1)
      issues.push(`Enter a whole quantity for item ${i + 1}.`);
    if (["cards", "flyers"].includes(line.product) && !line.paper)
      issues.push(`Confirm the paper for item ${i + 1}.`);
    if (line.product === "banners" && (!line.width || !line.height))
      issues.push(`Enter the banner dimensions for item ${i + 1}.`);
    if (
      line.product === "manual" &&
      (line.manual_price == null || !line.manual_reason?.trim())
    )
      issues.push(`Add an owner price and reason for item ${i + 1}.`);
    if (!line.confirmed) issues.push(`Review and confirm item ${i + 1}.`);
  });
  if (!draft.delivery_date) issues.push("Choose a delivery date.");
  if (!draft.delivery_confirmed)
    issues.push("Confirm the delivery date with the customer.");
  return issues;
}
