import fs from "node:fs";

const files = [
  "components/creator/CreatorStudioScreen.tsx",
  "components/legal/LegalArticle.tsx",
  "components/seller/admin/AttentionKpiScreen.tsx",
  "components/seller/admin/ChallengesAdminScreen.tsx",
  "components/seller/admin/ContentAdminScreen.tsx",
  "components/seller/admin/ExpansionAdminScreen.tsx",
  "components/seller/admin/ModerationAdminScreen.tsx",
  "components/seller/admin/PartnerCampaignsScreen.tsx",
  "components/seller/admin/VendorsAdminScreen.tsx",
  "components/seller/SellerAdminScreen.tsx",
  "components/seller/SellerContactsScreen.tsx",
  "components/seller/SellerDeliveryScreen.tsx",
  "components/seller/SellerKycAdminScreen.tsx",
  "components/seller/SellerMessagingScreen.tsx",
  "components/seller/SellerOrdersScreen.tsx",
  "components/seller/SellerProductsScreen.tsx",
  "components/seller/SellerReportsScreen.tsx",
  "components/seller/SellerShopsScreen.tsx",
];

const root = "C:/Users/kilemmarxweber/Desktop/ShipShop/";
for (const rel of files) {
  const file = root + rel;
  let src = fs.readFileSync(file, "utf8");
  if (/\bt\(/.test(src)) {
    console.log("SKIP used", rel);
    continue;
  }
  const next = src
    .replace(/\r?\nimport \{ useT \} from "@\/src\/i18n";/, "")
    .replace(/\r?\n[ \t]*const t = useT\(\);/, "");
  if (next === src) {
    console.log("NO CHANGE", rel);
    continue;
  }
  if (next.includes("useT")) {
    console.log("STILL HAS useT", rel);
    continue;
  }
  fs.writeFileSync(file, next);
  console.log("cleaned", rel);
}
