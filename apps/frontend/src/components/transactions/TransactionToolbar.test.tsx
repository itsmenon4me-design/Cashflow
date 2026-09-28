import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionToolbar } from "./TransactionToolbar";

describe("TransactionToolbar", () => {
  it("does not render a placeholder block while loading", () => {
    const { container } = render(
      <TransactionToolbar count={12} loading onAdd={vi.fn()} />,
    );

    expect(container.querySelector("span.h-4.w-20.bg-muted")).toBeNull();
    expect(screen.queryByText("12 transaksi")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button").parentElement).toHaveClass("ml-auto");
  });
});
