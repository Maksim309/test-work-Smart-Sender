// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WebhookForm } from "../src/components/WebhookForm";
import { ApiError } from "../src/api/client";

afterEach(cleanup);

it("blocks invalid form values and waits for API acknowledgement before success", async () => {
  const user = userEvent.setup();
  let acknowledge!: () => void;
  const onSave = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );

  render(
    <WebhookForm
      initial={{ name: "", url: "ftp://example.com" }}
      onSave={onSave}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Save changes" }));

  expect(onSave).not.toHaveBeenCalled();

  expect(screen.getByText("Name is required.")).toBeTruthy();

  await user.type(screen.getByLabelText("Name"), "New endpoint");

  await user.clear(screen.getByLabelText("Endpoint URL"));

  await user.type(screen.getByLabelText("Endpoint URL"), "https://example.com");

  await user.click(screen.getByRole("button", { name: "Save changes" }));

  expect(screen.queryByRole("status")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Saving…" }).hasAttribute("disabled"),
  ).toBe(true);
  await act(async () => acknowledge());
  expect(await screen.findByRole("status")).toBeTruthy();

  expect(onSave).toHaveBeenCalledWith({
    name: "New endpoint",
    url: "https://example.com",
  });
});

it("maps server validation to the field without reporting success", async () => {
  const user = userEvent.setup();

  render(
    <WebhookForm
      initial={{ name: "Test", url: "https://example.com" }}
      onSave={vi.fn().mockRejectedValue(
        new ApiError(422, {
          error: {
            type: "ValidationException",
            message: "Invalid",
            payload: { url: ["Server rejected URL."] },
          },
        }),
      )}
    />,
  );

  await user.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Server rejected URL.")).toBeTruthy();

  expect(screen.queryByRole("status")).toBeNull();
});
