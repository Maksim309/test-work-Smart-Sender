import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";
import { ApiClient } from "../src/api/client";
import { createMockApi, apiError } from "../src/mocks/handlers";
import { getFingerprint } from "../src/auth/fingerprint";
import { validateWebhook, listParameters } from "../src/domain/validation";
import type { User, Webhook, WebhookList } from "../src/domain/types";

const base = "http://localhost";
const fingerprint = "a".repeat(32);
let time = 1000;
const mock = createMockApi(() => time);
const server = setupServer(...mock.handlers);
let ended = vi.fn();
let client: ApiClient;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterAll(() => server.close());

beforeEach(() => {
  mock.reset();

  time = 1000;

  ended = vi.fn();

  client = new ApiClient(base, () => fingerprint, ended);
});

afterEach(() => server.resetHandlers());

async function login(password = "Webhook123!") {
  const result = await client.request<{ device_session_token: string }>(
    "/auth/login",
    {
      method: "POST",
      body: { email: "test@example.com", password, fingerprint },
      headers: { "X-Captcha-Token": "test" },
    },
  );

  await client.request("/auth/token/issue", {
    method: "POST",
    body: { ...result, fingerprint },
  });

  return result;
}

const me = () => client.request<User>("/v1/me", { protected: true });
const list = (query = "") =>
  client.request<WebhookList>(`/v1/webhooks?limit=10&${query}`, {
    protected: true,
  });

