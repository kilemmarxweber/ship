# SHIPSHOP — PLAN DE MONITORING, DEBUGGING ET SÉCURITÉ

## PDR & TDR

**Application :** Expo SDK 58, Expo Router, React Native 0.88 (Android via `expo run:android` et EAS). Pas de dossier `android/` versionné.
**API :** Next.js 16 (App Router) dans le dépôt `shop`, Prisma, PostgreSQL, Better Auth. Pas d’Express.
**Prod :** `https://shipshop.klambocore.com` — le mobile envoie le jeton de session Better Auth en `Authorization: Bearer`. Il n’y a pas de refresh token JWT.

---

## 1. Objectifs

1. **Sentry** — erreurs de l’app Expo et du serveur Next.js, sans mots de passe, OTP, ni jetons.
2. **React Native DevTools** — JavaScript Hermes. Android Studio / Logcat pour le natif.
3. **Postman** — collection sur les vrais chemins `/api/*`.
4. **Reset mot de passe** — OTP 6 chiffres, hash SHA-256, expiration configurable (15 minutes par défaut), usage limité, réponse qui ne révèle pas si le compte existe.
5. **UptimeRobot** — page web, `GET /api/health`, `GET /api/ready`.

---

## 2. Sentry

### Mobile (Expo)

- SDK `@sentry/react-native`, initialisé seulement si `EXPO_PUBLIC_SENTRY_DSN` est défini.
- Plugin Expo `@sentry/react-native/expo` ajouté au build quand `SENTRY_ORG` et `SENTRY_PROJECT` sont définis (upload des source maps, pas de jeton dans Git).
- Metro : `getSentryExpoConfig` dans `metro.config.js`.
- Release : `SENTRY_RELEASE`, sinon version `app.json` (`runtimeVersion.policy` = `appVersion`).
- Filtrage : `Authorization`, `set-auth-token`, corps `password` / `code`, toast `MDP temporaire`.

### API (Next.js)

- SDK `@sentry/nextjs` (`src/instrumentation.ts`, configs serveur / edge / client).
- DSN : `SENTRY_DSN` (serveur) et `NEXT_PUBLIC_SENTRY_DSN` (navigateur). Sans DSN, le SDK ne démarre pas.
- Upload des source maps seulement si `SENTRY_AUTH_TOKEN` est présent au build.
- Même filtrage : en-têtes `authorization` et `cookie`, champs `password`, `code`, `token`, `temporaryPassword`.

Les secrets restent dans l’environnement ou EAS. Aucun DSN ni `SENTRY_AUTH_TOKEN` dans Git.

---

## 3. Débogage

Expo SDK 58 tourne sur Hermes. Le remote debugging Chrome historique ne s’applique pas.

- JS : React Native DevTools, ouvert depuis le dev client (`expo-dev-client`, profil EAS `development`).
- Réseau : requêtes visibles dans ces outils, origine `EXPO_PUBLIC_API_URL` ou `http://<hôte metro>:3000` en dev.
- Natif (LiveKit, projection d’écran) : Android Studio, Logcat, Android Profiler.

Rien à installer de plus pour le débogage local : le dev client est déjà dans le projet.

---

## 4. Postman

Collection : `shop/postman/ShipShop-API.postman_collection.json`.
Environnement local : `shop/postman/ShipShop-Local.postman_environment.json` (`baseUrl` = `http://localhost:3000`, jeton et mots de passe vides).

| Dossier | Chemins réels |
| --- | --- |
| Authentication | `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-out`, `GET /api/auth/get-session`, `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm` |
| Users | `GET /api/profile`, `PATCH /api/profile` |
| Products | `GET /api/products`, `POST /api/products`, `PATCH /api/products/{{productId}}`, `DELETE /api/products/{{productId}}` |
| Orders | `GET /api/orders`, `POST /api/orders` |
| LIVE | `POST /api/growth/lives`, `POST /api/growth/lives/{{liveId}}` (`action: end`), `POST /api/growth/lives/{{liveId}}/sfu-token` |
| Monitoring | `GET /api/health`, `GET /api/ready` |

Il n’y a pas de route refresh token. Le logout mobile efface le SecureStore ; `POST /api/auth/sign-out` révoque la session côté serveur.

Newman, dossier **Monitoring** seulement (aucun secret) :

```bash
npx newman run postman/ShipShop-API.postman_collection.json --folder Monitoring --env-var baseUrl=https://shipshop.klambocore.com
```

