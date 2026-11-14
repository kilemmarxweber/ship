import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const expoWeb = process.env.EXPO_WEB_URL ?? "http://localhost:8081";
const assetsDir = path.join(process.cwd(), "assets", "images", "maquette");

test.describe("Maquette IA Chat + Je cherche assets", () => {
  test("assets maquette présents (robot, casque, airpods)", () => {
    for (const name of [
      "ia-robot.png",
      "ia-icon-0.png",
      "ia-icon-1.png",
      "ia-icon-2.png",
      "wanted-headphones.png",
      "wanted-airpods.png",
    ]) {
      const file = path.join(assetsDir, name);
      expect(fs.existsSync(file), name).toBe(true);
      expect(fs.statSync(file).size).toBeGreaterThan(800);
    }
  });

  test("Expo web IA Chat affiche empty state maquette si dispo", async ({
    page,
  }) => {
    const ok = await page
      .goto(`${expoWeb}/ai-chat`, {
        waitUntil: "domcontentloaded",
        timeout: 12_000,
      })
      .then((r) => Boolean(r && (r.ok() || r.status() === 304)))
      .catch(() => false);
    test.skip(!ok, "Expo web non joignable");

    await expect(page.getByText("IA Chat").first()).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText("Bonjour !").first()).toBeVisible();
    await expect(
      page.getByText("Je suis votre assistant").first(),
    ).toBeVisible();
    await expect(page.getByText(/ShipShop/).first()).toBeVisible();
    await expect(page.getByText(/meilleur/).first()).toBeVisible();
    await expect(page.getByText(/robes/).first()).toBeVisible();
    await expect(page.getByText(/trouver/).first()).toBeVisible();
    await expect(page.getByPlaceholder("Écrivez votre message…")).toBeVisible();
  });
});
