import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.getByLabel("Email address").fill("test@example.com");

  await page.getByLabel("Password", { exact: true }).fill("Webhook123!");

  await page.getByRole("button", { name: "Sign in →" }).click();

  await expect(
    page.getByRole("heading", { name: "Webhooks", exact: true }),
  ).toBeVisible();
}

test("deep link, pagination, search, history, edit, reload and logout", async ({
  page,
  context,
}) => {
  await page.goto("/webhooks?page=2");

  await login(page);

  await expect(page.getByText("Page 2 of 3")).toBeVisible();

  const fingerprint = await page.evaluate(() =>
    localStorage.getItem("webhook.fingerprint"),
  );

  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Page 3 of 3")).toBeVisible();

  await page.goBack();

  await expect(page.getByText("Page 2 of 3")).toBeVisible();

  await page.goForward();

  await expect(page.getByText("Page 3 of 3")).toBeVisible();

  await page.getByLabel("Search by name").fill("ORDER");

  await expect(page.getByText("4 webhooks", { exact: true })).toBeVisible();

  await expect(page).toHaveURL(/page=1&search=ORDER/);

  await page.goBack();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Search by name")).toHaveValue("");
  await page.goForward();
  await expect(page.getByLabel("Search by name")).toHaveValue("ORDER");

  await page.getByRole("link", { name: /Edit Order created 1/ }).click();

  await page.getByLabel("Name", { exact: true }).fill("Unsaved name");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/page=1&search=ORDER/);
  await expect(
    page.getByRole("row", { name: /Order created 1 https/ }),
  ).toBeVisible();
  await expect(page.getByText("Unsaved name", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: /Edit Order created 1/ }).click();

  await page.getByLabel("Name", { exact: true }).fill("Order renamed");

  await page
    .getByLabel("Endpoint URL")
    .fill("https://updated.example.com/hook");

  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Webhook saved successfully.",
  );

  await page.getByRole("link", { name: "Back to webhooks" }).click();

  await expect(
    page.getByRole("row", { name: /Order renamed https/ }),
  ).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: "Sign in →" })).toBeVisible();

  await login(page);

  await expect(page.getByLabel("Search by name")).toHaveValue("ORDER");

  expect(
    await page.evaluate(() => localStorage.getItem("webhook.fingerprint")),
  ).toBe(fingerprint);

  const tab = await context.newPage();

  await tab.goto("/webhooks?page=2&search=");

  await login(tab);

  await expect(tab.getByText("Page 2 of 3")).toBeVisible();

  await tab.getByRole("button", { name: "Clear all filters" }).click();

  await expect(tab).toHaveURL(/\/webhooks$/);

  await expect(tab.getByText("Page 1 of 3")).toBeVisible();

  await tab.close();

  expect(await context.cookies()).toEqual([]);

  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    "webhook.fingerprint",
  ]);

  await page.getByRole("button", { name: "Clear all filters" }).click();

  await expect(page.getByLabel("Search by name")).toHaveValue("");

  await expect(page).toHaveURL(/\/webhooks$/);

  await expect(page.getByText("28 webhooks", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page.getByRole("button", { name: "Sign in →" })).toBeVisible();

  await page.goBack();

  await expect(page.getByRole("table")).toHaveCount(0);
});

test("debounces search, keeps input focus and cancels pending search on clear", async ({
  page,
}) => {
  await page.goto("/webhooks");
  await login(page);
  await expect(page.getByText("28 webhooks", { exact: true })).toBeVisible();
  let searches = 0;

  page.on("request", (request) => {
    if (request.url().includes("/v1/webhooks?")) {
      searches++;
    }
  });
  const input = page.getByLabel("Search by name");

  await input.pressSequentially("ORDER", { delay: 20 });
  await expect(page.getByText("4 webhooks", { exact: true })).toBeVisible();
  expect(searches).toBe(1);
  await expect(input).toBeFocused();
  await input.fill("nonexistent");
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await expect(input).toHaveValue("");
  await expect(page).toHaveURL(/\/webhooks$/);
  await expect(page.getByText("28 webhooks", { exact: true })).toBeVisible();
  // Let the previous debounce deadline pass to prove it cannot restore the search.
  await page.waitForTimeout(350);
  await expect(page).toHaveURL(/\/webhooks$/);
});

test("real 30-second expiry rotates once for parallel browser requests", async ({
  page,
}) => {
  test.setTimeout(60_000);

  let rotates = 0;

  page.on("request", (request) => {
    if (request.url().endsWith("/auth/token/rotate")) {
      rotates++;
    }
  });

  await page.goto("/webhooks");

  await login(page);

  await page.waitForTimeout(30_100);

  const result = await page.evaluate(async () => {
    const { api } = await import("/src/api/index.ts" as string);

    return await Promise.all([
      api.request("/v1/me", { protected: true }),
      api.request("/v1/webhooks?limit=10&page=1", { protected: true }),
    ]);
  });

  expect(result[0]).toMatchObject({ id: 1 });

  expect(result[1].data).toHaveLength(10);

  expect(rotates).toBe(1);
});

test("wrong password, empty state, missing endpoint and mobile layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/login");

  await page.getByLabel("Email address").fill("test@example.com");

  await page.getByLabel("Password", { exact: true }).fill("wrong");

  await page.getByRole("button", { name: "Sign in →" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Email or password is incorrect.",
  );

  await login(page);

  await page.getByLabel("Search by name").fill("nonexistent");

  await expect(
    page.getByRole("heading", { name: "No webhooks found" }),
  ).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.goto("/webhooks/999");

  await page.getByLabel("Email address").fill("test@example.com");

  await page.getByLabel("Password", { exact: true }).fill("Webhook123!");

  await page.getByRole("button", { name: "Sign in →" }).click();

  await expect(
    page.getByText("Webhook not found.", { exact: true }),
  ).toBeVisible();
});
