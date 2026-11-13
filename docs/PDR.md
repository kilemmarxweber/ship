# Plan de réalisation — ShipShop Android et iOS

Version 1.1 — 13 novembre 2026  
(Annexe CIS fusionnée depuis `docs/Plan_Mise_a_jour_PDR_TDR_CIS.md` v2.1)

Ce document fixe l’interface, les parcours et les contrats d’API. Les maquettes sont dans `docs/design/`. Les marques, prix et prénoms dessinés sur les images sont des exemples. La disposition reste celle des images. Les produits, comptes et montants viennent des API.

## 1. Références visuelles

| Fichier                             | Écran                                                          |
| ----------------------------------- | -------------------------------------------------------------- |
| `docs/design/pour-toi.jpg`          | Fil Pour toi                                                   |
| `docs/design/live-produits-sac.png` | Live : scène, liste du diffuseur, sac                          |
| `docs/design/shipshop-logo.png`     | Logo réel, à la place du mot « shop » générique de la maquette |

Couleurs, alignées sur la maquette et sur les jetons sombres du site :

| Rôle            | Valeur    |
| --------------- | --------- |
| Fond            | `#0A0A0F` |
| Vert émeraude   | `#00D68F` |
| Vert profond    | `#00855A` |
| Acheter, début  | `#FF4D8D` |
| Acheter, fin    | `#FF8A3D` |
| Live            | `#7C5CFF` |
| Surface sac     | `#FFFFFF` |
| Texte sur vidéo | `#FFFFFF` |

Le chrome acheteur est sombre. L’écran sac (maquette live, troisième téléphone) est clair. Les textes de l’application sont en français. Les libellés anglais de la maquette live (`Follow`, `Product`, `Add to bag`, `My Bag`, `Checkout now`) sont repris tels quels sur ces trois états, parce qu’ils font partie de la maquette à reproduire.

## 2. Navigation

Barre du bas, fixe, noire, au-dessus de la zone sûre :

1. Accueil, icône maison, vert quand l’onglet est actif
2. Boutique
3. Bouton central rond, dégradé vert, icône plus
4. Messages, pastille numérique s’il y a des non-lus
5. Profil

Le panier n’est pas un onglet. Il s’ouvre depuis le sac du live et depuis Acheter. Une pastille peut indiquer le nombre d’articles.

Haut du fil, par-dessus la vidéo : logo, puis Pour toi (vert, souligné), Abonnements, Je cherche, loupe, cloche avec pastille.

Espaces vendeur, livreur et admin : piles ouvertes depuis Profil quand le compte a le rôle. Ils ne remplacent pas la barre acheteur.

## 3. Pour toi

Vidéo ou image en plein écran, sous tous les contrôles. Hauteur d’une page égale à la hauteur de l’écran. Glissement vertical vers le haut.

- Pastille Tendance, flamme, en haut à gauche, sur les produits mis en avant par le classement existant (`boosted` ou promo `FLASH` / `FORTE`).
- Pastille LIVE violette et compteur de viewers en haut à droite lorsqu’un direct de la boutique est joint au fil. Le branchement room complet est au module live.
- Bouton lecture au centre seulement quand la vidéo est en pause. Au repos, la vidéo de la page visible joue en boucle, son coupé jusqu’au premier geste, puis son du produit.
- Rail droit, du milieu vers le bas : avatar boutique avec bouton plus, cœur et compteur, commentaires et compteur, partage et compteur, cadeau.
- Bloc vendeur : avatar, nom, coche si la boutique est officielle, bouton Suivre.
- Légende sur deux lignes, puis « Plus ». Ligne son : « Son original — {boutique} » quand un `soundtrack` est présent.
- Carte produit translucide, coins arrondis : miniature, titre, note, nombre d’avis, badge de réduction, prix promotionnel en vert, prix barré, bouton Acheter en dégradé rose-orange avec icône panier.
- Points de page sous la carte.

Interactions déjà branchées :

| Geste                            | API                                               |
| -------------------------------- | ------------------------------------------------- |
| Chargement                       | `GET /api/products?status=ACTIVE&limit=8&cursor=` |
| Abonnements                      | même route avec `following=1`                     |
| Recherche de l’onglet Je cherche | `q` et `category` sur la même route               |
| Like                             | `POST` ou `DELETE /api/products/{id}/like`        |
| Commentaires                     | `GET` et `POST /api/products/{id}/comments`       |
| Partage                          | `POST /api/products/{id}/share`                   |
| Suivre                           | `POST` ou `DELETE /api/shops/{slug}/follow`       |
| Ajouter au sac                   | `POST /api/cart` avec `productId` et `quantity`   |

