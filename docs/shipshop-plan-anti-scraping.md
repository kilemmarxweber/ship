# ShipShop — Plan anti-scraping et anti-bot

## Architecture Next.js (web/API) + React Native (Android/iOS)

**Statut :** Phases 2 + 5 (Security Center) faites — Anubis staging préparé (snippet Nginx) — attestation native reportée  
**Périmètre :** protection du catalogue, de la recherche, des boutiques, des profils et des API ShipShop.  
**Principe :** appliquer les contrôles d'autorisation et de limitation côté serveur. Les contrôles du client mobile sont complémentaires et ne constituent jamais une frontière de sécurité.

---

## 0. Adaptations au dépôt réel (inventaire)

| Élément plan        | Réalité ShipShop                           | Décision                                             |
| ------------------- | ------------------------------------------ | ---------------------------------------------------- |
| Redis distribué     | Absent (VPS + Postgres + PM2)              | **Postgres** `ApiThrottle` + repli mémoire           |
| `middleware.ts`     | Next 16 → `src/proxy.ts` (CORS)            | Garde explicite `enforceApiSecurity` dans les routes |
| `/api/search`       | Recherche = `GET /api/products?q=`         | Bucket `search` si `q` présent                       |
| `/api/users`        | Pas de liste publique ; `/api/profile`     | Minimisation déjà en place                           |
| Refresh tokens      | Better Auth session opaque + Bearer mobile | Révocation session DB ; pas de rotation refresh      |
| Anubis              | Nginx VPS, pas Cloudflare                  | Staging documenté ; `/api/*` hors challenge          |
| Attestation mobile  | Expo 58, SecureStore déjà OK               | Stub Phase 4 ; headers client + installId            |
| Dossier `mobile/`   | App = repo ShipShop (`src/`)               | Modules dans `src/security/`                         |
| Pagination publique | `limit` absent → dump 80                   | Clamp catalogue public à **24**                      |

**Routes prioritaires branchées :**  
`/api/products`, `/api/products/latest`, `/api/shops`, `/api/events`, `/api/wanted`, `/api/growth/surface`, `/api/growth/leaderboard`, `/api/wallet`, `/api/orders`, honeypot `/api/_internal/catalog-trap`.

---

## 1. Objectifs

- Rendre l'extraction automatisée du catalogue plus difficile et plus coûteuse.
- Détecter les comportements compatibles avec du scraping sans assimiler automatiquement toute activité rapide à un robot.
- Protéger les API utilisées à la fois par Next.js et React Native.
- Limiter les faux positifs pour les acheteurs, vendeurs, moteurs de recherche légitimes et outils d'accessibilité.
- Centraliser les événements, les décisions et les sanctions.
- Préserver les contrôles d'autorisation métier (IDOR/BOLA) : un utilisateur ne doit jamais accéder aux ressources d'un autre simplement parce qu'il a passé un contrôle anti-bot.

## 2. Architecture cible

```text
                 Visiteurs web / bots
                          |
                 Nginx (+ Anubis Phase 3, pages web)
                          |
                    Next.js (shop)
                          |
                          +----------------------+
                                                 |
Application Expo React Native                    |
             |                                   |
      API HTTPS / TLS                             |
             |                                   |
             +------------------+----------------+
                                |
                  Couche sécurité backend (commune)
             +------------------+------------------+
             |                  |                  |
        Auth/session       Rate limiting      Risk scoring
        (Better Auth)      (Postgres)         (+ honeypot)
                                |
                       Prisma / PostgreSQL
                                |
                  SecurityEvent / SecurityRestriction

                  Dashboard admin (Phase 5)
```

**Point important :** Anubis protège le HTML web. Les appels React Native vers `/api/*` sont protégés par `src/lib/security` uniquement.

## 3. Modules implémentés

### 3.1 Protection des API Next.js — fait

Couche réutilisable : `shop/src/lib/security/`  
Entrée : `enforceApiSecurity({ request, bucket, session, isSearch?, hasCursor?, failClosed? })`.

Quotas (adaptés feed mobile rapide) :

| Bucket                  | Anon / min | Auth / min       |
| ----------------------- | ---------- | ---------------- |
| catalog                 | 60         | 180              |
| search                  | 20         | 45               |
| shops / events / wanted | 40         | 90               |
| growth                  | 50         | 120              |
| wallet                  | 5          | 40 (fail-closed) |
| orders                  | 5          | 60 (fail-closed) |

