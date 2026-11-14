import { expect, test } from "@playwright/test";

const expoWeb = process.env.EXPO_WEB_URL ?? "http://localhost:8081";

const baseProduct = {
  description: "Desc",
  priceCents: 4500,
  currency: "EUR",
  status: "ACTIVE",
  quantity: 10,
  soldCount: 0,
  images: ["https://picsum.photos/seed/shipshop/720/1280.jpg"],
  colors: ["#111111"],
  sizes: ["M"],
  likesCount: 12,
  commentsCount: 3,
  sharesCount: 1,
  viewsCount: 100,
  likedByMe: false,
};

async function mockAndOpen(
  page: import("@playwright/test").Page,
  product: Record<string, unknown>,
) {
  await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
  await page.route(/localhost:3000\/api\//, async (route) => {
    const url = route.request().url();
    if (url.includes("/api/products")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ products: [product], nextCursor: null }),
      });
    }
    if (url.includes("/follow")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ followedByMe: true, followersCount: 43 }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        challenges: [],
        lives: [],
        templates: [],
        conversation: { id: "c1" },
      }),
    });
  });
  await page.goto(expoWeb, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
}

test.describe("Feed rail Accueil (Chrome)", () => {
  test("btn + / send / like / followers / tabs", async ({ page }) => {
    test.skip(
      !(await page
        .goto(expoWeb, { waitUntil: "domcontentloaded", timeout: 12_000 })
        .then((r) => Boolean(r && (r.ok() || r.status() === 304)))
        .catch(() => false)),
      "Expo web non joignable",
    );

    await mockAndOpen(page, {
      ...baseProduct,
      id: "p-test-1",
      title: "Robe test",
      shop: {
        id: "shop-1",
        slug: "boutique-demo",
        name: "Boutique Demo",
        logoUrl: null,
        verified: true,
        followedByMe: false,
        followersCount: 42,
        ownerUserId: "owner-1",
      },
    });

    await expect(page.getByLabel(/Suivre Boutique Demo/i)).toHaveCount(1);
    await expect(page.getByLabel(/Écrire à Boutique Demo/i)).toHaveCount(0);
    await expect(
      page.getByLabel(/Ouvrir la boutique Boutique Demo/i).first(),
    ).toBeVisible();
    await expect(page.getByText("12").first()).toBeVisible();
    await expect(page.getByText("42").first()).toBeVisible();

    await mockAndOpen(page, {
      ...baseProduct,
      id: "p-test-2",
      title: "Robe abonnee",
      images: ["https://picsum.photos/seed/shipshop2/720/1280.jpg"],
      shop: {
        id: "shop-2",
        slug: "boutique-suivie",
        name: "Boutique Suivie",
        logoUrl: null,
        verified: true,
        followedByMe: true,
        followersCount: 99,
        ownerUserId: "owner-2",
      },
    });

    await expect(page.getByLabel(/Suivre Boutique Suivie/i)).toHaveCount(0);
    await expect(page.getByLabel(/Écrire à Boutique Suivie/i)).toHaveCount(1);
    await page
      .getByLabel(/Écrire à Boutique Suivie/i)
      .first()
      .click({ force: true });
    await expect(page.getByText(/Se connecter/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Pour toi")).toBeVisible();
    await expect(page.getByText("Abonnements")).toBeVisible();
  });
});
