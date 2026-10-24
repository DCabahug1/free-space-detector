import { test, expect } from "@playwright/test";

test("a visitor can switch between dark and light mode", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const root = page.locator("html");
  const darkModeButton = page.getByRole("button", { name: "Switch to dark theme" });

  // The test starts in light mode, then uses the same button a visitor does.
  await expect(darkModeButton).toBeVisible();
  await darkModeButton.click();

  await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

  // The choice should survive a refresh because next-themes saves it locally.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/);

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/);
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();
});