Le corps liste est `{ products, nextCursor }`. Champs utiles : `id`, `title`, `description`, `priceCents`, `compareAtCents`, `promoPercent`, `currency`, `images`, `colors`, `sizes`, `likesCount`, `commentsCount`, `sharesCount`, `likedByMe`, `soundtrack`, `shop` (`name`, `slug`, `logoUrl`, `followedByMe`, `followersCount`). Les URLs relatives `/uploads` sont préfixées par l’origine de l’API. Les montants sont des centimes : `25,50 $US` pour 2550 USD.

Règles de lecture :

1. Une seule vidéo active.
2. La page suivante est préparée, pas décodée en même temps.
3. Quitter l’onglet met la lecture en pause.
4. Les pages déjà reçues restent dans le cache TanStack Query pendant le défilement.
5. Les images passent par `expo-image`.

Acheter ouvre une feuille : tailles, couleurs, quantité, prix, confirmation vers le panier. Le checkout CinetPay est le module portefeuille, pas ce premier écran.

## 4. Abonnements

Même scène que Pour toi. La source est `GET /api/products?following=1`. Sans session, l’écran demande la connexion. Le classement serveur met devant les nouveautés des boutiques suivies.

## 5. Je cherche

Même chrome. Champ de recherche, catégories, boutiques, marques et filtres. Première version utile : `q` et `category` sur `GET /api/products`, plus le rail offres `deals=1` déjà supporté par la route. Filtres détaillés (prix, ville, taille) s’ajoutent sur les paramètres déjà lus par cette route, sans nouveau backend.

## 6. Live

Référence : `docs/design/live-produits-sac.png`. Trois états du même direct.

### 6.1 Scène

Vidéo du diffuseur bord à bord, jeton LiveKit via `GET /api/growth/lives/{id}/sfu-token`.

- Haut gauche : avatar, nom de la boutique, Follow, badge Live, nombre de viewers.
- Haut droit : segment Shop / Reels. Shop est l’état actif à l’ouverture.
- Bas : bulles de chat (avatar, nom, texte), message vendeur épinglé, barre sac, champ « What do you think... », partage, réactions, likes.
- Chat : routes live existantes (`/api/growth/lives/{id}` et messages de salon).

### 6.2 Liste produits

Le diffuseur a une action « montrer la liste ». Elle publie l’état à la room. Les viewers voient la feuille en même temps. Retirer la liste est réservé au diffuseur. Un viewer peut aussi ouvrir la liste pour lui seul.

La feuille blanche, coins hauts arrondis, laisse voir la vidéo assombrie :

- Fermer, titre `Product (n)`, icône sac avec pastille.
- Lignes : photo, nom, note et avis, prix, bouton Add to bag.
- Source : `GET /api/growth/lives/{id}/products`.

Add to bag appelle `POST /api/cart` et met à jour la pastille, sans fermer le direct.

### 6.3 My Bag

Écran clair plein écran :

- Fermer, titre My Bag, pastille du sac.
- Bandeau « Select a voucher to save your money ».
- Lignes : photo, titre, taille, prix, stepper.
- Ligne code promo.
- Barre noire fixe : Checkout now et total.

Checkout enchaîne sur `POST /api/cart/checkout` puis, si le paiement mobile money est choisi, `POST /api/wallet/deposit`. L’application ouvre `paymentUrl`. Le retour `shipshop://wallet/payment/return` n’est accepté que si le schéma est dans la liste fermée du serveur. Sinon l’URL web actuelle reste utilisée. Le téléphone interroge `GET /api/payments/cinetpay/status`. Le webhook `POST /api/payments/cinetpay/notify` reste l’unique crédit de portefeuille.

## 7. Messages, commandes, profil

- Liste : `GET /api/conversations`. Fil : `GET` et `POST /api/conversations/{id}`.
- Commandes acheteur : `GET /api/orders`, détail `GET /api/orders/{id}`, réception `POST /api/orders/{id}/confirm-receipt`.
- Profil : `GET /api/profile`, portefeuille `GET /api/wallet`, dépôts, retraits, transferts et mouvements sur `/api/wallet/*`.
- Favoris : produits `likedByMe` et boutiques suivies.
- Cloche : `GET /api/inbox/summary` et `GET /api/notices`.

