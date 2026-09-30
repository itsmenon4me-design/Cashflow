import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RightPanel } from "./right-panel";
import { budgetService } from "@/services/budget.service";
import { setUiTextLanguage, uiText } from "@/locales";

vi.mock("@/components/dashboard/NotificationCard", () => ({
  NotificationCard: () => <div>Notifications</div>,
}));

describe("RightPanel monthly targets", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setUiTextLanguage("id");
  });

  it("shows an analysis error with retry instead of the empty state", async () => {
    vi.spyOn(budgetService, "analysis")
      .mockRejectedValueOnce(new Error("Budget analysis unavailable"))
      .mockResolvedValueOnce({ categories: [] } as any);

    render(<RightPanel />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      uiText.dashboard.budgetAnalysisLoadError,
    );
    expect(
      screen.queryByText(uiText.common.noDataAvailable),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: uiText.common.tryAgain }));

    expect(
      await screen.findByText(uiText.common.noDataAvailable),
    ).toBeInTheDocument();
  });

  it("shows the empty state for a successful empty analysis", async () => {
    vi.spyOn(budgetService, "analysis").mockResolvedValue({
      categories: [],
    } as any);

    render(<RightPanel />);

    expect(
      await screen.findByText(uiText.common.noDataAvailable),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
