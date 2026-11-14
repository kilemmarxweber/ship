import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const expoWeb = process.env.EXPO_WEB_URL ?? "http://localhost:8081";
const assetsDir = path.join(process.cwd(), "assets", "images", "maquette");

test.describe("Maquette Je cherche", () => {
  test("assets Wanted présents", () => {
    for (const name of ["wanted-headphones.png", "wanted-airpods.png"]) {
      const file = path.join(assetsDir, name);
      expect(fs.existsSync(file), name).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(800);
    }
  });

  test("Expo web Accueil expose onglet Je cherche si dispo", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const ok = await page
      .goto(expoWeb, { waitUntil: "domcontentloaded", timeout: 12_000 })
      .then((r) => Boolean(r && (r.ok() || r.status() === 304)))
      .catch(() => false);
    test.skip(!ok, "Expo web non joignable");

    await expect(page.getByText("Je cherche").first()).toBeVisible({
      timeout: 45_000,
    });
    await page.getByText("Je cherche").first().click();
    await expect(page.getByText(/Publiez ce que vous/).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Créer une demande").first()).toBeVisible();
    await expect(page.getByText("Mes demandes").first()).toBeVisible();
    await expect(page.getByText("Offres reçues").first()).toBeVisible();
  });

  test("parcours guidé et comparaison sont présents dans le code livré", () => {
    const publish = fs.readFileSync(
      path.join(process.cwd(), "components", "publish", "WantedFlow.tsx"),
      "utf8",
    );
    const detail = fs.readFileSync(
      path.join(
        process.cwd(),
        "components",
        "wanted",
        "WantedDetailScreen.tsx",
      ),
      "utf8",
    );
    const home = fs.readFileSync(
      path.join(process.cwd(), "components", "wanted", "WantedHomePane.tsx"),
      "utf8",
    );

    expect(publish).toContain('["Besoin", "Budget", "Lieu"]');
    expect(publish).toContain("Publier la demande");
    expect(detail).toContain('["PRICE", "Prix"]');
    expect(detail).toContain("Discuter avec le vendeur");
    expect(home).toContain("Demandes près de vous");
    expect(home).toContain("publicFilter");
  });
});