Réponses : `429` + `Retry-After` ; restriction active → `403` + `SECURITY_RESTRICTED`.

### 3.2 Rate limiting distribué — Postgres

Table `api_throttle`. Pas de Redis pour l’instant (coût / ops VPS).  
Repli : `takeRateLimit` mémoire si DB down — **fail-open** catalogue, **fail-closed** wallet/orders.

### 3.3 Détection comportementale — soft

`risk-score.ts` : énumération cursor / recherche répétée → réduction de débit (pas de ban).  
Seuils à calibrer en staging.

### 3.4 Honeypot — fait

`GET|POST /api/_internal/catalog-trap`

- Pas de données réelles
- Journal `honeypot_hit`
- Session → révocation + restriction 1h
- IP anonyme → restriction **15 min** seulement (IP partagée)
- **Jamais** de ban définitif automatique

### 3.5 Anubis — documenté, non activé

Voir `shop/infrastructure/anubis/README.md`.

### 3.6 Sécurité React Native — partiel

- Jeton déjà dans SecureStore (`src/session.ts`)
- `src/security/secure-session.ts` : installId
- `src/security/security-client.ts` : headers `X-ShipShop-Client` / `X-ShipShop-Install-Id`
- `src/security/device-integrity.ts` : stub attestation (Phase 4)
- `api.ts` : propage les headers + gère `429`

### 3.7 Sessions et sanctions — fait (cœur)

- `revokeSessionById` / `revokeAllUserSessions`
- `SecurityRestriction` (USER | SESSION | IP hashée)
- Compte désactivé déjà via `User.disabledAt` (login)

### 3.8 Dashboard admin — fait

- UI : `/shops/admin/security` (owner / admin plateforme)
- API : `GET|POST /api/admin/security`
- Actions : lever restriction, créer restriction manuelle (USER/SESSION/IP), révoquer sessions
- Liens depuis profil owner et `/shops`

## 4. Organisation du code (réelle)

```text
shop/
├── src/lib/security/
│   ├── guard.ts
│   ├── rate-limit.ts
│   ├── risk-score.ts
│   ├── honeypot.ts
│   ├── restrictions.ts
│   ├── session-revocation.ts
│   ├── security-events.ts
│   ├── policies.ts
│   └── index.ts
├── src/app/api/_internal/catalog-trap/route.ts
├── infrastructure/anubis/README.md
└── prisma/… ApiThrottle, SecurityEvent, SecurityRestriction

ShipShop/
└── src/security/
    ├── secure-session.ts
    ├── device-integrity.ts
    └── security-client.ts
```

## 5. Modèle de données

- `ApiThrottle` — compteurs partagés
- `SecurityEvent` — journaux minimisés (IP hashée, pas de jetons)
- `SecurityRestriction` — sanctions temporaires
- Pas de DeviceSession séparée : Better Auth `session` suffit

Migration : `prisma/migrations/20261115120000_api_security_anti_scraping`

## 6. Phases

| Phase                 | Statut                                       |
| --------------------- | -------------------------------------------- |
| 1 Audit               | Fait                                         |
| 2 Backend             | Fait (routes prioritaires)                   |
| 3 Anubis web          | Install native + STAGING.md (activation VPS) |
| 4 Attestation native  | Stub + politique de repli                    |
| 5 Dashboard admin     | Fait (`/shops/admin/security`)               |
| 6 Tests / déploiement | Unit policies + migrate prod                 |

## 7. Déploiement

Sur le VPS shop :

```bash
pnpm db:migrate   # ou prisma migrate deploy
pnpm db:generate
pnpm build && pm2 restart …
```

Vérifier `TRUST_PROXY=1` derrière Nginx pour les IP réelles.

## 8. Critères d’acceptation (Phase 2)

- [x] Quotas documentés par bucket
- [x] Compteurs partagés entre instances (Postgres)
- [x] Autorisation métier inchangée (garde avant logique IDOR)
- [x] Événements journalisés
- [x] Honeypot sans ban définitif
- [x] Révocation de session
- [x] Mobile n’est pas la frontière de sécurité
- [x] Dashboard admin (Phase 5)
- [x] Mail urgence SMTP `SECURITY_ALERT_EMAIL` (high/critical → kilem@klambocore.com)
- [ ] Anubis staging activé sur VPS (Phase 3 — suivre `shop/infrastructure/anubis/STAGING.md`)
- [ ] Attestation native (Phase 4)

## 9. Ne jamais transmettre

`.env`, clés API, jetons, secrets d’attestation.
