# Plan de mise à jour du PDR et des TDR

## Projet : Customer Intelligence System (CIS) — ShipShop

**Version :** 2.1 — Alignée stack ShipShop  
**Date :** 13 novembre 2026  
**Statut :** **Approuvé MOA** (13 nov. 2026) — **MVP CIS livré en code** (phases 1–7 ; ranking flag off)  
**Documents liés :** `docs/PDR.md`, `docs/TDR.md`, dépôt web `shop`, app Expo `ShipShop`

---

## 1. Objet du document

Ce document définit le plan de mise à jour du Plan de Développement du
Projet (PDR) et des Termes de Référence (TDR) pour intégrer un
**Customer Intelligence System (CIS)** à **ShipShop**, sans reconstruire
le backend ni l’application.

### 1.1 Socle technique réel (imposé)

| Couche             | Technologie réelle                                 | Notes                                                         |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------------- |
| Application mobile | **Expo / React Native** (Android **et** iOS)       | Expo Router, TanStack Query, Zustand, expo-video, expo-sqlite |
| Backend / API      | **Next.js** (App Router) dans le dépôt `shop`      | Routes `/api/*` — **pas** un serveur Express séparé           |
| Base centrale      | **PostgreSQL** via Prisma                          | Source de vérité                                              |
| Offline mobile     | **SQLite** (`shipshop-offline.db`)                 | Snapshots feed, outbox, `media_cache` — déjà en place         |
| Authentification   | **Better Auth** + bearer (`Authorization: Bearer`) | Cookie web inchangé ; **pas** un JWT custom maison            |
| Dashboard          | **Next.js** (même app `shop`)                      | Écrans admin existants `/api/admin/*` à étendre               |
| Chat               | Conversations ShipShop `/api/conversations`        | Uniquement le chat in-app                                     |
| Live               | LiveKit via `/api/growth/lives/*`                  | Hors périmètre CIS sauf événements « vue live produit »       |
| Paiements          | CinetPay (clés serveur uniquement)                 | Hors CIS ; les événements « achat » viennent des commandes    |

### 1.2 Finalité CIS

Convertir les interactions commerciales **réalisées dans ShipShop** et
**volontairement autorisées** par les clients en profils d’intérêt,
indicateurs et recommandations pour le fil **Pour toi**, la recherche et
le pilotage commercial.

### 1.3 Principe de protection des données

Le CIS **ne doit pas** :

- espionner SMS, e-mails, WhatsApp, Messenger, Chrome ou apps tierces ;
- surveiller le téléphone hors de ShipShop ;
- lire les conversations privées sans consentement explicite et finalité
  documentée ;
- collecter contacts, micro, fichiers ou localisation sans nécessité et
  autorisation.

Il traite uniquement des données **nécessaires**, obtenues de façon
**transparente**, avec base légale et consentements applicables (RDC et
tout marché où le service est exploité).

---

# PARTIE I — PLAN DE DÉVELOPPEMENT DU PROJET (PDR CIS)

## 2. Contexte et justification

ShipShop dispose déjà de sources riches : vues produit (fil Pour toi),
likes, follows, panier, commandes, recherches (`q` / `category`),
messages vendeur, wanted, lives.

Ces signaux sont aujourd’hui dispersés dans les routes métier. Le CIS
les structure pour :

1. personnaliser le classement **Pour toi** (en complément du ranking
   existant) ;
2. améliorer la pertinence recherche / catégories ;
3. fournir un pilotage agrégé aux admins / vendeurs habilités.

La mise à jour du PDR formalise cette intégration **dans** `shop` +
`ShipShop`, sans second backend.

## 3. Objectif général

Concevoir, développer, intégrer et déployer un module CIS sécurisé qui
exploite les interactions autorisées pour améliorer la pertinence des
offres, le service et le pilotage, **sans régression** sur le commerce,
les paiements et le live.

## 4. Objectifs spécifiques

1. Étendre les profils utilisateurs existants (Better Auth / Prisma
   `User`) avec préférences de confidentialité CIS.
