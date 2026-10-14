import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { ApiClient } from "../src/api/client";
import { createMockApi, apiError } from "../src/mocks/handlers";

const mock = createMockApi();
const server = setupServer(...mock.handlers);
const fingerprint = "a".repeat(32);
let client: ApiClient;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
beforeEach(() => {
  mock.reset();
  client = new ApiClient("http://localhost", () => fingerprint);
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

it("rejects private data if session ends while JSON is being decoded", async () => {
  await client.initialize();
  let decode!: () => void;
  let reading!: () => void;
  const started = new Promise<void>((resolve) => {
    reading = resolve;
  });
  const response = new Response("{}", { status: 200 });

  vi.spyOn(response, "json").mockImplementation(() => {
    reading();

    return new Promise((resolve) => {
      decode = () => resolve({ id: 1 });
    });
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

  const result = client.request("/v1/me", { protected: true });
  const assertion = expect(result).rejects.toThrow("Session has ended.");

  await started;
  client.endSession();
  decode();
  await assertion;
});

it("new session rotates independently and old rotation cannot clear its flight", async () => {
  const epoch = client.beginSession();
  let finishOld!: () => void;
  let finishNew!: () => void;
  let count = 0;

  server.use(
    http.get("*/v1/me", () => apiError(401, "Expired")),
    http.post("*/auth/token/rotate", async () => {
      count++;
      await new Promise<void>((resolve) => {
        if (count === 1) {
          finishOld = resolve;
        } else {
          finishNew = resolve;
        }
      });

      return HttpResponse.json({});
    }),
  );

  const old = client.request("/v1/me", { protected: true });
  const oldAssertion = expect(old).rejects.toThrow("Session has ended.");

  await vi.waitFor(() => expect(count).toBe(1));
  client.endSession();
  client.beginSession();
  expect(() => client.assertSession(epoch)).toThrow("Session has ended.");
  const current = client.request("/v1/me", { protected: true });
  const currentAssertion = expect(current).rejects.toMatchObject({
    status: 401,
  });

  await vi.waitFor(() => expect(count).toBe(2));
  finishOld();
  await oldAssertion;
  const parallel = client.request("/v1/me", { protected: true });
  const parallelAssertion = expect(parallel).rejects.toThrow();

  // The second request must await the current session's rotation.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(count).toBe(2);
  finishNew();
  await Promise.all([currentAssertion, parallelAssertion]);
});

it.each([null, [], "text", 12])(
  "returns contract errors for non-object JSON %j",
  async (body) => {
    await expect(
      client.request("/auth/login", { method: "POST", body }),
    ).rejects.toMatchObject({
      status: 400,
      body: { error: { type: "BadRequestException" } },
    });
  },
);

it("returns a contract error for syntactically invalid JSON", async () => {
  const response = await fetch("http://localhost/auth/login", {
    method: "POST",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-TOKEN": "mock-fixed-csrf-token",
      "Content-Type": "application/json",
    },
    body: "{",
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { type: "BadRequestException" },
  });
});
