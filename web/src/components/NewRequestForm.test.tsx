import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { NewRequestForm } from "./NewRequestForm";

it("keeps the customer message visible when saving fails", async () => {
  render(
    <NewRequestForm
      onCreate={async () => {
        throw new Error("Connection lost. Try again.");
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("Customer name"), {
    target: { value: "Riya" },
  });
  fireEvent.change(screen.getByLabelText("Customer conversation"), {
    target: { value: "500 cards, matte finish" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create request" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Connection lost"),
  );
  expect(screen.getByLabelText("Customer conversation")).toHaveValue(
    "500 cards, matte finish",
  );
});
