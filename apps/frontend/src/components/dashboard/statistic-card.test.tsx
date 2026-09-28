import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CircleDollarSign } from "lucide-react";
import { StatisticCard } from "./statistic-card";

describe("StatisticCard", () => {
  it("does not render an empty card while its data is loading", () => {
    const { container } = render(
      <StatisticCard
        label="Total"
        value="Rp0"
        icon={CircleDollarSign}
        loading
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
