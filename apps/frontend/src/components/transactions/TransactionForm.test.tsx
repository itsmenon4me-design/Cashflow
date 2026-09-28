import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "./TransactionForm";
import { uiText } from "@/locales";

describe("TransactionForm", () => {
  afterEach(cleanup);

  it("uses the localized clickable date field and keeps time while hiding its control", async () => {
    const onSubmit = vi.fn();
    render(
      <TransactionForm
        open
        onOpenChange={vi.fn()}
        mode="create"
        transaction={null}
        categories={["Belanja"]}
        initialValues={{
          date: "2026-09-28",
          category: "Belanja",
          amount: 25000,
          notes: "Belanja mingguan",
        }}
        onSubmit={onSubmit}
      />,
    );

    const dateInput = screen.getByLabelText(uiText.transactions.fieldDate) as HTMLInputElement;
    const showPicker = vi.fn();
    Object.defineProperty(dateInput, "showPicker", { configurable: true, value: showPicker });

    expect(screen.getByText("28/09/2026")).toBeInTheDocument();
    fireEvent.click(dateInput);
    expect(showPicker).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText(uiText.transactions.fieldTime)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(uiText.transactions.fieldDescription)).not.toBeInTheDocument();
    expect(screen.getByLabelText(uiText.transactions.fieldNotes)).toHaveValue("Belanja mingguan");

    fireEvent.click(screen.getByRole("button", { name: uiText.common.save }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      date: "2026-09-28",
      time: expect.stringMatching(/^\d{2}:\d{2}$/),
      notes: "Belanja mingguan",
    }));
  });

  it("keeps legacy transaction text visible in Catatan when editing", () => {
    render(
      <TransactionForm
        open
        onOpenChange={vi.fn()}
        mode="edit"
        transaction={{
          id: "transaction-1",
          date: "2026-09-28",
          dateTime: "2026-09-28T03:30:00.000Z",
          category: "Belanja",
          description: "Catatan lama",
          amount: 25000,
          type: "expense",
          status: "completed",
        }}
        categories={["Belanja"]}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(uiText.transactions.fieldNotes)).toHaveValue("Catatan lama");
    expect(screen.queryByLabelText(uiText.transactions.fieldDescription)).not.toBeInTheDocument();
  });
});
