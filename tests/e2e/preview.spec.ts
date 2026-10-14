import { expect, test } from "@playwright/test";

test("production preview provides CSRF and signs in", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email address").fill("test@example.com");

  await page.getByLabel("Password", { exact: true }).fill("Webhook123!");

  await page.getByRole("button", { name: "Sign in →" }).click();

  await expect(
    page.getByRole("heading", { name: "Webhooks", exact: true }),
  ).toBeVisible();
});
