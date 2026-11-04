import { useLocalSearchParams } from "expo-router";

import { AttentionKpiScreen } from "@/components/seller/admin/AttentionKpiScreen";
import { ChallengesAdminScreen } from "@/components/seller/admin/ChallengesAdminScreen";
import { ContentAdminScreen } from "@/components/seller/admin/ContentAdminScreen";
import { ExpansionAdminScreen } from "@/components/seller/admin/ExpansionAdminScreen";
import { ModerationAdminScreen } from "@/components/seller/admin/ModerationAdminScreen";
import { PartnerCampaignsScreen } from "@/components/seller/admin/PartnerCampaignsScreen";
import { SellerAdminScreen } from "@/components/seller/SellerAdminScreen";

export default function ShopAdminRoute() {
  const params = useLocalSearchParams<{ page?: string }>();
  const page = typeof params.page === "string" ? params.page : "products";

  if (page === "campaigns") return <PartnerCampaignsScreen />;
  if (page === "challenges") return <ChallengesAdminScreen />;
  if (page === "content") return <ContentAdminScreen />;
  if (page === "attention") return <AttentionKpiScreen />;
  if (page === "expansion") return <ExpansionAdminScreen />;
  if (page === "moderation") return <ModerationAdminScreen />;

  return <SellerAdminScreen />;
}
