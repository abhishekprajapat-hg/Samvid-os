import { expect } from "@playwright/test";

export const installFailureGuards = (
  page,
  { allowServerErrors = false, allowConsolePatterns = [] } = {},
) => {
  const consoleErrors = [];
  const pageErrors = [];
  const serverErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (!allowServerErrors && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  return async () => {
    const unexpectedConsoleErrors = consoleErrors.filter((message) =>
      !allowConsolePatterns.some((pattern) => pattern.test(message)),
    );
    expect(pageErrors, "unexpected page errors").toEqual([]);
    expect(unexpectedConsoleErrors, "unexpected console errors").toEqual([]);
    expect(serverErrors, "unexpected API 500 responses").toEqual([]);
  };
};
