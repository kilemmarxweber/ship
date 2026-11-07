import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = [
  "components/seller/admin/ChallengesAdminScreen.tsx",
  "components/creator/CreatorStudioScreen.tsx",
  "components/live/LiveScreen.tsx",
  "components/ar/ArStudioScreen.tsx",
  "components/seller/SellerProductsScreen.tsx",
  "components/live/LiveListScreen.tsx",
  "app/product/[id].tsx",
  "components/shop/ShopPublicScreen.tsx",
  "components/profile/ProfileScreen.tsx",
  "components/events/EventScreen.tsx",
  "components/tickets/TicketsScreen.tsx",
  "components/seller/admin/ExpansionAdminScreen.tsx",
  "components/seller/admin/ModerationAdminScreen.tsx",
  "components/seller/admin/ContentAdminScreen.tsx",
  "components/seller/admin/AttentionKpiScreen.tsx",
  "components/seller/admin/PartnerCampaignsScreen.tsx",
  "components/seller/SellerMessagingScreen.tsx",
  "components/seller/SellerAdminScreen.tsx",
  "components/seller/SellerDeliveryScreen.tsx",
  "components/seller/SellerKycAdminScreen.tsx",
  "components/seller/SellerOrdersScreen.tsx",
  "components/seller/SellerContactsScreen.tsx",
  "components/seller/SellerShopsScreen.tsx",
  "components/seller/SellerReportsScreen.tsx",
  "components/wanted/WantedDetailScreen.tsx",
  "components/wallet/WalletScreen.tsx",
  "components/tickets/TicketPassScreen.tsx",
  "components/profile/TicketScanScreen.tsx",
  "components/kyc/KycScreen.tsx",
  "components/legal/LegalArticle.tsx",
  "components/growth/CommunityScreen.tsx",
  "components/courier/CourierScreen.tsx",
  "components/orders/OrderScreen.tsx",
  "components/orders/OrdersListScreen.tsx",
  "components/orders/TicketScreen.tsx",
];

const importLine = 'import { safeBack } from "@/src/nav";\n';

for (const rel of files) {
  const file = path.join(root, rel);
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  src = src.replace(
    /if \(router\.canGoBack\(\)\) router\.back\(\);(\s*else router\.replace\([^)]+\);)?/g,
    "safeBack();",
  );
  src = src.replace(/router\.back\(\)/g, "safeBack()");
  if (src === before) continue;
  if (!src.includes("@/src/nav")) {
    if (/from ["']expo-router["'];?\r?\n/.test(src)) {
      src = src.replace(/(from ["']expo-router["'];?\r?\n)/, `$1${importLine}`);
    } else {
      src = importLine + src;
    }
  }
  fs.writeFileSync(file, src);
  console.log("updated", rel);
}
