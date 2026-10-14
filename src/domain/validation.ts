import type { FieldErrors, WebhookInput } from "./types";

export function validateWebhook(input: WebhookInput): FieldErrors {
  const { name, url: endpointUrl } = input;
  const errors: FieldErrors = {};

  if (!name.trim()) {
    errors.name = ["Name is required."];
  }

  try {
    const url = new URL(endpointUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    errors.url = ["Enter a valid HTTP or HTTPS URL."];
  }

  return errors;
}

export function listParameters(filters: URLSearchParams) {
  const requestedPage = Number(filters.get("page") ?? 1);

  return {
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    search: filters.get("search") ?? "",
  };
}
