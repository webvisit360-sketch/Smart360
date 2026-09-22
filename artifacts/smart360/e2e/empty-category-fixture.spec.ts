import { expect, test } from "@playwright/test";

test("shared empty row has exact computed styles and transitions to populated host branch", async ({ page }) => {
  await page.goto("/e2e/empty-category-harness.html");

  const emptyRows = page.getByTestId(/^row-empty-category-fixture-/);
  await expect(emptyRows).toHaveCount(3);
  await expect(page.getByTestId("button-add-empty-category-fixture-house")).toContainText("Dodaj vnos");
  await expect(page.getByTestId("button-add-empty-category-fixture-offer")).toContainText("Dodaj ponudbo");
  await expect(page.getByTestId("button-add-empty-category-fixture-explore")).toContainText("Dodaj kraj");

  const dimensions = await page.getByTestId("row-empty-category-fixture-explore").evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      borderRadius: style.borderRadius,
      borderWidth: style.borderWidth,
      height: rect.height,
    };
  });
  expect(dimensions).toEqual({
    backgroundColor: "rgb(255, 255, 255)",
    borderColor: "rgb(232, 235, 230)",
    borderRadius: "10px",
    borderWidth: "1px",
    height: 46,
  });

  await page.getByTestId("button-add-empty-category-fixture-explore").click();
  await expect(page.getByTestId("fixture-input")).toBeVisible();
  await expect(page.getByTestId("fixture-count")).toContainText("0 krajev");

  await page.getByTestId("fixture-dashed-add").click();
  await expect(page.getByTestId("fixture-input")).toBeVisible();
  await expect(page.getByTestId("fixture-count")).toContainText("0 krajev");

  await page.getByTestId("fixture-input").fill("Blejsko jezero");
  await page.getByTestId("fixture-dashed-add").click();
  await expect(page.getByTestId("fixture-item")).toHaveText(/Blejsko jezero/);
  await expect(page.getByTestId("fixture-count")).toContainText("1 krajev");
  await expect(page.getByTestId("fixture-input")).toHaveCount(0);
  await expect(page.getByTestId("fixture-dashed-add")).toBeVisible();

  await page.screenshot({
    path: "reports/empty-category-fixture-transition.png",
    fullPage: true,
  });
});