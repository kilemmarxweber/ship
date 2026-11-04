export type LegalSection = { title: string; body: string[] };

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Compte",
    body: [
      "Nous conservons identifiant, nom, téléphone / e-mail, langue, thème, et éventuellement documents KYC vendeur.",
      "Objectif : vous connecter, sécuriser le compte, payer et livrer.",
    ],
  },
  {
    title: "Commandes et portefeuille",
    body: [
      "Montants, statut, adresse de livraison, mouvements wallet (achats, retraits, ShipCash).",
      "Objectif : exécuter la vente, lutter contre la fraude, calculer commissions et récompenses. Ces journaux ne sont pas affichés aux autres acheteurs.",
    ],
  },
  {
    title: "Promotions ShipRewards",
    body: [
      "Pour une promo : produit, pourcentage, dates, prix avant / après, palier. Pour les points : solde boutique et historique de crédits.",
      "Public : nom de boutique, titre produit, ancien/nouveau prix, % de remise, badge palier.",
      "Privé : solde ShipPoints, ShipCash, quotas commission, raisons de clawback.",
    ],
  },
  {
    title: "Classements",
    body: [
      "Le classement hebdomadaire des meilleures offres agrège des volumes de ventes en promo. Il n’affiche pas l’identité des acheteurs.",
    ],
  },
  {
    title: "Cookies et appareil",
    body: [
      "Session, langue, thème, déverrouillage son du feed. Pas de revente de listes d’acheteurs à des annonceurs tiers dans le cadre de ce programme.",
    ],
  },
  {
    title: "Conservation et droits",
    body: [
      "Commandes et ledger financier : durée nécessaire au service, aux litiges et aux obligations comptables.",
      "Vous pouvez demander l’accès ou la correction de vos données de profil via l’application. La suppression de compte suit les CGU.",
    ],
  },
];

export const CGU_SECTIONS: LegalSection[] = [
  {
    title: "Objet",
    body: [
      "ShipShop est une marketplace. Les vendeurs publient des produits, les acheteurs paient via le portefeuille, l’argent est libéré à la réception.",
      "Le programme ShipRewards récompense les réductions créées dans l’application, selon la politique vendeur.",
    ],
  },
  {
    title: "Je cherche et traces de paiement",
    body: [
      "Accepter une offre Je cherche avec paiement ShipShop crée une commande identique à une vente boutique : solde bloqué, QR à la remise, commission 5 % à confirmation.",
      "Sans paiement ShipShop (espèces, virement direct), il n’y a pas de preuve sur la plateforme. Pas de trace = pas de remboursement ni de litige ShipShop.",
      "Le transport coursier est optionnel. S’il est choisi, le devis s’ajoute au total comme pour une commande boutique.",
    ],
  },
  {
    title: "Prix et promotions",
    body: [
      "Le prix vert affiché est le prix facturé. L’ancien prix barré n’est jamais débité.",
      "Seules les promotions créées via l’outil Réduction ouvrent des récompenses. Un simple changement de prix n’en ouvre pas.",
    ],
  },
  {
    title: "Abus",
    body: [
      "Faux rabais, auto-achat et fraudes entraînent clawback, suspension de promo ou du compte, selon gravité.",
    ],
  },
  {
    title: "Billets sur demande",
    body: [
      "ShipShop peut vendre des billets pour un artiste ou une organisation, à la demande, opéré uniquement par l’owner ou l’admin plateforme.",
      "Une commission (pourcentage ou montant fixe) est prélevée à l’achat et créditée au compte de revenu ShipShop. Le solde revient à l’organisateur après le début de l’événement.",
      "Le billet est non remboursable, sauf demande examinée par ShipShop ou annulation de l’événement. Un QR donne un accès unique. Après scan, aucun remboursement individuel.",
    ],
  },
];

export const SHIPREWARDS_SECTIONS: LegalSection[] = [
  {
    title: "Principe",
    body: [
      "ShipRewards récompense les vendeurs qui baissent un prix via l’outil Réduction dans l’application.",
      "Un simple changement de prix hors outil n’ouvre pas de points, ni de ShipCash.",
    ],
  },
  {
    title: "Ce que tu gagnes",
    body: [
      "Points boutique, visibilité dans le classement des meilleures offres, et ShipCash crédité à la livraison confirmée.",
      "Les paliers (volume, %) suivent la politique vendeur affichée dans l’outil Réduction.",
    ],
  },
  {
    title: "Abus",
    body: [
      "Faux rabais, auto-achat et fraudes entraînent clawback, suspension de promo ou du compte.",
    ],
  },
];

export const HELP_VENDOR_INDEX: LegalSection[] = [
  {
    title: "Boutique",
    body: [
      "Publiez un produit, gérez stock et prix, suivez les commandes et le QR de remise.",
      "Le client paie d’abord ; vous êtes crédité à la confirmation de réception.",
    ],
  },
  {
    title: "ShipRewards",
    body: [
      "Baissez un prix via l’outil Réduction : vous gagnez des points, de la visibilité, et du ShipCash à la livraison.",
      "Les réductions hors application ne comptent pas.",
    ],
  },
];
