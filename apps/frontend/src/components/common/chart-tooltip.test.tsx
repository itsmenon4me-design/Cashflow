import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartTooltip } from "./chart-tooltip";

describe("ChartTooltip", () => {
  it("removes the rupiah prefix from formatted chart values", () => {
    render(
      <ChartTooltip
        active
        label="Sep"
        payload={[{ name: "Arus Kas", value: 600000 }]}
        valueFormatter={() => "Rp600.000"}
      />,
    );

    expect(screen.getByText("600.000")).toBeInTheDocument();
    expect(screen.queryByText(/Rp/)).not.toBeInTheDocument();
  });

  it("preserves formatted non-currency values", () => {
    render(
      <ChartTooltip
        active
        label="Sep"
        payload={[{ name: "Persentase", value: 25 }]}
        valueFormatter={() => "25%"}
      />,
    );

    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
