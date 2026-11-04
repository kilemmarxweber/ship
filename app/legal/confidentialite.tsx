import { LegalArticle } from "@/components/legal/LegalArticle";
import { PRIVACY_SECTIONS } from "@/src/legal";

export default function PrivacyRoute() {
  return (
    <LegalArticle
      title="Confidentialité"
      intro="Ce texte décrit quelles données nous utilisons, pourquoi, et ce qui est public. Ce n’est pas un substitut aux obligations légales locales ; c’est le mode d’emploi lisible."
      sections={PRIVACY_SECTIONS}
    />
  );
}
