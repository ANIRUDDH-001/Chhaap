import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SessionContext } from "../lib/session";
import { blankLine } from "../lib/types";
import type { RequestRecord, SessionInfo } from "../lib/types";
import { Workbench } from "./Workbench";

const request: RequestRecord = {
  id: "request-1",
  title: "Fictional cards",
  revision: 1,
  customer: {
    id: "customer-1",
    name: "Riya",
    business: "Studio",
    phone: "",
    email: "",
  },
  status: "ready",
  lines: [{ ...blankLine(), quantity: 500, paper: "350", confirmed: true }],
  adjustments: {},
  delivery_date: "2026-10-19",
  delivery_confirmed: true,
  notes: "",
  created_at: "2026-10-16T12:00:00Z",
  sources: [],
  extraction: null,
  job: null,
};
const session: SessionInfo = {
  shop: {
    id: "shop-1",
    name: "Fictional Printworks",
    mode: "sample",
    settings: {
      timezone: "Asia/Kolkata",
      currency: "INR",
      quote_validity_days: 7,
      retention_days: 30,
    },
  },
  user: { name: "Aman", role: "owner" },
};
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function mount() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(["request", request.id], structuredClone(request));
  render(
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={session}>
        <MemoryRouter initialEntries={["/requests/" + request.id]}>
          <Routes>
            <Route
              path="/requests/:id"
              element={<Workbench onNew={() => {}} />}
            />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  );
  return client;
}
function common(url: string) {
  if (url.endsWith("/quotes/preview"))
    return response({
      currency: "INR",
      rate_version: "1",
      lines: [],
      components: [],
      subtotal: 150000,
      total: 150000,
      deposit: 75000,
      ready: true,
      warnings: [],
    });
  if (url.endsWith("/inference/status"))
    return response({ available: false, model: "local" });
  return response(request);
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it("retries a failed autosave without discarding the entered quantity", async () => {
  const patches: Record<string, unknown>[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    if (options?.method === "PATCH") {
      const body = JSON.parse(String(options.body));
      patches.push(body);
      return patches.length === 1
        ? response({ detail: "Connection lost" }, 503)
        : response({ ...request, ...body, revision: 2 });
    }
    return common(String(input));
  });
  mount();
  fireEvent.change(await screen.findByLabelText("Quantity"), {
    target: { value: "1000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save now" }));
  await screen.findByText("Connection lost");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(patches).toHaveLength(2));
  expect((patches[1].lines as { quantity: number }[])[0].quantity).toBe(1000);
  expect(screen.getByLabelText("Quantity")).toHaveValue(1000);
});

it("preserves newer specifications while an uploaded screenshot response is pending", async () => {
  let resolveUpload!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    resolveUpload = resolve;
  });
  const patches: Record<string, unknown>[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    if (String(input).endsWith("/attachments")) return pending;
    if (options?.method === "PATCH") {
      const body = JSON.parse(String(options.body));
      patches.push(body);
      return response({ ...request, ...body, revision: 3 });
    }
    return common(String(input));
  });
  mount();
  const quantity = await screen.findByLabelText("Quantity");
  fireEvent.change(screen.getByLabelText("Upload screenshot"), {
    target: {
      files: [new File(["fictional image"], "test.png", { type: "image/png" })],
    },
  });
  await waitFor(() =>
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/attachments"),
      expect.anything(),
    ),
  );
  fireEvent.change(quantity, { target: { value: "1000" } });
  await act(async () =>
    resolveUpload(
      response({
        ...request,
        revision: 2,
        lines: request.lines.map((line) => ({ ...line, confirmed: false })),
        delivery_confirmed: false,
        sources: [
          {
            id: "image-1",
            kind: "image",
            text: "",
            sender: "Screenshot",
            position: 0,
            url: "/api/v1/media/image-1",
          },
        ],
      }),
    ),
  );
  expect(screen.getByLabelText("Quantity")).toHaveValue(1000);
  expect(
    screen.getByLabelText("I’ve checked and confirmed these specifications."),
  ).not.toBeChecked();
  expect(
    screen.getByRole("img", {
      name: "Uploaded customer conversation screenshot",
    }),
  ).toBeVisible();
  await waitFor(() => expect(patches).toHaveLength(1), { timeout: 2500 });
  expect(patches[0].expected_revision).toBe(2);
  expect((patches[0].lines as { quantity: number }[])[0].quantity).toBe(1000);
});