2. Enregistrer des événements commerciaux (vue, recherche, like, follow,
   panier, achat) avec identité issue du jeton serveur.
3. Réutiliser SQLite mobile (outbox / sync) pour le hors-ligne.
4. Agréger préférences et scores d’intérêt **explicables** (pas des
   « probabilités d’achat » improvisées).
5. Analyser uniquement les messages **ShipShop** explicitement partagés
   pour l’analyse.
6. Produire des recommandations branchées sur le catalogue et le fil
   existants (`GET /api/products`, ranking).
7. Étendre le dashboard Next.js admin (pas une app Next parallèle).
8. Garantir traçabilité, conservation limitée et effacement.

## 5. Périmètre fonctionnel

### 5.1 Inclus

- Consentements CIS (version d’information, portée, date, retrait).
- Collecte d’événements depuis l’app Expo et, si utile, depuis le web
  `shop` (mêmes API).
- File locale d’événements (SQLite outbox existante ou table dédiée
  `cis_event_outbox`) + sync idempotente vers Postgres.
- Profilage par catégories / attributs catalogue ShipShop.
- Segmentation documentée (règles métier, pas boîte noire).
- Recommandations injectées dans Pour toi / recherche (feature flag).
- Dashboard admin : indicateurs agrégés, profils autorisés, audit.
- Droits d’accès / rectification / suppression applicables.
- Journalisation des accès admin sensibles (sans contenus privés inutiles).

### 5.2 Exclus

- Lecture SMS / WhatsApp / Messenger / e-mail / navigation tierce.
- Surveillance hors application.
- Nouveau serveur Express, nouvelle auth, nouvelle base « CIS seule ».
- Remplacement de Better Auth, CinetPay, LiveKit ou Sanity.
- Refonte visuelle du PDR mobile (`docs/design/*`) hors besoin CIS.
- Campagnes marketing abusives sans base légale / opt-in.

### 5.3 Événements cibés (mapping initial)

| Événement CIS        | Source ShipShop actuelle                                |
| -------------------- | ------------------------------------------------------- |
| `product_view`       | Ouverture / dwell d’une card Pour toi ou fiche          |
| `product_like`       | `POST/DELETE /api/products/{id}/like`                   |
| `shop_follow`        | `POST/DELETE /api/shops/{slug}/follow`                  |
| `search`             | `GET /api/products?q=&category=`                        |
| `add_to_cart`        | `POST /api/cart`                                        |
| `purchase`           | Commande / checkout confirmé (pas le seul dépôt wallet) |
| `chat_share_for_cis` | Opt-in explicite sur un message `/api/conversations`    |
| `wanted_signal`      | Création / matching wanted (optionnel phase 2)          |

## 6. Architecture technique cible (alignée)

```
ShipShop (Expo)
  collecte CIS + outbox SQLite
        |  Authorization: Bearer (Better Auth)
        v
shop (Next.js /api/cis/* + routes métier existantes)
        |---> PostgreSQL (Prisma)  ← source de vérité CIS
        |---> Service IA (serveur uniquement, données minimisées)
        |---> Admin Next.js (/shops/admin ou /api/admin/cis)
```

### 6.1 Principes

- Postgres = vérité ; SQLite mobile = file temporaire + offline.
- Identité utilisateur **toujours** dérivée de la session Better Auth
  côté serveur (jamais `userId` librement choisi par le client).
- Idempotence : chaque événement a un `clientEventId` unique.
- Secrets et clés IA **uniquement** côté `shop` (env / secrets manager).
- Feature flags pour activer le ranking CIS progressivement.
- Réutiliser `src/offline/*` (outbox, sync) autant que possible.

### 6.2 Emplacement code proposé

