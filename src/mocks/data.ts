import type { User, Webhook } from "../domain/types";

export const demoUser: User = {
  id: 1,
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  name: "Test User",
};

export const demoPassword = "Webhook123!";

export const createWebhooks = (): Webhook[] =>
  Array.from({ length: 28 }, (_, index) => ({
    id: index + 1,
    name: `${["Order created", "Payment received", "Customer updated", "Subscription renewed", "Invoice paid", "Shipment dispatched", "Account verified"][index % 7]} ${Math.floor(index / 7) + 1}`,
    url: `https://example.com/hooks/${index + 1}`,
    active: index % 4 !== 0,
    created_at: "2026-01-01T12:00:00Z",
  }));