## 8. Vendeur, livreur, admin

Ces espaces arrivent après le fil et le live. Ils appellent les routes déjà montées :

- Publication `POST /api/products`, média `POST /api/upload`
- Commandes boutique `/api` côté `shops/orders`, livreurs `/api/shops/delivery/couriers`
- KYC `POST /api/kyc`
- Missions livreur `/api/courier/me`, départ `/api/courier/jobs/{orderId}/depart`, position `/api/couriers/{id}/location`
- Admin : `/api/admin/vendors`, `/api/admin/products`, `/api/admin/moderation`, `/api/admin/ledger`, `/api/admin/delivery-zones`, `/api/admin/brand-campaigns`, `/api/admin/challenges`

Le diffuseur, pour montrer la liste, utilise les produits épinglés du live. Il ne reconstruit pas un catalogue parallèle.

## 9. Session

`POST /api/auth/sign-in/email` avec e-mail ou téléphone, comme le site. La réponse expose `set-auth-token`. L’application le garde dans le trousseau (`expo-secure-store`) et l’envoie sur chaque appel. `GET /api/auth/get-session` vérifie le jeton. La déconnexion appelle `POST /api/auth/sign-out` puis efface le trousseau.

Inscription : `POST /api/auth/sign-up/email` avec téléphone, mot de passe, et e-mail facultatif. Le serveur crée le portefeuille, comme aujourd’hui.

## 10. Performance

Objectifs de lecture, dans l’ordre : une vidéo active, préchargement de la suivante, pause hors fil, chargement progressif, conservation des pages, animations natives, fichiers déjà compressés par le serveur (FFmpeg à l’upload). Pas de second lecteur décodé pour les vignettes hors écran. Hors ligne : images, vidéos et soundtracks déjà mis en cache SQLite / fichiers locaux se rejouent via `playableMediaUrl` sans changer la disposition des cards.

## 11. Annexe CIS — Customer Intelligence (UI / parcours)

Référence complète : `docs/Plan_Mise_a_jour_PDR_TDR_CIS.md` (v2.1). Cette annexe ne modifie pas les maquettes `docs/design/` sauf validation métier explicite.

### 11.1 Objectif dans le fil

Personnaliser le classement **Pour toi** et la pertinence recherche à partir d’interactions **autorisées**, sans espionnage hors app.

### 11.2 Consentement privacy

- À la première utilisation CIS (ou depuis Profil) : feuille ou écran de consentement clair (finalités, exemples de données, retrait).
- États : accepté / refusé / retiré ; version du texte d’information conservée côté serveur.
- Sans consentement CIS : le fil et le panier restent fonctionnels ; aucun événement CIS n’est envoyé.

### 11.3 Événements déclenchés dans l’UI

| Moment UI                                            | Événement CIS                           |
| ---------------------------------------------------- | --------------------------------------- |
| Card Pour toi / Abonnements visible ou ouverte       | `product_view`                          |
| Like / unlike                                        | `product_like`                          |
| Suivre / ne plus suivre                              | `shop_follow`                           |
| Recherche Je cherche (`q`, `category`)               | `search`                                |
| Ajout au sac (feuille Acheter ou live)               | `add_to_cart`                           |
| Commande confirmée                                   | `purchase`                              |
| Partage volontaire d’un message vendeur pour analyse | `chat_share_for_cis` (opt-in explicite) |

La collecte mobile peut bufferiser hors ligne (SQLite / outbox) puis synchroniser vers `POST /api/cis/events`.

### 11.4 Recommandations dans Pour toi

- Feature flag serveur : CIS off = ranking actuel inchangé.
- CIS on : le même chrome Pour toi ; ordre éventuellement influencé par les scores CIS.
- Option UI (si activée) : libellé discret du type « Pourquoi ce produit » avec explication courte (catégorie, like, recherche) — jamais de score « probabilité d’achat » inventé.
- Pas de pastille ou badge CIS obligatoire sur la maquette ; tout ajout visuel passe par validation design.

### 11.5 Profil acheteur

Dans Profil : section Confidentialité / CIS — voir consentement, retirer, demander accès ou suppression selon la politique publiée.

### 11.6 Hors UI mobile

Dashboard agrégats et fiches profils admin : Next.js `shop` (admin), pas une nouvelle app. Voir TDR § CIS.
