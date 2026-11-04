import { LegalArticle } from "@/components/legal/LegalArticle";
import { CGU_SECTIONS } from "@/src/legal";

export default function CguRoute() {
  return (
    <LegalArticle
      title="Conditions d’usage"
      intro="En utilisant ShipShop, vous acceptez ces règles. Le programme ShipRewards s’applique aux vendeurs qui créent une réduction dans l’application."
      sections={CGU_SECTIONS}
    />
  );
}
