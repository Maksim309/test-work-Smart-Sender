import { http, HttpResponse } from "msw";
import { createWebhooks, demoPassword, demoUser } from "./data";
import { validateWebhook } from "../domain/validation";
import type { FieldErrors, WebhookInput } from "../domain/types";

const csrfToken = "mock-fixed-csrf-token";
const errorTypes: Record<number, string> = {
  400: "BadRequestException",
  401: "AuthenticationException",
  404: "NotFoundException",
  419: "TokenMismatchException",
  422: "ValidationException",
};

export const apiError = (
  status: number,
  message: string,
  payload?: FieldErrors,
) =>
  HttpResponse.json(
    {
      error: {
        type: errorTypes[status],
        message,
        ...(payload ? { payload } : {}),
      },
    },
    { status },
  );

// This state belongs exclusively to the mock server. No session secret is returned to the client.
export function createMockApi(now: () => number = Date.now) {
  let webhooks = createWebhooks();
  let deviceSession: { token: string; fingerprint: string } | undefined;
  let session: { fingerprint: string; expiresAt: number } | undefined;
  const metrics: Record<string, number> = {};

  const checkRequest = (request: Request, requiresSession = false) => {
    const { method, headers, url } = request;
    const requestKey = `${method} ${new URL(url).pathname}`;

    metrics[requestKey] = (metrics[requestKey] ?? 0) + 1;

    if (headers.get("X-Requested-With") !== "XMLHttpRequest") {
      return apiError(400, "X-Requested-With is required.");
    }

    if (
      ["POST", "PUT"].includes(method) &&
      headers.get("X-CSRF-TOKEN") !== csrfToken
    ) {
      return apiError(419, "CSRF token mismatch.");
    }

    if (requiresSession && (!session || session.expiresAt <= now())) {
      return apiError(401, "Your session has expired. Please sign in again.");
    }
  };

  const readBody = async (
    request: Request,
  ): Promise<Record<string, unknown> | null> => {
    try {
      const parsedBody: unknown = await request.json();

      return parsedBody !== null &&
        typeof parsedBody === "object" &&
        !Array.isArray(parsedBody)
        ? (parsedBody as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const validFingerprint = (fingerprint: unknown): fingerprint is string =>
    typeof fingerprint === "string" && /^[a-f0-9]{32}$/.test(fingerprint);
  const handlers = [
    http.get(
      "*/csrf",
      ({ request }) =>
        checkRequest(request) ??
        new HttpResponse(null, {
          status: 204,
          headers: { "X-CSRF-TOKEN": csrfToken },
        }),
    ),
    http.post("*/auth/login", async ({ request }) => {
      const requestError = checkRequest(request);

      if (requestError) {
        return requestError;
      }

      const input = await readBody(request);

      if (!input) {
        return apiError(400, "Request body must be a JSON object.");
      }

      if (!request.headers.get("X-Captcha-Token")?.trim()) {
        return apiError(400, "Captcha token is required.");
      }

      if (!validFingerprint(input.fingerprint)) {
        return apiError(422, "The given data was invalid.", {
          fingerprint: ["Invalid device fingerprint."],
        });
      }

      if (input.email !== demoUser.email || input.password !== demoPassword) {
        return apiError(422, "The given data was invalid.", {
          password: ["Email or password is incorrect."],
        });
      }

      deviceSession = {
        token: crypto.randomUUID(),
        fingerprint: input.fingerprint,
      };

      return HttpResponse.json({ device_session_token: deviceSession.token });
    }),
    http.post("*/auth/token/issue", async ({ request }) => {
      const requestError = checkRequest(request);

      if (requestError) {
        return requestError;
      }

      const input = await readBody(request);

      if (!input) {
        return apiError(400, "Request body must be a JSON object.");
      }

      if (
        !deviceSession ||
        input.device_session_token !== deviceSession.token ||
        input.fingerprint !== deviceSession.fingerprint
      ) {
        return apiError(400, "Invalid device session.");
      }

      session = {
        fingerprint: deviceSession.fingerprint,
        expiresAt: now() + 30_000,
      };

      deviceSession = undefined;

      return HttpResponse.json({});
    }),
    http.post("*/auth/token/rotate", async ({ request }) => {
      const requestError = checkRequest(request);

      if (requestError) {
        return requestError;
      }

      const input = await readBody(request);

      if (!input) {
        return apiError(400, "Request body must be a JSON object.");
      }

      if (!session || input.fingerprint !== session.fingerprint) {
        return apiError(
          400,
          "Session cannot be renewed. Please sign in again.",
        );
      }

      session.expiresAt = now() + 30_000;

      return HttpResponse.json({});
    }),
    http.post("*/auth/token/revoke", async ({ request }) => {
      const requestError = checkRequest(request);

      if (requestError) {
        return requestError;
      }

      const input = await readBody(request);

      if (!input) {
        return apiError(400, "Request body must be a JSON object.");
      }

      if (session && input.fingerprint !== session.fingerprint) {
        return apiError(400, "Invalid device fingerprint.");
      }

      session = undefined;

      deviceSession = undefined;

      return new HttpResponse(null, { status: 204 });
    }),
    http.get(
      "*/v1/me",
      ({ request }) =>
        checkRequest(request, true) ?? HttpResponse.json(demoUser),
    ),
    http.get("*/v1/webhooks", ({ request }) => {
      const requestError = checkRequest(request, true);

      if (requestError) {
        return requestError;
      }

      const params = new URL(request.url).searchParams;
      const matchedWebhooks = webhooks.filter((webhook) =>
        webhook.name
          .toLowerCase()
          .includes((params.get("search") ?? "").toLowerCase()),
      );
      const pageSize = 10;
      const lastPage = Math.max(
        1,
        Math.ceil(matchedWebhooks.length / pageSize),
      );
      const requestedPage = Number(params.get("page") ?? 1);
      const currentPage = Math.min(
        lastPage,
        Number.isSafeInteger(requestedPage) && requestedPage > 0
          ? requestedPage
          : 1,
      );

      return HttpResponse.json({
        data: matchedWebhooks.slice(
          (currentPage - 1) * pageSize,
          currentPage * pageSize,
        ),
        paging: {
          pages: { current: currentPage, last: lastPage },
          results: { total: matchedWebhooks.length, limitation: pageSize },
        },
      });
    }),
    http.get("*/v1/webhooks/:id", ({ request, params }) => {
      const requestError = checkRequest(request, true);

      if (requestError) {
        return requestError;
      }

      const webhook = webhooks.find(
        (webhook) => webhook.id === Number(params.id),
      );

      return webhook
        ? HttpResponse.json(webhook)
        : apiError(404, "Webhook not found.");
    }),
    http.put("*/v1/webhooks/:id", async ({ request, params }) => {
      const requestError = checkRequest(request, true);

      if (requestError) {
        return requestError;
      }

      const webhook = webhooks.find(
        (webhook) => webhook.id === Number(params.id),
      );

      if (!webhook) {
        return apiError(404, "Webhook not found.");
      }

      const input = await readBody(request);

      if (!input) {
        return apiError(400, "Request body must be a JSON object.");
      }

      const { name, url } = input;
      const fields: WebhookInput = {
        name: typeof name === "string" ? name : "",
        url: typeof url === "string" ? url : "",
      };

      const errors = validateWebhook(fields);

      if (Object.keys(errors).length) {
        return apiError(422, "The given data was invalid.", errors);
      }

      Object.assign(webhook, {
        name: fields.name.trim(),
        url: fields.url,
      });

      return HttpResponse.json(webhook);
    }),
  ];

  return {
    handlers,
    metrics,
    reset: () => {
      webhooks = createWebhooks();

      session = undefined;

      deviceSession = undefined;

      Object.keys(metrics).forEach((requestKey) => delete metrics[requestKey]);
    },
  };
}
