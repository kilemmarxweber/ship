import { LegalArticle } from "@/components/legal/LegalArticle";
import { HELP_VENDOR_INDEX } from "@/src/legal";

export default function HelpVendorRoute() {
  return (
    <LegalArticle
      title="Aide vendeur"
      intro="Publiez, livrez, puis encaissez à la confirmation de réception. Les récompenses passent par l’outil Réduction dans l’app."
      sections={HELP_VENDOR_INDEX}
    />
  );
}
