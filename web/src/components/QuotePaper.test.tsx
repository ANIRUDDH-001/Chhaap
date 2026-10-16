import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { QuotePaper } from "./QuotePaper";
import type { Snapshot } from "../lib/types";

it("shows the issued shop and recipient snapshot after their profiles change", () => {
  const snapshot = {
    currency: "INR",
    rate_version: "1",
    lines: [],
    components: [],
    subtotal: 150000,
    total: 150000,
    deposit: 75000,
    ready: true,
    warnings: [],
    shop_name: "Original Printworks",
    customer: {
      id: "1",
      name: "Original Customer",
      business: "Original Studio",
      phone: "",
      email: "",
    },
  } as Snapshot;
  render(
    <QuotePaper
      snapshot={snapshot}
      shopName="Renamed Printworks"
      customer={{
        id: "1",
        name: "Changed Customer",
        business: "Changed Studio",
        phone: "",
        email: "",
      }}
      quote={
        {
          id: "q",
          number: "CH-1",
          version: 1,
          created_at: "2026-10-16",
          expires_at: "2026-10-23",
          terms: "Artwork approval required.",
        } as never
      }
    />,
  );
  expect(screen.getByText("Original Printworks")).toBeInTheDocument();
  expect(
    screen.getByText("Original Customer · Original Studio"),
  ).toBeInTheDocument();
});
