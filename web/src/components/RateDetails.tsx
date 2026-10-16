import type { RateConfig } from "../lib/types";
export function RateDetails({
  draft,
  update,
}: {
  draft: RateConfig;
  update: (recipe: (value: RateConfig) => void) => void;
}) {
  const fields: [string, string[], number, boolean][] = [];
  for (const family of ["cards", "flyers"] as const) {
    fields.push([
      family + " minimum charge (₹)",
      [family, "minimum"],
      draft[family].minimum,
      true,
    ]);
    for (const [stock, price] of Object.entries(draft[family].papers))
      fields.push([
        family + " " + stock + " GSM uplift (₹ / piece)",
        [family, "papers", stock],
        price,
        true,
      ]);
  }
  fields.push([
    "Banner minimum charge (₹)",
    ["banners", "minimum"],
    draft.banners.minimum,
    true,
  ]);
  for (const [size, factor] of Object.entries(draft.flyers.sizes))
    fields.push([
      size + " flyer size multiplier",
      ["flyers", "sizes", size],
      Number(factor),
      false,
    ]);
  for (const [key, factor] of Object.entries(draft.print_multipliers))
    fields.push([
      key + " print multiplier",
      ["print_multipliers", key],
      Number(factor),
      false,
    ]);
  return (
    <details className="settings-panel">
      <summary>Stock, minimum charges & print multipliers</summary>
      <p className="form-help">
        These published values also feed every deterministic quotation.
      </p>
      <div className="field-pair">
        {fields.map(([label, path, value, money]) => (
          <label className="field" key={path.join(".")}>
            {label}
            <input
              type="number"
              min={money ? "0" : "0.01"}
              step="0.01"
              value={money ? value / 100 : value}
              onChange={(e) =>
                update((config) => {
                  let holder = config as unknown as Record<string, unknown>;
                  for (const key of path.slice(0, -1))
                    holder = holder[key] as Record<string, unknown>;
                  holder[path[path.length - 1]] = money
                    ? Math.round(Number(e.target.value) * 100)
                    : e.target.value;
                })
              }
            />
          </label>
        ))}
      </div>
    </details>
  );
}