describe("API integration through real MSW handlers", () => {
  it("initializes CSRF before login, issues session and loads user", async () => {
    await login();

    expect((await me()).email).toBe("test@example.com");

    expect(mock.metrics["GET /csrf"]).toBe(1);
  });

  it("rejects wrong password with field validation", async () => {
    await expect(login("wrong")).rejects.toMatchObject({
      status: 422,
      body: {
        error: { payload: { password: ["Email or password is incorrect."] } },
      },
    });
  });

  it("coalesces two expired requests into exactly one rotate and retries each once", async () => {
    await login();

    time += 30_001;

    const [user, hooks] = await Promise.all([me(), list()]);

    expect(user.id).toBe(1);

    expect(hooks.data).toHaveLength(10);

    expect(mock.metrics["POST /auth/token/rotate"]).toBe(1);

    expect(mock.metrics["GET /v1/me"]).toBe(2);

    expect(mock.metrics["GET /v1/webhooks"]).toBe(2);
  });

  it("does not rotate twice when a late 401 arrives after rotation finishes", async () => {
    await login();

    time += 30_001;

    let calls = 0;

    server.use(
      http.get("*/v1/me", async () => {
        calls++;

        if (calls === 1) {
          await delay(80);

          return apiError(401, "Expired");
        }

        return HttpResponse.json({ id: 1 });
      }),
    );

    await Promise.all([me(), list()]);

    expect(mock.metrics["POST /auth/token/rotate"]).toBe(1);

    expect(calls).toBe(2);
  });

  it("refreshes CSRF once after 419 and retries", async () => {
    let calls = 0;

    server.use(
      http.post("*/auth/login", () => {
        calls++;

        return calls === 1
          ? apiError(419, "Mismatch")
          : HttpResponse.json({ device_session_token: "test" });
      }),
    );

    await client.request("/auth/login", { method: "POST", body: {} });

    expect(calls).toBe(2);

    expect(mock.metrics["GET /csrf"]).toBe(2);
  });

  it("surfaces repeated 419 without looping", async () => {
    let calls = 0;

    server.use(
      http.post("*/auth/login", () => {
        calls++;

        return apiError(419, "Mismatch");
      }),
    );

    await expect(
      client.request("/auth/login", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ status: 419 });

    expect(calls).toBe(2);
  });

  it("combines CSRF recovery and session recovery in one update", async () => {
    await login();

    time += 30_001;

    let calls = 0;

    server.use(
      http.put("*/v1/webhooks/1", () => {
        calls++;

        if (calls === 1) {
          return apiError(419, "Mismatch");
        }

        if (calls === 2) {
          return apiError(401, "Expired");
        }

        return HttpResponse.json({ id: 1, name: "Updated" });
      }),
    );

    await expect(
      client.request("/v1/webhooks/1", {
        method: "PUT",
        body: { name: "Updated", url: "https://example.com" },
        protected: true,
      }),
    ).resolves.toMatchObject({ name: "Updated" });

    expect(calls).toBe(3);

    expect(mock.metrics["POST /auth/token/rotate"]).toBe(1);
  });

  it("ends session once when shared rotate fails", async () => {
    await login();

    time += 30_001;

    server.use(
      http.post("*/auth/token/rotate", async () => {
        await delay(20);

        return apiError(400, "Invalid session");
      }),
    );

    const results = await Promise.allSettled([me(), list()]);

    expect(results.every((result) => result.status === "rejected")).toBe(true);

    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("ends session after a repeated 401 with no second rotation", async () => {
    await login();

    server.use(http.get("*/v1/me", () => apiError(401, "Expired")));

    await expect(me()).rejects.toMatchObject({ status: 401 });

    expect(ended).toHaveBeenCalledTimes(1);

    expect(mock.metrics["POST /auth/token/rotate"]).toBe(1);
  });

  it("revokes session, denies protected access and rejects rotation", async () => {
    await login();

    await client.request("/auth/token/revoke", {
      method: "POST",
      body: { fingerprint },
    });

    client.endSession();

    await expect(me()).rejects.toMatchObject({ status: 401 });

    await expect(
      client.request("/auth/token/rotate", {
        method: "POST",
        body: { fingerprint },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects rotation before issue and rejects replay of the device token", async () => {
    await expect(
      client.request("/auth/token/rotate", {
        method: "POST",
        body: { fingerprint },
      }),
    ).rejects.toMatchObject({ status: 400 });

    const device = await login();

    await expect(
      client.request("/auth/token/issue", {
        method: "POST",
        body: { ...device, fingerprint },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("paginates, clamps out-of-range pages and searches case-insensitive substrings", async () => {
    await login();

    const first = await list("page=1");
    const last = await list("page=3");

    expect(first.data).toHaveLength(10);

    expect(last.data).toHaveLength(8);

    expect(last.paging.results.total).toBe(28);

    expect((await list("page=999")).paging.pages.current).toBe(3);

    expect((await list("search=ORDER")).data).toHaveLength(4);

    expect((await list("search=absent")).data).toEqual([]);
  });

  it("updates webhook and validates fields on the server", async () => {
    await login();

    await expect(
      client.request("/v1/webhooks/1", {
        protected: true,
        method: "PUT",
        body: { name: "", url: "ftp://example.com" },
      }),
    ).rejects.toMatchObject({ status: 422 });

    await client.request("/v1/webhooks/1", {
      protected: true,
      method: "PUT",
      body: { name: "Updated", url: "https://new.example.com" },
    });

    expect(
      (await client.request<Webhook>("/v1/webhooks/1", { protected: true }))
        .name,
    ).toBe("Updated");

    await expect(
      client.request("/v1/webhooks/999", { protected: true }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("checks CSRF before any mutation and requires captcha", async () => {
    const response = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    expect(response.status).toBe(419);

    await expect(
      client.request("/auth/login", {
        method: "POST",
        body: {
          email: "test@example.com",
          password: "Webhook123!",
          fingerprint,
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("does not allow in-flight work to return private data after logout", async () => {
    await login();

    server.use(
      http.get("*/v1/me", async () => {
        await delay(30);

        return HttpResponse.json({ id: 1 });
      }),
    );

    const request = me();

    client.endSession();

    await expect(request).rejects.toThrow("Session has ended.");
  });
});

describe("domain", () => {
  it("generates stable 32 hex fingerprint and repairs invalid persisted data", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const first = getFingerprint(storage);

    expect(first).toMatch(/^[a-f0-9]{32}$/);

    expect(getFingerprint(storage)).toBe(first);

    storage.setItem("webhook.fingerprint", "invalid");

    expect(getFingerprint(storage)).not.toBe(first);

    expect(values.size).toBe(1);
  });

  it("validates form and parses URL state", () => {
    expect(
      validateWebhook({ name: " ", url: "javascript:alert(1)" }),
    ).toHaveProperty("url");

    expect(validateWebhook({ name: "Ok", url: "https://example.com" })).toEqual(
      {},
    );

    expect(listParameters(new URLSearchParams("page=-2&search=Order"))).toEqual(
      { page: 1, search: "Order" },
    );
  });
});