| Zone                | Emplacement                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Schéma / migrations | `shop/prisma` — tables `CisConsent`, `CisEvent`, `CisPreference`, `CisRecommendation`, `CisAdminAudit` |
| API                 | `shop/src/app/api/cis/*`                                                                               |
| Jobs agrégation     | `shop/src/lib/cis/*`                                                                                   |
| Collecte mobile     | `ShipShop/src/cis/*` + branchement Feed / cart / search                                                |
| Offline             | Extension de `ShipShop/src/offline/outbox`                                                             |
| Admin UI            | Pages Next existantes sous admin shops                                                                 |

## 7. Phasage du développement

| Phase                    | Activités                                                                        | Livrables                        |
| ------------------------ | -------------------------------------------------------------------------------- | -------------------------------- |
| 1. Audit & cadrage       | Audit Expo, Next/`shop`, Prisma, Better Auth, chat, offline SQLite, ranking feed | Rapport + spec CIS v2.1 validée  |
| 2. Modèle de données     | Migrations Prisma CIS, index, rétention                                          | Schéma + migrations réversibles  |
| 3. Collecte & sync       | SDK mobile, outbox, `POST /api/cis/events`, dédup                                | Module tracking + sync           |
| 4. Profilage             | Agrégation, pondérations, décroissance temporelle                                | Moteur de scores + docs facteurs |
| 5. Chat autorisé         | Opt-in message, extraction structurée serveur                                    | Analyseur IA contrôlé            |
| 6. Recommandations       | Injection ranking Pour toi / search, explications, mesure                        | Feature flag + métriques         |
| 7. Dashboard             | Admin Next : agrégats, profils autorisés, audit                                  | UI + permissions serveur         |
| 8. Recette & déploiement | Tests, perf, privacy, rollout progressif                                         | Rapport + rollback               |

## 8. Calendrier indicatif

Estimation **12 à 16 semaines** après validation et accès. Ajuster après audit.

| Période        | Activités                                             |
| -------------- | ----------------------------------------------------- |
| Semaine 1      | Audit et cadrage                                      |
| Semaines 2–3   | Modèle de données + API consentements                 |
| Semaines 4–5   | Collecte mobile + sync offline                        |
| Semaines 6–7   | Profilage                                             |
| Semaines 8–9   | Recos MVP (sans IA chat si besoin)                    |
| Semaines 10–11 | Dashboard + IA chat (si validé)                       |
| Semaines 12–16 | Tests, corrections, formation, déploiement progressif |

**MVP recommandé (fin semaine 9) :** consentements + événements + sync +
scores + recos simples sur Pour toi. IA chat = phase suivante.

## 9. Ressources et responsabilités

| Rôle                    | Responsabilités                                  |
| ----------------------- | ------------------------------------------------ |
| Maître d’ouvrage        | Objectifs, budget, validation                    |
| Chef de projet          | Planning, risques, démos                         |
| Dev mobile Expo         | Collecte, outbox, branchements feed/cart         |
| Dev backend Next/Prisma | API CIS, sécurité, jobs                          |
| Dev data / IA           | Extraction, pondérations, évaluation             |
| Dev Web admin           | Dashboard Next                                   |
| Sécurité / données      | Consentements, rétention, audit                  |
| Recette                 | Scénarios, non-régression commerce/live/paiement |

## 10. Indicateurs de performance

Cibles chiffrées après audit. Familles d’indicateurs :

- Taux de sync événements réussie ; doublons post-sync ≈ 0.
- Délai médian de sync après retour réseau.
- Taux de rejet (consentement / validation).
- Qualité extraction IA (précision catégorie / attributs) si phase 5.
- Lift recos : clics, likes, add-to-cart, conversions vs témoin.
- Disponibilité `/api/cis/*`.
- Accès admin non autorisés détectés.
- Délai traitement demandes de suppression.

Les scores d’intérêt **ne sont pas** présentés comme probabilités d’achat
sauf modèle probabiliste entraîné et évalué.

## 11. Risques et atténuation

