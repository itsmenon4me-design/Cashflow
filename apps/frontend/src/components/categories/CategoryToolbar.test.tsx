import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategoryToolbar } from "./CategoryToolbar";

describe("CategoryToolbar", () => {
  it("keeps the add action at the right while the count is loading", () => {
    render(<CategoryToolbar count={0} loading onAdd={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveClass("ml-auto");
  });
});
