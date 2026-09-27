import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./require-auth";
import { useAuthStore } from "@/stores/auth.store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("RequireAuth", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      hydrated: false,
    });
  });

  it("renders the route fallback while auth is hydrating or redirecting", () => {
    useAuthStore.setState({ hydrated: false, isAuthenticated: false });

    render(
      <RequireAuth fallback={<div>Loading dashboard</div>}>
        <div>Protected dashboard</div>
      </RequireAuth>,
    );

    expect(screen.getByText("Loading dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Protected dashboard")).not.toBeInTheDocument();
  });
});