| Risque                            | Atténuation                                      |
| --------------------------------- | ------------------------------------------------ |
| Désalignement stack (Express/JWT) | Spec 2.1 impose Next + Better Auth               |
| Régression feed / paiement / live | Feature flags, tests non-régression PDR          |
| Doublons offline                  | `clientEventId` + contrainte unique Postgres     |
| Fuite profils                     | Auth serveur, rôles, audit, minimisation UI      |
| Collecte excessive                | Finalités documentées + consentements versionnés |
| IA incorrecte                     | Seuils, revue, opt-out, pas d’envoi PII inutile  |
| Perf ranking                      | Calcul asynchrone, cache, pagination             |
| Calendrier trop court             | MVP sans IA chat d’abord                         |

## 12. Budget

À établir après audit. Rubriques :

- Développement / intégration Expo + Next
- Hébergement Postgres / Next
- Coûts API IA
- Tests sécurité / perf
- Formation et documentation
- Maintenance

Aucun montant dans cette version.

## 13. Mise à jour du PDR mobile existant (`docs/PDR.md`)

**Fait (v1.1) :** annexe CIS fusionnée en §11 (consentement, événements UI,
recos Pour toi, profil privacy). Le PDR visuel / parcours reste la
référence UI ; les maquettes `docs/design/` ne changent pas sans
validation métier.

**Approuvé (13 nov. 2026) :** validation métier / technique de l’annexe
§11 — contenu CIS UI / parcours accepté comme référence.

---

# PARTIE II — TERMES DE RÉFÉRENCE (TDR CIS)

## 14. Intitulé de la mission

**Audit, conception, développement, intégration et déploiement du
Customer Intelligence System (CIS) au sein de ShipShop** (app Expo
Android/iOS + backend Next.js `shop` + PostgreSQL + Better Auth).

## 15. Contexte de la mission

ShipShop est une place de marché vidéo (RDC) : fil produit, lives
LiveKit, commandes, portefeuille CinetPay, messages, wanted. Le backend
et l’app native existent. La mission intègre le CIS **sans perturber**
commerce, auth, paiements ni live.

Le prestataire commence par auditer le code réel avant toute migration.

## 16. Objectif de la mission

Livrer un module CIS documenté et sécurisé : collecte autorisée,
profils d’intérêt, analyse chat opt-in, recommandations branchées au
catalogue et au fil, dashboard admin dans Next.js `shop`.

## 17. Prestations attendues

### 17.1 Audit technique

- App Expo (`ShipShop`) : feed, cart, search, offline SQLite, session.
- Backend `shop` : routes `/api/*`, Prisma, Better Auth, rôles.
- Chat `/api/conversations`, ranking produits, admin existant.
- Risques de régression et plan d’intégration CIS.

### 17.2 Conception et base de données

- Modèle Prisma CIS (consentements, événements, préférences, recos, audit).
- Migrations réversibles, index, rétention.
- Documentation relations / intégrité.

### 17.3 Collecte et synchronisation

- SDK / hooks Expo (feed, like, follow, search, cart, purchase).
- Persistance SQLite + reprise après kill app.
- `POST /api/cis/events` (batch), dédup, retries.
- Interdiction d’usurper un `userId`.

### 17.4 Profilage

- Pondérations et décroissance temporelle documentées.
- Facteurs explicatifs par score.
- Correction / suppression profil.

### 17.5 Analyse chat (option phase 2)

- Opt-in explicite par message ou fil.
- Extraction structurée (catégorie, marque, intention).
- Minimisation PII vers le fournisseur IA.
- Seuils de confiance + correction humaine possible.

### 17.6 Recommandations

- Entrée : préférences CIS + catalogue actif.
- Sortie : scores / listes consommées par ranking Pour toi / search.
- Mesure clics / conversions ; anti-répétition.
- Respect préférences de communication.

### 17.7 Dashboard Next.js (`shop`)

- Indicateurs agrégés.
- Liste / fiche profils **autorisés**.
- Catégories d’intérêt, interactions, recos + explications.
- Rôles contrôlés **côté serveur**.
- Journal d’accès admin.

### 17.8 Tests et déploiement

- Unitaires, intégration API, sync offline, dédup, authz.
- Non-régression : Pour toi, panier, CinetPay, live, messages.
- Recette, déploiement progressif, rollback.

