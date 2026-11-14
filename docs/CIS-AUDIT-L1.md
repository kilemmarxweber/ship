# L1 — Rapport d’audit CIS (ShipShop)

**Date :** 13 novembre 2026  
**Référence :** `docs/Plan_Mise_a_jour_PDR_TDR_CIS.md` v2.1 (approuvé MOA)

## Socle constaté

| Zone    | Constat                                                                                       |
| ------- | --------------------------------------------------------------------------------------------- |
| Mobile  | Expo Router, TanStack Query, SQLite `shipshop-offline.db` (kv, snapshot, outbox, media_cache) |
| Backend | Next.js App Router `shop`, routes `/api/*`                                                    |
| Auth    | Better Auth + bearer via `sessionHeaders` / `getSession()`                                    |
| Ranking | `src/lib/feed-rank.ts` + taste `buyer-taste`                                                  |
| Admin   | Owner via `assertChipShopOwner` / `requirePlatformSession`                                    |
| Flags   | `ContentSourceConfig` (ex. `challengesEnabled`)                                               |

## Risques d’intégration

- Doublons offline → `clientEventId` unique `(userId, clientEventId)`.
- Ranking régressif → `cisRankingEnabled` défaut `false`.
- Collecte sans opt-in → API events refuse sans consentement `accepted`.
- Fuite profils → admin CIS journalisé (`CisAdminAudit`).

## Plan d’intégration exécuté (MVP)

1. Prisma CIS + migration `20261113190000_cis_mvp`
2. `/api/cis/consent`, `/api/cis/events`, `/api/cis/preferences`
3. Admin `/api/admin/cis` + UI `/shops/admin/cis`
4. Module Expo `src/cis/*` + `cis_event_outbox` + Profil consentement
5. Branchement feed / like / panier + ranking optionnel

## Hors MVP (phase suivante)

- Analyse chat IA opt-in
- Wanted signals phase 2
- Mesure A/B lift recos
- Job rétention / purge automatique
