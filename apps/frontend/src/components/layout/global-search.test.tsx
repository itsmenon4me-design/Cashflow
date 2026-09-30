import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalSearch } from "@/components/layout/global-search";
import { uiText } from "@/locales";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("GlobalSearch", () => {
  afterEach(() => {
    cleanup();
    mockPush.mockReset();
  });

  it("returns navigation entries only, not matching category or record data", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);
    await user.type(screen.getByRole("combobox"), "bonus");

    expect(await screen.findByText(uiText.common.noSearchResults)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("renders a matching menu entry as a navigable link", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);
    await user.type(screen.getByRole("combobox"), "kategori");

    const option = await screen.findByRole("option", { name: /kategori/i });
    expect(option).toHaveAttribute("href", "/categories");

  });

  it("uses Enter to navigate to the first matching menu entry", async () => {
    const user = userEvent.setup();
    render(<GlobalSearch />);
    const input = screen.getByRole("combobox");
    await user.type(input, "target");
    await user.keyboard("{Enter}");

    expect(mockPush).toHaveBeenCalledWith("/goals");
  });
});
