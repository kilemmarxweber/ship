import { expect, test } from "@playwright/test";

const shopWeb = process.env.SHOP_WEB_URL ?? "http://localhost:3000";
const expoWeb = process.env.EXPO_WEB_URL ?? "http://localhost:8081";

test.describe("ShipShop MVP+ smoke (Chrome)", () => {
  test("shop Analytics admin charge", async ({ page }) => {
    const res = await page.goto(`${shopWeb}/shops/admin/analytics`, {
      waitUntil: "domcontentloaded",
    });
    expect(res).not.toBeNull();
    await expect(
      page
        .getByText(
          /Analytics|A\/B Lift|Rétention|Réservé|owner|Se connecter|connexion/i,
        )
        .first(),
    ).toBeVisible({ timeout: 45_000 });
  });

  test("API AI chat exige auth", async ({ request }) => {
    const res = await request.post(`${shopWeb}/api/ai/chat`, {
      data: { message: "smartphone" },
    });
    expect(res.status()).toBe(401);
  });

  test("API admin analytics exige auth", async ({ request }) => {
    const res = await request.get(`${shopWeb}/api/admin/analytics`);
    expect([401, 403]).toContain(res.status());
  });

  test("Expo web Accueil si dispo", async ({ page }) => {
    test.skip(
      !(await page
        .goto(expoWeb, { waitUntil: "domcontentloaded", timeout: 12_000 })
        .then((r) => Boolean(r && (r.ok() || r.status() === 304)))
        .catch(() => false)),
      "Expo web non joignable",
    );
    await expect(page.locator("body")).toBeVisible();
  });
});
