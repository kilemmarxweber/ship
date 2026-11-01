# Termes de référence — ShipShop Android et iOS

Version 1.0 — 1er novembre 2026

## 1. Objet

Construire l’application native ShipShop pour Android et iOS. Elle reprend l’identité des deux maquettes de `docs/design/` et consomme le backend déjà en production de développement dans le dépôt web `shop` (Next.js 16, Prisma, Postgres).

Le site n’est pas réécrit. L’application n’est pas une WebView du site.

## 2. Contexte

ShipShop est une place de marché vidéo pour la RDC : fil vertical de produits, lives, commandes, portefeuille et mobile money (Orange, Airtel, M-Pesa) via CinetPay. Le backend, les comptes, le catalogue, les commandes, les paiements, la publicité et les API existent. L’application native est une nouvelle interface sur ce socle.

Services déjà branchés côté serveur, réutilisés tels quels :

- Postgres, Better Auth, fichiers uploadés, FFmpeg, modération d’images optionnelle
- Caisses mobile money et e-mail transactionnel
- Sanity pour le contenu éditorial
- LiveKit Cloud pour les directs
- CinetPay, pays `CD`, méthodes `OM_CD`, `AIRTEL_CD`, `MPESA_CD`

Les secrets (CinetPay, LiveKit, SMTP, Sanity, base de données) restent dans l’environnement du serveur. L’application ne reçoit qu’une URL d’API, `EXPO_PUBLIC_API_URL`.

## 3. Objectifs

- Offrir une expérience proche d’une application native : vidéo plein écran, gestes, 60 images par seconde quand l’appareil le permet.
- Reproduire la disposition des deux maquettes, avec les données réelles du catalogue.
- Couvrir, dans le même binaire, les rôles acheteur, vendeur, livreur et admin.
- Encaisser via les API CinetPay déjà en place, sans embarquer les clés dans l’application.

## 4. Périmètre

Une seule application Expo. La navigation change selon le rôle.

| Espace | Contenu |
| --- | --- |
| Acheteur | Pour toi, Abonnements, Recherche, live en trois états, likes, commentaires, partage, suivi, fiche et variantes, panier, commandes, portefeuille, messages, profil, demandes wanted, communauté |
| Vendeur | Publication, boutique, commandes, livraison, rapports, contacts, KYC, cadeaux. En direct, le diffuseur affiche ou retire sa liste de produits pour toute la room |
| Livreur | Missions, départ, position |
| Admin | Vendeurs, produits, modération, grand livre, zones de livraison, campagnes, défis, contenu, attention, expansion |

Sanity Studio reste sur le web. L’admin mobile appelle `/api/admin/*`. Les écrans `/shops/admin` ne sont pas recopiés dans une WebView.

## 5. Hors périmètre de cette version de cadrage

- Nouveau backend, nouvelle base, nouvel agrégateur de paiement.
- Clés CinetPay, LiveKit, SMTP ou Sanity dans le binaire ou dans le dépôt mobile.
- Infrastructure de direct maison. Les lives passent par LiveKit, déjà intégré au serveur.
- Parité visuelle du site web actuel. La référence visuelle est `docs/design/`, pas les écrans Next.js.

## 6. Acteurs

- Acheteur : regarde, suit, commente, achète, paie, échange avec un vendeur.
- Vendeur : publie, répond, prépare les commandes, passe en direct et présente ses produits.
- Livreur : exécute les courses qui lui sont assignées.
- Admin plateforme : modère, suit le grand livre, pilote campagnes et livraison.
- Serveur ShipShop : seule partie qui parle à CinetPay, LiveKit et Postgres.

## 7. Contraintes

- Devises : CDF, USD, et KW déjà gérées par `formatMoney` côté serveur. Les montants API sont en centimes.
- Mobile money RDC uniquement via les routes portefeuille existantes. L’application ouvre l’URL de paiement renvoyée par `POST /api/wallet/deposit`, puis interroge `GET /api/payments/cinetpay/status`. Le crédit du portefeuille est fait par `POST /api/payments/cinetpay/notify`, appelé par CinetPay, jamais par le téléphone.
- Session : Better Auth émet un jeton `set-auth-token`. L’application le stocke et l’envoie en `Authorization: Bearer`. Les routes métier reconnaissent ce jeton. Le cookie web continue de fonctionner.
- Origines de confiance : URL du site, `http://localhost:8081`, schémas `shipshop://` et `exp://`. Liste complémentaire possible via `BETTER_AUTH_TRUSTED_ORIGINS`.
- Réseau mobile : une seule vidéo décodée à la fois, préchargement de la suivante, pause quand on quitte le fil, cache des pages déjà chargées.
- Accessibilité : cibles tactiles d’au moins 44 points, contrastes lisibles sur la vidéo, libellés pour les boutons icône.

## 8. Architecture

```
ShipShop (Expo, TypeScript)
  Expo Router, expo-video, Reanimated, Gesture Handler
  FlashList, expo-image, TanStack Query, Zustand
        |  Authorization: Bearer
        v
Next.js shop  --->  Postgres
        |--->  CinetPay (clés serveur, webhook)
        |--->  LiveKit (jeton émis par le serveur)
        |--->  uploads, e-mail, Sanity
```

Stack imposée : React Native, TypeScript, Expo Router, expo-video, Reanimated, Gesture Handler, FlashList, expo-image, TanStack Query, Zustand, Expo Notifications. `expo-dev-client` est prévu parce que le direct LiveKit et la lecture plein écran dépassent Expo Go.

## 9. Critères d’acceptation

1. Les documents de ce dossier et les deux maquettes sont la référence de recette visuelle.
2. L’écran Pour toi affiche le fil `GET /api/products?status=ACTIVE`, en pages, avec lecture de la vidéo visible, rail d’actions, carte prix et bouton Acheter.
3. Glisser vers le haut charge le produit suivant. Une seule vidéo joue. La suivante est préparée.
4. Like, commentaire, partage et suivi appellent les routes déjà existantes. Sans session, l’application demande une connexion et conserve le jeton.
5. Le site web continue de se connecter par cookie. Les secrets CinetPay ne figurent pas dans `ShipShop`.
6. Les modules suivants (recherche, panier, portefeuille, messages, live à trois états, espaces vendeur, livreur, admin) sont décrits au PDR et s’ajoutent sans changer de backend.

## 10. Phasage

1. Socle Expo, design system, client API, session bearer. Écran Pour toi calé sur `docs/design/pour-toi.jpg`.
2. Abonnements, Recherche, fiche produit, panier, commandes.
3. Portefeuille et parcours CinetPay (navigateur de paiement, retour `shipshop://` si le schéma est autorisé, sinon URL web, puis lecture du statut).
4. Messages, profil, notifications.
5. Live calé sur `docs/design/live-produits-sac.png` : scène, chat, liste montrée par le diffuseur, sac, achat sans quitter le direct.
6. Espaces vendeur, livreur, admin.

## 11. Livrables

- `docs/TDR.md`, `docs/PDR.md`, `docs/design/pour-toi.jpg`, `docs/design/live-produits-sac.png`
- Application dans `Desktop/ShipShop`
- Ajustement minimal du backend `shop` : plugin bearer, origines de confiance, lecture du jeton sur les routes métier
