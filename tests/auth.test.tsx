// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setupServer } from "msw/node";
import { http } from "msw";
import { AuthProvider, useAuth } from "../src/auth/AuthProvider";
import { api, queryClient } from "../src/api";
import { createMockApi, apiError } from "../src/mocks/handlers";

const mock = createMockApi();
const server = setupServer(...mock.handlers);

function Harness() {
  const { user, notice, login, logout } = useAuth();

  return (
    <>
      <span>{user ? user.email : "Signed out"}</span>
      {notice && <p role="alert">{notice}</p>}
      <button onClick={() => void login("test@example.com", "Webhook123!")}>
        Login
      </button>
      <button onClick={() => void logout()}>Logout</button>
      <button
        onClick={() => {
          queryClient.setQueryData(["private"], { secret: true });
          void api.request("/v1/me", { protected: true }).catch(() => {});
        }}
      >
        Load
      </button>
    </>
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  mock.reset();
  queryClient.clear();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

it("preserves logout failure notice after clearing user and private cache", async () => {
  const user = userEvent.setup();

  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByText("test@example.com");
  queryClient.setQueryData(["private"], { secret: true });
  server.use(
    http.post("*/auth/token/revoke", () => apiError(400, "Revoke failed")),
  );
  await user.click(screen.getByRole("button", { name: "Logout" }));
  await screen.findByText("Signed out");
  expect(screen.getByRole("alert").textContent).toContain("Revoke failed");
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

it.each(["rotate failure", "repeated unauthorized response"])(
  "clears React user and cache on %s",
  async (scenario) => {
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Login" }));
    await screen.findByText("test@example.com");
    server.use(http.get("*/v1/me", () => apiError(401, "Expired")));
    if (scenario === "rotate failure") {
      server.use(
        http.post("*/auth/token/rotate", () => apiError(400, "Cannot rotate")),
      );
    }

    await user.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("Signed out");
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  },
);
