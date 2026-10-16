import { expect, it } from "vitest";
import { blankLine } from "./types";
import { describePrintSpec, quotationText } from "./print-spec";

it("gives the printer actual banner dimensions and card print choices", () => {
  expect(
    describePrintSpec({
      ...blankLine(),
      product: "banners",
      quantity: 2,
      width: 2,
      height: 3,
      unit: "ft",
    }),
  ).toContain("2 × 3 ft each");
  const cards = describePrintSpec({
    ...blankLine(),
    paper: "350",
    sides: "single",
    colour: "mono",
    finish: "gloss",
  });
  expect(cards).toContain("350 GSM");
  expect(cards).toContain("single-sided");
  expect(cards).toContain("black & white");
  expect(cards).toContain("gloss finish");
});

it("copies the frozen shop and customer identity with complete specifications", () => {
  const quote = {
    number: "CH-001",
    version: 1,
    snapshot: {
      shop_name: "Original Shop",
      customer: { name: "Original Customer", business: "Original Studio" },
      lines: [
        {
          title: "Banner",
          spec: {
            ...blankLine(),
            product: "banners",
            width: 2,
            height: 3,
            unit: "ft",
          },
        },
      ],
      total: 150000,
      deposit: 75000,
    },
    delivery_date: "2026-10-19",
    expires_at: "2026-10-23T12:00:00Z",
    terms: "Artwork approval required",
  };
  const text = quotationText(quote, "Renamed Shop");
  expect(text).toContain("Original Shop");
  expect(text).not.toContain("Renamed Shop");
  expect(text).toContain("Original Customer");
  expect(text).toContain("2 × 3 ft each");
});
