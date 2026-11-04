import { LegalArticle } from "@/components/legal/LegalArticle";
import { SHIPREWARDS_SECTIONS } from "@/src/legal";

export default function ShipRewardsRoute() {
  return (
    <LegalArticle
      title="Programme ShipRewards"
      intro="Baisse un prix via l’outil Réduction : points, visibilité, ShipCash à la livraison. Les baisses hors app ne comptent pas."
      sections={SHIPREWARDS_SECTIONS}
    />
  );
}