## 18. Exigences de sécurité et protection des données

1. Identité via session Better Auth vérifiée serveur.
2. Rôles admin contrôlés serveur (pas seulement UI).
3. Mots de passe : hachage Better Auth (jamais en clair).
4. **TLS 1.3 en transit** (exigence exacte, adaptée ShipShop) :
   - Tout trafic **prod / staging** entre l’app Expo (iOS/Android), le
     site `shop` (navigateur) et les routes Next.js `/api/*` (y compris
     `/api/cis/*`, Better Auth, médias distants) passe en **HTTPS** avec
     **TLS 1.3 uniquement** côté terminaison (edge / reverse proxy /
     hébergeur de `shop`) — **pas** TLS 1.0, 1.1 ni 1.2 en cible
     d’exploitation.
   - Pas de serveur TLS maison dans l’app Next : la contrainte s’applique
     à la **couche d’exposition** de `shop` (CDN, load balancer, ou
     reverse proxy déjà en place), pas à Express (hors stack).
   - Clients Expo : URL API **https://** uniquement en hors-dev ; pas de
     cleartext HTTP, pas de contournement ATS / Network Security Config
     pour le CIS ; validation des certificats système (pas de pinning
     custom obligatoire sauf décision sécu ultérieure).
   - PostgreSQL (Prisma) : connexions vers la base en **TLS** si l’hébergeur
     l’expose (ex. `sslmode=require` / équivalent) ; secrets DB jamais en
     clair hors tunnels locaux de développement.
   - Exception **dev local** uniquement (`localhost` / émulateur) ;
     documentée et absente des builds release.
5. Secrets dans l’environnement serveur uniquement.
6. Finalités limitées et documentées.
7. Consentements versionnés (date, portée, texte).
8. Retrait → arrêt des traitements + suppression / restriction.
9. Accès profils restreint aux habilités.
10. Durées de conservation définies et appliquées.
11. Données IA minimisées.
12. Logs d’actions sensibles sans contenus privés inutiles.
13. Pas d’énumération de comptes ni fuite de soldes / PII tiers
    (aligné audits sécurité wallet / auth déjà menés).

## 19. Livrables contractuels

| Réf. | Livrable          | Contenu minimal                                        |
| ---- | ----------------- | ------------------------------------------------------ |
| L1   | Rapport d’audit   | État ShipShop, risques, plan d’intégration             |
| L2   | Architecture CIS  | Schémas, flux, feature flags                           |
| L3   | Modèle de données | Migrations Prisma + doc                                |
| L4   | API CIS           | Routes `/api/cis/*`, validation, OpenAPI ou équivalent |
| L5   | Module Expo       | Collecte + sync SQLite                                 |
| L6   | Profilage         | Scores, facteurs, jobs                                 |
| L7   | Analyseur IA      | Optionnel phase 2                                      |
| L8   | Recos             | Branchement ranking + mesure                           |
| L9   | Dashboard admin   | UI Next + permissions                                  |
| L10  | Dossier de tests  | Scénarios + non-régression                             |
| L11  | Documentation     | Install, exploit, rétention                            |
| L12  | Formation         | Transfert d’équipe                                     |

## 20. Critères d’acceptation

- Migrations Prisma exécutables et documentées.
- `/api/cis/*` exige une session valide et des permissions.
- Événement autorisé enregistré et synchronisé ; retry sans doublon.
- Retrait de consentement bloque les traitements concernés.
- Préférences calculées à partir d’événements éligibles.
- Recos explicables et mesurables (flag off = comportement actuel).
- Dashboard n’expose que les données autorisées.
- Non-régression : feed, panier, wallet/CinetPay, live, auth.
- TLS 1.3 vérifié sur l’exposition `shop` (staging/prod) ; clients Expo
  CIS en HTTPS sans cleartext en release.
- Sauvegarde / restauration / rollback documentés.
- Sources et docs remises au maître d’ouvrage.

