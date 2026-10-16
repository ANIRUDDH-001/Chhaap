import type { QuoteAdjustments as Values } from "../lib/types";
export function QuoteAdjustments({
  value,
  onChange,
}: {
  value: Values;
  onChange: (value: Values) => void;
}) {
  return (
    <details className="quote-adjustments">
      <summary>
        Shop charges & discount<span>optional</span>
      </summary>
      <p className="field-help">
        Amounts apply to the complete quotation. Tax and deposit use the
        published shop defaults.
      </p>
      <div className="field-pair">
        {(
          [
            ["rush", "Rush charge"],
            ["delivery", "Delivery"],
            ["design", "Design work"],
            ["discount", "Discount"],
          ] as const
        ).map(([field, name]) => (
          <label className="field" key={field}>
            {name} (₹)
            <input
              type="number"
              min="0"
              max="100000"
              step="0.01"
              value={(value[field] || 0) / 100}
              onChange={(e) =>
                onChange({
                  ...value,
                  [field]: Math.round(Number(e.target.value) * 100),
                })
              }
            />
          </label>
        ))}
      </div>
      <label className="field">
        Owner reason
        <input
          value={value.reason || ""}
          maxLength={500}
          onChange={(e) => onChange({ ...value, reason: e.target.value })}
          placeholder="e.g. Local delivery requested"
        />
      </label>
    </details>
  );
}
