import { chromium } from "@playwright/test";

const base = process.env.EXPO_WEB_URL ?? "http://localhost:8081";

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

async function mockAndOpen(page, product) {
  await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => {});
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
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
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

  const followA = await page.getByLabel(/Suivre Boutique Demo/i).count();
  const sendA = await page.getByLabel(/Écrire à Boutique Demo/i).count();
  const shopA = await page
    .getByLabel(/Ouvrir la boutique Boutique Demo/i)
    .count();
  const likeA = await page.getByText("12").count();
  const followersA = await page.getByText("42").count();

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

  const followB = await page.getByLabel(/Suivre Boutique Suivie/i).count();
  const sendB = await page.getByLabel(/Écrire à Boutique Suivie/i).count();
  let sendOpensAuth = false;
  if (sendB > 0) {
    await page
      .getByLabel(/Écrire à Boutique Suivie/i)
      .first()
      .click({ force: true });
    await page.waitForTimeout(800);
    sendOpensAuth = /Se connecter/i.test(
      await page.locator("body").innerText(),
    );
  }

  const tabs = {
    pourToi: await page.getByText("Pour toi").count(),
    abonnements: await page.getByText("Abonnements").count(),
  };

  const pass =
    followA === 1 &&
    sendA === 0 &&
    shopA >= 1 &&
    likeA >= 1 &&
    followersA >= 1 &&
    followB === 0 &&
    sendB === 1 &&
    sendOpensAuth &&
    tabs.pourToi >= 1 &&
    tabs.abonnements >= 1;

  const result = {
    pass,
    caseA: {
      follow: followA,
      send: sendA,
      shop: shopA,
      like: likeA,
      followers: followersA,
    },
    caseB: { follow: followB, send: sendB, sendOpensAuth },
    tabs,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
} finally {
  await browser.close();
}
