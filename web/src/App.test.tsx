import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("shows a labelled visual preview when this host has no API routes", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Read-only visual preview")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Open the full local app" }),
  ).toHaveAttribute("href", "http://localhost:5175/");
  expect(
    screen.getByText(/No business data is submitted from this preview/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Production" }));
  expect(
    screen.getByRole("img", { name: /Actual production board/ }),
  ).toBeVisible();
});
