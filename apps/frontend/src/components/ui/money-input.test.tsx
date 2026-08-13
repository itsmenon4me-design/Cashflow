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

  it("USD accepts two decimal places", () => {
    const onValueChange = setup("USD");
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "1.23" } });
    expect(onValueChange).toHaveBeenLastCalledWith(1.23);
    expect(input).toHaveValue("1.23");
  });

  it("USD caps fractional digits at 2 (no silent 3rd decimal)", () => {
    const onValueChange = setup("USD");
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "999.919" } });
    expect(onValueChange).toHaveBeenLastCalledWith(999.91);
  });

  it("EUR uses comma decimal separator", () => {
    const onValueChange = setup("EUR");
    const input = screen.getByLabelText("amount");
    fireEvent.change(input, { target: { value: "17,47" } });
    expect(onValueChange).toHaveBeenLastCalledWith(17.47);
    expect(input).toHaveValue("17,47");
  });

  it("USD parses a fully formatted paste", () => {
    const onValueChange = setup("USD");
    const input = screen.getByLabelText("amount");
    fireEvent.paste(input, { clipboardData: { getData: () => "1,000,000.99" } });
    expect(onValueChange).toHaveBeenLastCalledWith(1000000.99);
  });

  it("renders an existing IDR value with grouping", () => {
    render(
      <MoneyInput value={1000000} onValueChange={vi.fn()} currency="IDR" aria-label="amount" />,
    );
    expect(screen.getByLabelText("amount")).toHaveValue("1.000.000");
  });

  it("renders an existing USD value with decimals", () => {
    render(
      <MoneyInput value={1.23} onValueChange={vi.fn()} currency="USD" aria-label="amount" />,
    );
    expect(screen.getByLabelText("amount")).toHaveValue("1.23");
  });
});
