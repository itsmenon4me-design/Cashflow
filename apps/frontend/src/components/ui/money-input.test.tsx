import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MoneyInput } from "./money-input";

function setup(currency?: string) {
  const onValueChange = vi.fn();
  render(
    <MoneyInput
      value={null}
      onValueChange={onValueChange}
      currency={currency}
      aria-label="amount"
    />,
  );
  return onValueChange;
}

describe("MoneyInput - currency-aware entry", () => {
  it("IDR keeps integer digits only (no decimals)", () => {
    const onValueChange = setup("IDR");
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "1000000" } });
    expect(onValueChange).toHaveBeenLastCalledWith(1000000);
    expect(input).toHaveValue("1.000.000");
  });

  it("REGRESSION: typing 1.000.000 IDR stays 1.000.000 (not 100.000.000)", () => {
    const onValueChange = setup("IDR");
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "1.000.000" } });
    expect(onValueChange).toHaveBeenLastCalledWith(1000000);
    expect(onValueChange).not.toHaveBeenLastCalledWith(100000000);
  });

  it("renders an existing IDR value with grouping", () => {
    render(
      <MoneyInput value={1000000} onValueChange={vi.fn()} currency="IDR" aria-label="amount" />,
    );
    expect(screen.getByLabelText("amount")).toHaveValue("1.000.000");
  });
});
