import { expect, test, type Locator, type Page } from "@playwright/test";

const ROUTE_CASES = [
  { name: "cover", path: "meli-pu?ui=living-guide&theme=dan" },
  { name: "home", path: "meli-pu/home?ui=living-guide&theme=dan" },
  { name: "messages", path: "meli-pu/messages?ui=living-guide&theme=dan" },
  { name: "site map", path: "meli-pu/site-map?ui=living-guide&theme=dan" },
  { name: "more", path: "meli-pu/more?ui=living-guide&theme=dan" },
  { name: "stay grid", path: "meli-pu/s/stay?ui=living-guide&theme=dan" },
  { name: "offer grid", path: "meli-pu/s/offer?ui=living-guide&theme=dan" },
  { name: "explore", path: "meli-pu/s/explore?ui=living-guide&theme=dan" },
] as const;

async function settle(page: Page) {
  await page.locator(".lg2-app").waitFor({ state: "visible" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function activeView(page: Page): Promise<Locator> {
  const activeSheet = page.locator(".lg2-route-layer.v--det.on > .lg2-view");
  return (await activeSheet.count()) > 0
    ? activeSheet.last()
    : page.locator(".lg2-base-route-layer > .lg2-view").last();
}

async function assertNavigationInvariant(page: Page, context: string) {
  await expect
    .poll(
      async () => {
        const result = await page.locator(".lg2-app").evaluate((app) => {
          const held = app.querySelector(".lg2-base-route-layer--held");
          const activeSheet = app.querySelector(".lg2-route-layer.v--det.on");
          const active =
            activeSheet?.querySelector<HTMLElement>(":scope > .lg2-view") ??
            app.querySelector<HTMLElement>(
              ".lg2-base-route-layer > .lg2-view",
            );
          return {
            heldWithoutSheet: Boolean(held && !activeSheet),
            pointerEvents: active
              ? getComputedStyle(active).pointerEvents
              : "missing",
          };
        });
        return `${result.heldWithoutSheet}:${result.pointerEvents}`;
      },
      { message: `${context}: a held base must have an interactive sheet` },
    )
    .toBe("false:auto");
}

async function assertEndContentAboveNavigation(page: Page, context: string) {
  await expect
    .poll(
      async () =>
        page.locator(".lg2-app").evaluate(async (app) => {
          const active =
            app.querySelector<HTMLElement>(
              ".lg2-route-layer.v--det.on > .lg2-view",
            ) ??
            app.querySelector<HTMLElement>(
              ".lg2-base-route-layer > .lg2-view",
            );
          const navigation = app.querySelector<HTMLElement>(
            ":scope > .lg2-bottom-nav",
          );
          if (!active || !navigation) return "not-applicable";

          const candidates = [
            ...active.querySelectorAll<HTMLElement>(
              "[data-lg-scroll], .lg2-detail-sheet, .lg2-msg-sc",
            ),
          ];
          const scroller =
            candidates
              .filter((element) => {
                const overflowY = getComputedStyle(element).overflowY;
                return overflowY === "auto" || overflowY === "scroll";
              })
              .sort(
                (left, right) =>
                  right.scrollHeight -
                  right.clientHeight -
                  (left.scrollHeight - left.clientHeight),
              )[0] ?? null;
          if (!scroller) return "not-applicable";

          scroller.scrollTop = scroller.scrollHeight;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );

          const lastVisibleChild = [...scroller.children]
            .reverse()
            .find((child) => {
              const element = child as HTMLElement;
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              return (
                style.display !== "none" &&
                style.visibility !== "hidden" &&
                rect.width > 0 &&
                rect.height > 0
              );
            }) as HTMLElement | undefined;
          if (!lastVisibleChild) return "not-applicable";

          const lastBottom = lastVisibleChild.getBoundingClientRect().bottom;
          const navigationTop = navigation.getBoundingClientRect().top;
          return lastBottom <= navigationTop
            ? "clear"
            : `clipped:${(lastBottom - navigationTop).toFixed(2)}`;
        }),
      {
        message: `${context}: end content must clear the bottom navigation`,
      },
    )
    .toMatch(/^(clear|not-applicable)$/);
}

test("every Living Guide route and close leaves an interactive active view", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "Local WebKit cannot create an EGL page");

  for (const route of ROUTE_CASES) {
    await test.step(`direct route: ${route.name}`, async () => {
      await page.goto(route.path);
      await settle(page);
      await assertNavigationInvariant(page, route.name);
      await assertEndContentAboveNavigation(page, route.name);
    });
  }

  await test.step("home more opens and closes an interactive explore sheet", async () => {
    await page.goto("meli-pu/home?ui=living-guide&theme=dan&lang=sl");
    await settle(page);
    const home = page.getByTestId("screen-home");
    await expect(home).toHaveCSS("pointer-events", "auto");

    await home.getByRole("button", { name: /^več$/i }).click();
    await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
      "data-detail-transition",
      "open",
    );
    await assertNavigationInvariant(page, "home more open");
    await assertEndContentAboveNavigation(page, "home more open");
    await expect(home).toHaveCSS("pointer-events", "none");

    await page.getByTestId("explore-sheet-back").click();
    await expect(page.getByTestId("screen-home")).toHaveCSS(
      "pointer-events",
      "auto",
    );
    await assertNavigationInvariant(page, "home more close");
  });

  await test.step("category and item presentation close interactively", async () => {
    await page.goto("meli-pu/home?ui=living-guide&theme=dan");
    await settle(page);
    await page.getByRole("button", { name: /^WiFi$/i }).click();
    await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
      "data-detail-transition",
      "open",
    );
    await assertNavigationInvariant(page, "category open");
    await assertEndContentAboveNavigation(page, "category open");
    await page.locator(".lg2-route-layer.v--det .lg2-detail-back").click();
    await assertNavigationInvariant(page, "category close");

    const todayCard = page.locator(".lg2-hcard").first();
    await expect(todayCard).toBeVisible();
    await todayCard.click();
    await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
      "data-detail-transition",
      "open",
    );
    await assertNavigationInvariant(page, "item open");
    await assertEndContentAboveNavigation(page, "item open");
    await page.locator(".lg2-route-layer.v--det .lg2-detail-back").click();
    await assertNavigationInvariant(page, "item close");
  });

  await test.step("messages presentation closes interactively", async () => {
    await page.goto("meli-pu/home?ui=living-guide&theme=dan");
    await settle(page);
    await page.getByRole("button", { name: /^Sporočila$/i }).click();
    await expect(page.locator(".lg2-route-layer.v--det")).toHaveAttribute(
      "data-detail-transition",
      "open",
    );
    await assertNavigationInvariant(page, "messages open");
    await assertEndContentAboveNavigation(page, "messages open");
    await page.getByTestId("messages-back").click();
    await assertNavigationInvariant(page, "messages close");
  });

  await expect(await activeView(page)).toHaveCSS("pointer-events", "auto");
});