## 21. Profil attendu

Expo/React Native, Next.js/API routes, Prisma/PostgreSQL, SQLite offline,
Better Auth / authz, intégration IA, tests, déploiement.

## 22. Gouvernance

- Kick-off (périmètre + accès repos `shop` et `ShipShop`).
- Point hebdo + démo par phase.
- Changements de scope documentés.
- Prod uniquement après recette MOA.

## 23. Durée

**12 à 16 semaines** indicatives après cadrage et accès. Confirmé post-audit.

## 24. Propriété intellectuelle

Précisée au contrat. Remise : sources, migrations, procédures, secrets
_documentation_ (pas les valeurs secrètes).

## 25. Mise à jour du TDR mobile existant (`docs/TDR.md`)

**Fait (v1.1) :** module CIS dans le phasage (§10.7–10.8), hors périmètre
renforcé (§5), livrables et annexe critères (§12). Interdiction explicite
d’un second backend CIS.

**Approuvé (13 nov. 2026) :** validation métier / technique de l’annexe
§12 et du module CIS dans le TDR — critères et contraintes acceptés.

---

# PARTIE III — VALIDATION DOCUMENTAIRE

## 26. Documents à mettre à jour

| Document               | Mise à jour                                   |
| ---------------------- | --------------------------------------------- |
| `docs/PDR.md`          | Annexe CIS §11 — **approuvée** (13 nov. 2026) |
| `docs/TDR.md`          | Module CIS §12 — **approuvé** (13 nov. 2026)  |
| Le présent plan        | v2.1 **approuvée MOA** (13 nov. 2026)         |
| Architecture technique | Flux CIS                                      |
| Modèle de données      | Tables Prisma CIS                             |
| Plan de tests          | Sync, privacy, ranking                        |
| Plan de déploiement    | Flags, rollback                               |
| Guides user / admin    | Consentements, dashboard                      |

## 27. Circuit de validation

1. ~~Relecture technique (mobile + backend).~~ **Fait** — 13 nov. 2026.
2. ~~Validation métier / produit.~~ **Fait** — 13 nov. 2026 (annexes PDR/TDR approuvées).
3. Relecture sécurité / données — à poursuivre en parallèle du chantier (non bloquante après MOA).
4. Arbitrage budget et calendrier — à préciser (voir §28) sans remettre en cause l’approbation.
5. ~~Approbation MOA.~~ **Fait** — 13 nov. 2026.
6. Exécution autorisée sur versions approuvées (plan v2.1, PDR/TDR v1.1).

## 28. Informations à confirmer en cours d’exécution

_(L’approbation MOA du 13 nov. 2026 autorise le démarrage CIS ; les points
ci-dessous restent à renseigner pour l’exploitation et le contrat.)_

- Nom légal de l’organisation porteuse.
- Responsable projet et contacts.
- Environnements (staging / prod) et hébergement `shop`.
- Volumétrie utilisateurs actuelle et cible.
- Budget / enveloppe.
- Durées de conservation CIS.
- Textes juridiques applicables (RDC ± autres).
- Dates de démarrage / fin.
- Validateurs nommés.
- Décision MVP : avec ou sans IA chat en v1.

---

## Conclusion

La version **2.1** ancre le CIS dans **ShipShop tel qu’il existe** :
Expo (iOS/Android), Next.js `shop`, PostgreSQL/Prisma, Better Auth,
SQLite offline déjà présent, dashboard admin Next, chat in-app uniquement.

Elle conserve les exigences privacy et de gouvernance de la v2.0, tout en
éliminant les hypothèses erronées (Express, JWT custom, Android seul,
second dashboard).

**Prochaine étape :** activer le flag ranking CIS en staging après
recette consentement/sync ; compléter §28 ; IA chat = phase ultérieure.

**Statut :** **approuvé MOA** le 13 nov. 2026 — **MVP CIS livré en code**
(audit L1, schéma Prisma, `/api/cis/*`, module Expo, admin, ranking
flaggé off par défaut).
