import type { ErrorBody } from "../domain/types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ErrorBody,
  ) {
    super(body.error.message);
  }
}

export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  protected?: boolean;
  signal?: AbortSignal;
}

export class ApiClient {
  private csrfToken: string | undefined;
  private csrfPromise: Promise<void> | undefined;
  private pendingRotation:
    { sessionVersion: number; promise: Promise<void> } | undefined;

  private tokenVersion = 0;
  private sessionVersion = 0;
  private isSessionEnded = false;
  constructor(
    private baseUrl: string,
    private readFingerprint: () => string,
    private onSessionEnd: () => void = () => {},
  ) {}

  beginSession() {
    this.sessionVersion++;
    this.tokenVersion = 0;
    this.isSessionEnded = false;

    return this.sessionVersion;
  }

  assertSession(sessionVersion: number) {
    if (sessionVersion !== this.sessionVersion || this.isSessionEnded) {
      throw new Error("Session has ended.");
    }
  }

  initialize(): Promise<void> {
    return this.csrfToken ? Promise.resolve() : this.refreshCsrf();
  }

  endSession() {
    this.sessionVersion++;

    if (!this.isSessionEnded) {
      this.isSessionEnded = true;
      this.onSessionEnd();
    }
  }

  private async parseError(response: Response): Promise<ApiError> {
    let body: ErrorBody;

    try {
      body = (await response.json()) as ErrorBody;

      if (!body.error?.message) {
        throw new Error();
      }
    } catch {
      body = {
        error: {
          type: "UnexpectedException",
          message: `Request failed (${response.status}). Please try again.`,
        },
      };
    }

    return new ApiError(response.status, body);
  }

  private refreshCsrf(): Promise<void> {
    if (!this.csrfPromise) {
      this.csrfPromise = (async () => {
        const response = await fetch(`${this.baseUrl}/csrf`, {
          credentials: "include",
          cache: "no-store",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        });

        if (!response.ok) {
          throw await this.parseError(response);
        }

        const token = response.headers.get("X-CSRF-TOKEN");

        if (!token) {
          throw new Error(
            "The demo API is not intercepting requests. Reload this page and make sure Service Workers are enabled (including in browser developer tools).",
          );
        }

        this.csrfToken = token;
      })().finally(() => {
        this.csrfPromise = undefined;
      });
    }

    return this.csrfPromise;
  }

  private async send(
    path: string,
    options: RequestOptions,
    retryState = { csrfRetried: false },
  ): Promise<Response> {
    const { method = "GET", body, headers, signal } = options;

    if (!this.csrfToken) {
      await this.refreshCsrf();
    }

    const fetchResponse = () =>
      fetch(`${this.baseUrl}${path}`, {
        method,
        credentials: "include",
        signal,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(method === "POST" || method === "PUT"
            ? { "X-CSRF-TOKEN": this.csrfToken! }
            : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const sentCsrfToken = this.csrfToken;
    let response = await fetchResponse();

    if (response.status === 419 && !retryState.csrfRetried) {
      retryState.csrfRetried = true;

      if (sentCsrfToken === this.csrfToken) {
        await this.refreshCsrf();
      }

      response = await fetchResponse();
    }

    return response;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { sessionVersion, tokenVersion } = this;
    const { protected: requiresSession } = options;
    const retryState = { csrfRetried: false };
    let response = await this.send(path, options, retryState);

    if (requiresSession && response.status === 401) {
      if (sessionVersion !== this.sessionVersion || this.isSessionEnded) {
        throw await this.parseError(response);
      }

      if (tokenVersion === this.tokenVersion) {
        if (this.pendingRotation?.sessionVersion !== sessionVersion) {
          const rotation = { sessionVersion, promise: Promise.resolve() };

          rotation.promise = (async () => {
            const rotateResponse = await this.send("/auth/token/rotate", {
              method: "POST",
              body: { fingerprint: this.readFingerprint() },
            });

            if (!rotateResponse.ok) {
              const error = await this.parseError(rotateResponse);

              if (
                sessionVersion === this.sessionVersion &&
                rotateResponse.status === 400
              ) {
                this.endSession();
              }

              throw error;
            }

            if (sessionVersion !== this.sessionVersion) {
              throw new Error("Session has ended.");
            }

            this.tokenVersion++;
          })().finally(() => {
            if (this.pendingRotation === rotation) {
              this.pendingRotation = undefined;
            }
          });
          this.pendingRotation = rotation;
        }

        await this.pendingRotation.promise;
      }

      if (sessionVersion !== this.sessionVersion || this.isSessionEnded) {
        throw new Error("Session has ended.");
      }

      response = await this.send(path, options, retryState);

      if (response.status === 401 && sessionVersion === this.sessionVersion) {
        this.endSession();

        throw await this.parseError(response);
      }
    }

    if (requiresSession && sessionVersion !== this.sessionVersion) {
      throw new Error("Session has ended.");
    }

    if (!response.ok) {
      throw await this.parseError(response);
    }

    const responseData =
      response.status === 204
        ? (undefined as T)
        : ((await response.json()) as T);

    if (requiresSession) {
      this.assertSession(sessionVersion);
    }

    return responseData;
  }
}