Le workflow `unit-security` vérifie que la collection ne contient pas de secret, et lance Newman si la variable GitHub `SHIPSHOP_API_URL` est définie. Le déploiement VPS reste manuel (PM2) : un échec Newman ne bloque pas un pipeline de déploiement inexistant.

---

## 5. Reset du mot de passe

Le produit est un **code OTP** e-mail / WhatsApp / SMS, pas un lien `randomBytes`. Le hash de mot de passe reste **scrypt** (Better Auth). Le remplacer par Argon2 invaliderait les comptes existants.

| Règle | Implémentation |
| --- | --- |
| Expiration | `PASSWORD_RESET_TTL_MINUTES` (défaut **15**, borné de 1 à 60) |
| Secret | 6 chiffres (`crypto.randomInt`), jamais loggé |
| Stockage | SHA-256 dans `verification.value`, identifiant `pwd-reset:<userId>` |
| Ancien code | effacé avant d’en créer un nouveau |
| Essais | 5 codes faux, puis le code est détruit |
| Débit | 5 demandes / 15 min par identifiant, 20 / 15 min par IP si `TRUST_PROXY=1` |
| Compte inconnu | `200` `{ ok, expiresInMinutes }` — pas de 404 |
| Succès | mot de passe scrypt, sessions supprimées, code détruit |
| Marqueur forcé | **retiré** après un OTP réussi : l’utilisateur vient de choisir son mot de passe. Le reset **admin** (mot de passe temporaire) garde `pwd-force-change` |
| Avis | e-mail « mot de passe modifié », sans le nouveau mot de passe |

Routes :

- `POST /api/auth/password-reset/request` — corps `{ "identifier": "<email ou téléphone>" }`
- `POST /api/auth/password-reset/confirm` — corps `{ identifier, code, password, confirmPassword }`

L’app Android ouvre ce flux depuis la feuille de connexion (« Mot de passe oublié »). Le web reste sur `/auth/forgot-password`.

---

## 6. UptimeRobot

Endpoints (aucune version, aucune erreur SQL) :

- `GET /api/health` — le processus répond `{ "ok": true }`.
- `GET /api/ready` — `SELECT 1` Prisma. `{ "ok": true }` ou `503` `{ "ok": false }`. LiveKit n’entre pas dans ce contrôle : un live sans clés répond 503 sur `sfu-token` seulement.

Moniteurs (intervalle 5 minutes) :

| Nom | URL |
| --- | --- |
| ShipShop Web | `https://shipshop.klambocore.com` |
| ShipShop Health | `https://shipshop.klambocore.com/api/health` |
| ShipShop Ready | `https://shipshop.klambocore.com/api/ready` |

Création via l’API UptimeRobot (clé hors Git) :

```bash
UPTIMEROBOT_API_KEY=... node scripts/uptimerobot-monitors.mjs
```

Le script ignore les URL déjà surveillées. Alertes e-mail : compte UptimeRobot (contacts déjà configurés sur le compte). L’app Android n’est pas une URL à sonder.

---

## 7. Variables d’environnement

Shop (`.env`, jamais commité) :

```env
PASSWORD_RESET_TTL_MINUTES=15
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

Mobile (EAS / shell, jamais commité) :

```env
EXPO_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

`BETTER_AUTH_SECRET` et `DATABASE_URL` existent déjà. Il n’y a pas de `JWT_SECRET` ni de `JWT_REFRESH_SECRET`.

---

## 8. Critères d’acceptation

| ID | Résultat attendu |
| --- | --- |
| MON-001 | Erreur JS mobile envoyée à Sentry quand le DSN est défini |
| MON-002 | Erreur route Next envoyée à Sentry quand le DSN est défini |
| MON-003 | `release` = version d’app ou `SENTRY_RELEASE` |
| DEV-001 | JS inspectable dans React Native DevTools ; natif dans Logcat |
| API-001 | Collection Postman sur les chemins ci-dessus |
| API-002 | CI vérifie la collection ; Newman Monitoring si `SHIPSHOP_API_URL` |
| SEC-001 | OTP expiré après `PASSWORD_RESET_TTL_MINUTES` (défaut 15) |
| SEC-002 | Code détruit après succès ou 5 essais faux |
| SEC-003 | Nouvelle demande efface le code précédent |
| SEC-004 | Seul le SHA-256 est en base |
| SEC-005 | Sessions du compte supprimées après reset OTP |
| UPT-001 | `/api/health` et `/api/ready` répondent sans fuite |
| UPT-002 | Script UptimeRobot crée les 3 moniteurs si la clé est fournie |
| UPT-003 | Un `ready` rétabli repasse à `{ "ok": true }` |
